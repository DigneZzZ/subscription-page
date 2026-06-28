{{#
# tariffs — ПУБЛИЧНЫЙ каталог услуг SHM по категории (JSON)
# GET /shm/v1/public/tariffs?category=<cat>
# Категория передаётся subscription-page из env SHM_TARIFF_CATEGORY.
#}}
{{ category = request.params.category || '' }}
{{ IF category == '' }}
{{ toJson({ error => 'missing category', code => 400, count => 0, tariffs => [] }) }}
{{ STOP }}
{{ END }}

{{ default_currency = config.subscription_page.currency || config.currency || 'RUB' }}
{{ rows = service.list_for_api('category', category) }}
{{ tariffs = [] }}
{{ FOR row IN rows }}
    {{ period_raw = row.period || 0 }}
    {{ period_int = period_raw FILTER format("%.0f") }}
    {{ period_int = period_int + 0 }}
    {{ period_frac = period_raw - period_int }}
    {{ period_frac_num = (period_frac * 10000) FILTER format("%.0f") }}
    {{ period_frac_num = period_frac_num + 0 }}
    {{ extra_days = (period_frac_num / 100) FILTER format("%.0f") }}
    {{ extra_days = extra_days + 0 }}
    {{ tariffs.push({
        id => row.service_id || row.id,
        name => row.name,
        cost => row.cost + 0,
        period_months => period_int,
        period_days => extra_days,
        period => period_raw,
        currency => default_currency,
        category => category
    }) }}
{{ END }}
{{ toJson({ category => category, count => tariffs.size, currency => default_currency, tariffs => tariffs }) }}
{{ STOP }}
