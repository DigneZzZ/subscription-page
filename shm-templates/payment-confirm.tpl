{{#
# payment-confirm — ПУБЛИЧНЫЙ приёмник вебхуков ПОДТВЕРЖДЕНИЯ оплаты.
# POST /shm/v1/public/payment-confirm?ps=platega|wata|cardlink
# Stateless: пользователь и сумма берутся из колбэка ПС; orderId = uniq_key (идемпотентность).
#
# orderId (subscription-page): ${telegramId_}${shortUuid}_${token}_${ts}
#   token in 1m|3m|6m|12m (подписка) | reset (сброс трафика)
#}}

{{# ps/dry_run приходят в QUERY STRING. На POST SHM наполняет request.params из ТЕЛА,
#   а query-параметры туда НЕ попадают. Парсим их прямо из $ENV{QUERY_STRING}
#   (без CGI, чтобы не трогать чтение тела/POSTDATA для верификации WATA). #}}
{{ PERL }}
  my $qs = $ENV{QUERY_STRING} // '';
  my %q;
  for my $pair ( split /&/, $qs ) {
      my ($k, $v) = split /=/, $pair, 2;
      next unless defined $k && length $k;
      $v = '' unless defined $v;
      $v =~ tr/+/ /;
      $v =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;
      $q{$k} = $v;
  }
  $stash->set('ps_query', $q{ps} // '');
  $stash->set('dry_run_query', $q{dry_run} // '');
{{ END }}
{{ ps = ps_query || request.params.ps || '' }}
{{ debug = config.payment_confirm.debug || 0 }}
{{ dry_run = dry_run_query || request.params.dry_run || 0 }}
{{ admin_chat_id = config.payment_confirm.admin_chat_id || '' }}
{{ bot_token = config.telegram.bot_token || config.telegram.telegram_bot.token || '' }}

{{# --- alert helper (Telegram) --- #}}
{{ BLOCK alert_admin }}
{{ IF admin_chat_id && bot_token }}
  {{ a_res = http.post('https://api.telegram.org/bot' _ bot_token _ '/sendMessage', 'content_type', 'application/json', 'content', toJson({ chat_id => admin_chat_id, text => alert_text, parse_mode => 'HTML' })) }}
{{ END }}
{{ END }}

{{# --- 1. provider gate --- #}}
{{# Fallback-автоопределение ПС по форме пейлоада: на form-urlencoded POST (cardlink)
#   query ?ps= в request.params не попадает, поэтому определяем по характерным полям. #}}
{{ IF ps != 'platega' && ps != 'wata' && ps != 'cardlink' }}
    {{ IF request.params.SignatureValue || request.params.InvId }}
        {{ ps = 'cardlink' }}
    {{ ELSIF request.params.transactionStatus }}
        {{ ps = 'wata' }}
    {{ ELSIF request.params.payload || request.params.paymentMethod }}
        {{ ps = 'platega' }}
    {{ END }}
{{ END }}
{{ IF ps != 'platega' && ps != 'wata' && ps != 'cardlink' }}
{{ toJson({ error => 'unknown ps', code => 400 }) }}{{ STOP }}
{{ END }}

{{# --- 2/3. verify signature + normalize per provider --- #}}
{{ verified = 0 }}{{ order_id = '' }}{{ amount = 0 }}{{ currency = '' }}{{ paid = 0 }}{{ pay_status = '' }}

{{ IF ps == 'platega' }}
   {{ cfg_platega_mid = config.platega.merchant_id || '' }}
   {{ cfg_platega_secret = config.platega.secret || '' }}
   {{ PERL }}
     use CGI;
     our $cgi = CGI->new; my %in = $cgi->Vars;
     my $mid = $ENV{HTTP_X_MERCHANTID} // '';
     my $sec = $ENV{HTTP_X_SECRET} // '';
     my $cm = $stash->get('cfg_platega_mid') // '';
     my $cs = $stash->get('cfg_platega_secret') // '';
     my $ok = ( length($mid) && $mid eq $cm && length($sec) && $sec eq $cs ) ? 1 : 0;
     $stash->set('verified', $ok);
   {{ END }}
   {{ pay_status = request.params.status || '' }}
   {{ amount = (request.params.amount || 0) + 0 }}
   {{ currency = request.params.currency || '' }}
   {{ order_id = request.params.payload || '' }}
   {{ paid = pay_status == 'CONFIRMED' ? 1 : 0 }}
   {{# fallback: payload отсутствует -> вытянуть из /transaction/{id} #}}
   {{ IF order_id == '' && request.params.id }}
       {{ tx = http.get('https://app.platega.io/transaction/' _ request.params.id, 'headers', { 'X-MerchantId' => cfg_platega_mid, 'X-Secret' => cfg_platega_secret }) }}
       {{ order_id = tx.response.payload || '' }}
   {{ END }}

{{ ELSIF ps == 'wata' }}
   {{# публичный ключ: из конфига или кэш storage (обновляем при отсутствии) #}}
   {{ wata_pubkey = config.wata.public_key || '' }}
   {{ IF wata_pubkey == '' }}
       {{ cached = storage.read('name', 'wata_pubkey') }}
       {{ wata_pubkey = cached.response.value || '' }}
       {{ IF wata_pubkey == '' }}
           {{ pk = http.get('https://api.wata.pro/api/h2h/public-key') }}
           {{ wata_pubkey = pk.response.value || pk.response || '' }}
           {{ saved = storage.save('wata_pubkey', { value => wata_pubkey }) }}
       {{ END }}
   {{ END }}
   {{ PERL }}
     use CGI; use MIME::Base64 qw(decode_base64);
     use Crypt::PK::RSA;
     our $cgi = CGI->new; my %in = $cgi->Vars;
     my $body = $in{POSTDATA} // '';
     my $sig_b64 = $ENV{HTTP_X_SIGNATURE} // '';
     my $pem = $stash->get('wata_pubkey') // '';
     my $ok = 0;
     eval {
        if ( length($pem) && length($sig_b64) && length($body) ) {
            my $pk = Crypt::PK::RSA->new( \$pem );
            $ok = $pk->verify_message( $body, decode_base64($sig_b64), 'SHA512', 'v1.5' ) ? 1 : 0;
        }
        1;
     } or do { $ok = 0; };
     $stash->set('verified', $ok);
   {{ END }}
   {{ pay_status = request.params.transactionStatus || '' }}
   {{ amount = (request.params.amount || 0) + 0 }}
   {{ currency = request.params.currency || '' }}
   {{ order_id = request.params.orderId || '' }}
   {{ paid = pay_status == 'Paid' ? 1 : 0 }}

{{ ELSIF ps == 'cardlink' }}
   {{ cfg_cardlink_token = config.cardlink.api_token || '' }}
   {{ PERL }}
     use CGI; use Digest::MD5 qw(md5_hex);
     our $cgi = CGI->new; my %in = $cgi->Vars;
     my $out = $cgi->param('OutSum') // '';
     my $inv = $cgi->param('InvId') // '';
     my $sig = uc( $cgi->param('SignatureValue') // '' );
     my $tok = $stash->get('cfg_cardlink_token') // '';
     my $calc = uc( md5_hex( $out . ':' . $inv . ':' . $tok ) );
     $stash->set('verified', ( length($sig) && $sig eq $calc ) ? 1 : 0);
   {{ END }}
   {{ pay_status = request.params.Status || '' }}
   {{ amount = (request.params.OutSum || 0) + 0 }}
   {{ currency = request.params.CurrencyIn || '' }}
   {{ order_id = request.params.InvId || '' }}
   {{ paid = pay_status == 'SUCCESS' ? 1 : 0 }}
{{ END }}

{{ IF verified != 1 }}
{{ alert_text = '🚨 payment-confirm: invalid signature (' _ ps _ '), order=' _ order_id }}
{{ INCLUDE alert_admin }}
{{ toJson({ error => 'invalid_signature', ps => ps, code => 401 }) }}{{ STOP }}
{{ END }}

{{ IF paid != 1 }}
{{ toJson({ ignored => 1, reason => pay_status, ps => ps, order_id => order_id }) }}{{ STOP }}
{{ END }}

{{ IF order_id == '' }}
{{ alert_text = '🚨 payment-confirm: missing order_id (' _ ps _ ')' }}
{{ INCLUDE alert_admin }}
{{ toJson({ error => 'missing_order_id', ps => ps, code => 400 }) }}{{ STOP }}
{{ END }}

{{# --- 4. parse orderId (right-anchored) --- #}}
{{ parts = order_id.split('_') }}
{{ n = parts.size }}
{{ ts_idx = n - 1 }}
{{ tok_idx = n - 2 }}
{{ ts = parts.$ts_idx }}
{{ token = parts.$tok_idx }}
{{ short_uuid = '' }}{{ telegram_id = '' }}
{{ IF n >= 4 && parts.0.match('^\d+$') }}
    {{ telegram_id = parts.0 }}
    {{ short_uuid = parts.1 }}
    {{# если shortUuid содержал '_', собираем средние части #}}
    {{ i = 2 }}{{ WHILE i < (n - 2) }}{{ short_uuid = short_uuid _ '_' _ parts.$i }}{{ i = i + 1 }}{{ END }}
{{ ELSE }}
    {{ short_uuid = parts.0 }}
    {{ i = 1 }}{{ WHILE i < (n - 2) }}{{ short_uuid = short_uuid _ '_' _ parts.$i }}{{ i = i + 1 }}{{ END }}
{{ END }}
{{ is_reset = token == 'reset' ? 1 : 0 }}
{{ months = 0 }}
{{ IF !is_reset }}{{ months = token.replace('m','') + 0 }}{{ END }}

{{# --- 5. map user via Remnawave by-short-uuid --- #}}
{{ remna_server_id = config.remnawave.server_id || 1 }}
{{ HOST = server.id(remna_server_id).settings.api.host }}
{{ TOKEN = server.id(remna_server_id).settings.api.token }}
{{ rheaders = { 'Authorization' => 'Bearer ' _ TOKEN } }}
{{ rn = http.get(HOST _ '/api/users/by-short-uuid/' _ short_uuid, 'headers', rheaders) }}
{{ rn_username = rn.response.username || '' }}
{{ rn_uuid = rn.response.uuid || '' }}
{{ IF rn_username == '' || rn_uuid == '' }}
{{ alert_text = '⚠️ payment-confirm: remnawave user not found shortUuid=' _ short_uuid _ ' order=' _ order_id }}
{{ INCLUDE alert_admin }}
{{# транзиентно -> 502, чтобы ПС повторила #}}
{{ toJson({ error => 'user_not_found', short_uuid => short_uuid, code => 502 }) }}{{ STOP }}
{{ END }}
{{ uparts = rn_username.split('_') }}
{{ usi = uparts.last }}
{{ uid = us.id(usi).user_id }}
{{ IF !uid }}
{{ alert_text = '⚠️ payment-confirm: SHM user_service not found usi=' _ usi _ ' order=' _ order_id }}
{{ INCLUDE alert_admin }}
{{ toJson({ error => 'us_not_found', usi => usi, code => 502 }) }}{{ STOP }}
{{ END }}

{{# --- dry-run echo --- #}}
{{ IF dry_run && debug }}
{{ toJson({ dry_run => 1, ps => ps, order_id => order_id, paid => paid, amount => amount, currency => currency, short_uuid => short_uuid, usi => usi, uid => uid, is_reset => is_reset, months => months }) }}{{ STOP }}
{{ END }}

{{ IF is_reset }}
    {{# --- 6. RESET flow (net-zero) --- #}}
    {{ pay = user.id(uid).payment( money => amount, pay_system_id => ps, uniq_key => order_id, comment => { type => 'reset', provider => ps } ) }}
    {{# списываем стоимость сброса, только если ещё не списывали по этому order (guard от двойного списания) #}}
    {{ booked_key = 'pc_reset_booked_' _ order_id }}
    {{ already = storage.read('name', booked_key).response.value || '' }}
    {{ IF already == '' }}
        {{ u = user.id(uid) }}
        {{ bonus_avail = u.get_bonus || 0 }}
        {{ IF bonus_avail >= amount }}
            {{ d = u.add_bonus( 0 - amount, 'Сброс трафика (оплата ' _ ps _ ') order=' _ order_id ) }}
        {{ ELSE }}
            {{ IF bonus_avail > 0 }}{{ d = u.add_bonus( 0 - bonus_avail, 'Сброс трафика (бонусы) order=' _ order_id ) }}{{ END }}
            {{ rest = amount - bonus_avail }}
            {{ d2 = u.set( balance = (u.balance || 0) - rest ) }}
        {{ END }}
        {{ mark = storage.save(booked_key, { value => 1, ts => ts }) }}
    {{ END }}
    {{# сброс трафика в Remnawave #}}
    {{ reset_res = http.post(HOST _ '/api/users/' _ rn_uuid _ '/actions/reset-traffic', 'headers', rheaders) }}
    {{ reset_ok = (reset_res.response.status == 'ACTIVE' || reset_res.response.uuid) ? 1 : 0 }}
    {{ toJson({ success => 1, action => 'reset', order_id => order_id, user_id => uid, usi => usi, reset_ok => reset_ok }) }}{{ STOP }}
{{ ELSE }}
    {{# --- 5b. SUBSCRIPTION flow: найти услугу категории по period + сумме, назначить next --- #}}
    {{ cat = request.params.category || config.subscription_page.category || '' }}
    {{ matched_service_id = 0 }}{{ matched_cost = 0 }}
    {{ IF cat != '' }}
        {{ srows = service.list_for_api('category', cat) }}
        {{ FOR srow IN srows }}
            {{ sp_int = (srow.period || 0) FILTER format("%.0f") }}
            {{ sp_int = sp_int + 0 }}
            {{ IF sp_int == months }}
                {{ sid = srow.service_id || srow.id }}
                {{ scost = (srow.cost || 0) + 0 }}
                {{# точное совпадение суммы приоритетно #}}
                {{ IF matched_service_id == 0 || (amount > 0 && scost == amount) }}
                    {{ matched_service_id = sid }}{{ matched_cost = scost }}
                {{ END }}
            {{ END }}
        {{ END }}
    {{ END }}
    {{ IF matched_service_id > 0 && !dry_run }}
        {{ setnext = us.id(usi).api_set( next => matched_service_id ) }}
    {{ END }}
    {{ IF matched_service_id == 0 }}
        {{ alert_text = '⚠️ payment-confirm: no category service for months=' _ months _ ' amount=' _ amount _ ' cat=' _ cat _ ' order=' _ order_id _ ' (платёж записан, next не назначен)' }}
        {{ INCLUDE alert_admin }}
    {{ END }}
    {{ pay = user.id(uid).payment( money => amount, pay_system_id => ps, uniq_key => order_id, comment => { type => 'subscription', months => months, service_id => matched_service_id, provider => ps } ) }}
    {{ toJson({ success => 1, action => 'subscription', order_id => order_id, user_id => uid, usi => usi, service_id => matched_service_id, months => months }) }}{{ STOP }}
{{ END }}
