# Changelog

## [7.9.0](https://github.com/DigneZzZ/subscription-page/compare/v7.8.0...v7.9.0) (2026-07-23)


### Features

* Aurora layout (LAYOUT_PRESET=j) ([f52feee](https://github.com/DigneZzZ/subscription-page/commit/f52feee5a648923b44815e017923f86cc7d85069))
* EFFECTS env — visual effects toggleable on any layout ([cff6d7d](https://github.com/DigneZzZ/subscription-page/commit/cff6d7dfbf5955c704c23acc042ff29715d4302f))
* EFFECTS env — эффекты включаются на любой раскладке ([5050f06](https://github.com/DigneZzZ/subscription-page/commit/5050f062492f219115116a3faedc322594bcebca))
* **frontend:** Aurora layout (LAYOUT_PRESET=j) — animated blobs, glass hero, ring-as-reset-button ([3925e17](https://github.com/DigneZzZ/subscription-page/commit/3925e17fdef01ee254c5b844573f8d113b619cb7))
* **frontend:** Network (k) and Billboard (l) layouts ([6f138a7](https://github.com/DigneZzZ/subscription-page/commit/6f138a7c2d2d1ea307c52ca8794994846ba31caa))
* Network (k) и Billboard (l) раскладки ([1b5b12b](https://github.com/DigneZzZ/subscription-page/commit/1b5b12b3274fb747a4a689c6a55a40d20e805cb2))
* optional header Pay button (HEADER_PAY_BUTTON) + 4 new color themes ([25cb88a](https://github.com/DigneZzZ/subscription-page/commit/25cb88af5e20e9e53dab129a957b549ede07b967))
* optional header Pay button + themes 9-12 ([72f589f](https://github.com/DigneZzZ/subscription-page/commit/72f589f1626400f467825b29be63335be1226652))


### Bug Fixes

* **frontend:** flatten single-tariff periods in the tariff picker ([2ea0833](https://github.com/DigneZzZ/subscription-page/commit/2ea08337fc508e5a96393a8de1837e3b38accdab))
* **frontend:** show subscription username in all layout summaries ([5b266fe](https://github.com/DigneZzZ/subscription-page/commit/5b266fed01e16be087dfad0fe5c818b74fe28f4e))
* show subscription username in all layout summaries ([e5b3a11](https://github.com/DigneZzZ/subscription-page/commit/e5b3a112539b0ba48bdd968a07055c4b972b478f))
* одиночные периоды в выборе тарифа — без группировки ([342b329](https://github.com/DigneZzZ/subscription-page/commit/342b3292e3c3d00906ebe5c0785bcf00030c0587))

## [7.8.0](https://github.com/DigneZzZ/subscription-page/compare/v7.7.0...v7.8.0) (2026-07-18)


### Features

* **frontend:** 8 runtime theme presets with Mantine factory and --sp-* css vars ([23373a7](https://github.com/DigneZzZ/subscription-page/commit/23373a7004aad2f2a0ef76688ba9f64805307683))
* **frontend:** app-first installation guide with platform chips ([1041962](https://github.com/DigneZzZ/subscription-page/commit/104196258e087dd4786d0cc6fa4f1b1e3f04c822))
* **frontend:** five layout presets with banner default and layout dispatcher ([4497991](https://github.com/DigneZzZ/subscription-page/commit/449799175d3045cf8b07d43657d0874ac96f5cf0))
* **frontend:** PREVIEW=1 design picker panel with env hint ([0089620](https://github.com/DigneZzZ/subscription-page/commit/0089620df0ec460ccc02294fadec52a6933a13fa))
* **frontend:** smart reset button with remaining fill, payment modal hook, devices restyle ([ad07d95](https://github.com/DigneZzZ/subscription-page/commit/ad07d95cb3ed6c4fc6df3229bfccafb9494f6986))
* **frontend:** ui-preset store initialized from #ui div ([1356f8e](https://github.com/DigneZzZ/subscription-page/commit/1356f8ea3111f7a9bdce2e6de7050315148590ef))
* **frontend:** wordmark, traffic gauge, subscription summary hook, layout i18n ([730194d](https://github.com/DigneZzZ/subscription-page/commit/730194dd7af5612d9bf8774343928a55431eb7af))
* hero as default layout + full-width hero action buttons ([9630388](https://github.com/DigneZzZ/subscription-page/commit/9630388c4285cc30f5db9952ae88a4cc95d4cbc5))
* hero becomes the default layout; hero action buttons stack full-width ([ab3b1b3](https://github.com/DigneZzZ/subscription-page/commit/ab3b1b3205639f70061e7f5ef026c0ec170f7c12))
* **hwid:** device-management card widget and multi-step modal ([6815d2b](https://github.com/DigneZzZ/subscription-page/commit/6815d2bd96d95f06041ba19b6b29a804166f26d6))
* **hwid:** device-management i18n strings ([8630f4a](https://github.com/DigneZzZ/subscription-page/commit/8630f4ad8d7322b3379c972dabc70361dd99b100))
* **hwid:** devices store and feature-flag hydration from page ([6b88b4a](https://github.com/DigneZzZ/subscription-page/commit/6b88b4a9038470cf252ec8e1fe99bdf73971e047))
* **hwid:** expose feature-enabled flag to the subscription page ([735b2b2](https://github.com/DigneZzZ/subscription-page/commit/735b2b2c12e8bcf8468f6ac05d7983ade857c2cc))
* **hwid:** fetchStatus returns management mode ([991ef7e](https://github.com/DigneZzZ/subscription-page/commit/991ef7ece47f37434fc6f748e9ac31c0e5df170a))
* **hwid:** frontend device API client ([852462d](https://github.com/DigneZzZ/subscription-page/commit/852462dcdfef240ba10e375ddc735ea515d2531d))
* **hwid:** open-mode modal flow + mode-aware widget visibility ([4cb7c1d](https://github.com/DigneZzZ/subscription-page/commit/4cb7c1d2110867cee0c20d9d0b6818b22736fabd))
* **hwid:** resume live management session on modal open with accurate TTL ([b958b40](https://github.com/DigneZzZ/subscription-page/commit/b958b40e0c954998365ba4a212ab62a673c29b05))
* pass ui preset (theme/layout/preview) to page via EJS #ui div ([bd30ffc](https://github.com/DigneZzZ/subscription-page/commit/bd30ffc6500d0702d3e7b328a345ed9a38b63e40))
* **tariffs:** allow_to_order filter + names/descriptions + per-tariff id selection ([74f705e](https://github.com/DigneZzZ/subscription-page/commit/74f705e31420112fe4437645347b9d2fcaf9085c))
* **tariffs:** grouped accordion UI, day-based plans, UTF-8 fix, descriptions with icons ([6a9d93b](https://github.com/DigneZzZ/subscription-page/commit/6a9d93b4cd98daea52d2973143211cb104e7cf7b))
* theme/layout presets (THEME_PRESET, LAYOUT_PRESET, PREVIEW) ([185768b](https://github.com/DigneZzZ/subscription-page/commit/185768b33e7164a789edaeb5b46d1aad38a9186e))


### Bug Fixes

* degenerate states of wide layouts (page cap, grid blowout, unlimited gauge, empty management) ([abff1a4](https://github.com/DigneZzZ/subscription-page/commit/abff1a40f22b67399f0aac6055b8a5505b26de20))
* **frontend:** degenerate states of wide layouts — page cap, grid blowout, unlimited gauge, empty management ([d3f5313](https://github.com/DigneZzZ/subscription-page/commit/d3f5313723ab104c91fc92a27bf165d8051b75e3))
* **frontend:** polish after cross-layout browser verification ([75e1e97](https://github.com/DigneZzZ/subscription-page/commit/75e1e973a730c4c2a258326565312e16b45232b7))
* **frontend:** show devices/reset buttons for all subscription-info variants ([af3a504](https://github.com/DigneZzZ/subscription-page/commit/af3a5042e5cedcaac91efc1db4a8d4c55bd1e1ec))
* **frontend:** single-source layout letters in preview panel ([628c37a](https://github.com/DigneZzZ/subscription-page/commit/628c37a04f8b097c4b21038e5b8e799c49ecef25))
* **frontend:** theme the leftover stock-cyan pay button, QR colors and tariff accents ([d940124](https://github.com/DigneZzZ/subscription-page/commit/d94012415bf5e7920206132ec82e6e1c35861f94))
* **frontend:** tiles layout — honest 2-column grid with full-width action rows ([8a4aa4b](https://github.com/DigneZzZ/subscription-page/commit/8a4aa4b11c1ed79b320d12aadc2f7ca28a50b5d6))
* **hwid:** catch network failure in modal probe so 'loading' never sticks ([f825348](https://github.com/DigneZzZ/subscription-page/commit/f82534845e1cfa7ffeaf1bc9b2618cb9be43013f))
* **hwid:** correct modal intro copy — code not yet sent ([7e668c3](https://github.com/DigneZzZ/subscription-page/commit/7e668c3ae1683b61185fe31cda17ca15a786855f))
* **hwid:** wire hwidData EJS var into vite build (Task 8 gap) ([c914f2f](https://github.com/DigneZzZ/subscription-page/commit/c914f2fbc95df1e8a5a082d514d0226a89e7814e))
* keep preview panel above the sticky header, plus doc/schema cleanups ([5bf112e](https://github.com/DigneZzZ/subscription-page/commit/5bf112e4ec4263a5bf756e7cba2bf398c0dfc426))
* server-rendered initial background per theme preset ([4511af4](https://github.com/DigneZzZ/subscription-page/commit/4511af4faa62fd325d0cc6bb5b58e4d49f50ef8f))
* **shm:** payment-confirm provider detection robust to form-urlencoded POST ([fed3fb3](https://github.com/DigneZzZ/subscription-page/commit/fed3fb345c4ad0bc39cc80fe53a1b05434423d11))
* **shm:** payment-confirm reads ps from query string (POST body shadowed it) ([5a48e2e](https://github.com/DigneZzZ/subscription-page/commit/5a48e2ef2d962ee1aa55ced32646b4994cebb542))
* **shm:** reset.tpl internal call uses request host; dynamic reset price (hide env stub) ([a9ce383](https://github.com/DigneZzZ/subscription-page/commit/a9ce383ee71efa5ccaaf96afa66de51caef52e32))
* **tariffs:** add days to frontend IPaymentTariff (TS build) ([f66ce12](https://github.com/DigneZzZ/subscription-page/commit/f66ce121e99a5caeba2f967c04c211132411c756))
* tiles layout composition (2-column grid, full-width buttons) ([5d85edc](https://github.com/DigneZzZ/subscription-page/commit/5d85edc268afcee4dcc8940955de10344ba562fc))

## [7.5.0](https://github.com/DigneZzZ/subscription-page/compare/v7.4.0...v7.5.0) (2026-06-24)


### Features

* **payments:** gate reset button by minimum traffic-usage percent ([eb1a9cf](https://github.com/DigneZzZ/subscription-page/commit/eb1a9cff282ed7d1fdda827976a6c7438d11df5f))

## [7.4.0](https://github.com/DigneZzZ/subscription-page/compare/v7.3.0...v7.4.0) (2026-06-24)


### Features

* **frontend:** add reset-traffic button with confirm modal ([a4ce87e](https://github.com/DigneZzZ/subscription-page/commit/a4ce87ebe31b8c9f33f3871f12b487638589ae2e))
* **payments:** expose traffic-reset price to the page via #pmt data ([4228aaf](https://github.com/DigneZzZ/subscription-page/commit/4228aaf2a9e4e9de3f9bab5c97367941db188e36))
* **payments:** hydrate traffic-reset config into the payment store ([835e778](https://github.com/DigneZzZ/subscription-page/commit/835e7781613350728cdb86c663a44165ec227571))

## [7.3.0](https://github.com/DigneZzZ/subscription-page/compare/v7.2.1...v7.3.0) (2026-06-20)


### Features

* add branding configuration to subscription page and update related components ([66807f8](https://github.com/DigneZzZ/subscription-page/commit/66807f8ca7defb300b7c36c28717647bcd56ff32))
* add Chatwoot live chat widget integration ([e8ce42d](https://github.com/DigneZzZ/subscription-page/commit/e8ce42de4442c72a8e1a8ab8b2d970b148b38557))
* add configurable raw keys display option ([b6cadff](https://github.com/DigneZzZ/subscription-page/commit/b6cadffffa9481ca7969fd45ba8ee4a499be78cd))
* add french translation ([b19725f](https://github.com/DigneZzZ/subscription-page/commit/b19725fd11bc03aedfc8696f53c52d3b23ad4167))
* add HappCryptoLink template variable, add  support for `HideGetLinkButton` ([4e9ab14](https://github.com/DigneZzZ/subscription-page/commit/4e9ab14c3164249612e93cbad789440eb330e95f))
* add MARZBAN_LEGACY_DROP_REVOKED_SUBSCRIPTIONS configuration ([e2d9ca9](https://github.com/DigneZzZ/subscription-page/commit/e2d9ca92e49e644d3731d75129d49f66cdcd0d2a))
* add new font families to theme and index.html ([a702b21](https://github.com/DigneZzZ/subscription-page/commit/a702b21adb86c397e13df8416609d2400b263662))
* add payment button to subscription page ([734768f](https://github.com/DigneZzZ/subscription-page/commit/734768f24d1b231c1ae41eaec6cb1ae152a6493e))
* add support for androidTV and appleTV platforms in app configuration and installation guide ([ff241d7](https://github.com/DigneZzZ/subscription-page/commit/ff241d7348899bb65ae56c551aac775d4562373b))
* add SUPPORT_EMAIL env and mailto support button ([b55246b](https://github.com/DigneZzZ/subscription-page/commit/b55246b6fd511196aff7e2ac7ab535a69049316d))
* app icons ([8780fbc](https://github.com/DigneZzZ/subscription-page/commit/8780fbc0892656f54affc67c81c9d1c6fd71674a))
* dynamic subpage configuration ([60e3c4d](https://github.com/DigneZzZ/subscription-page/commit/60e3c4df7aa28339b71984b100d1d462f58e1b29))
* enhance loading screen ([57994d6](https://github.com/DigneZzZ/subscription-page/commit/57994d6947e7d11ce0287b751a21f3bc986bd1cc))
* enhance subscription page configuration ([a5d98cf](https://github.com/DigneZzZ/subscription-page/commit/a5d98cf591757c961cb6f2bc53cad205ecdf03d1))
* enhance subscription page design ([3114fc9](https://github.com/DigneZzZ/subscription-page/commit/3114fc9a429118aca637c8e95a4c0952179366ac))
* enhance support link rendering in SubscriptionLinkWidget with platform-specific icons ([0d3e4d1](https://github.com/DigneZzZ/subscription-page/commit/0d3e4d19d4745bfc047dcf0e9c9399d5a03a07df))
* forward CardLink bill_id to payment webhook ([7d7068f](https://github.com/DigneZzZ/subscription-page/commit/7d7068ff6a82014a82299a15b982840728ca5a08))
* HMAC identity verification for Chatwoot widget ([bc2ce96](https://github.com/DigneZzZ/subscription-page/commit/bc2ce96d57d2927e619d0c95522cd4cba9565a23))
* implement migration for old app configuration format in MainPageConnector ([e5d2d82](https://github.com/DigneZzZ/subscription-page/commit/e5d2d82136c331feef812defdf1e25da70f9507c))
* nestjs backend ([4689df0](https://github.com/DigneZzZ/subscription-page/commit/4689df077405f106a6f1c9487f206c2b8716fc76))
* NestJS backend (move from Go) ([ed255c0](https://github.com/DigneZzZ/subscription-page/commit/ed255c017d2e13cdddcfd167cf4fc99ecae6b1c3))


### Bug Fixes

* adjust transition duration ([875235a](https://github.com/DigneZzZ/subscription-page/commit/875235aa08d0fa53c3a6118f3947270de57caa33))
* card styling ([934344f](https://github.com/DigneZzZ/subscription-page/commit/934344fb484356b3435ecfc722527117ec64ab3f))
* change card hover style ([612df87](https://github.com/DigneZzZ/subscription-page/commit/612df87550f8dea15ef58a3c3dd456c27e3bbae0))
* correct Russian translation for TUN Mode description in app-config.json ([04a1c07](https://github.com/DigneZzZ/subscription-page/commit/04a1c0784b4b3f5fe91b7ba269e7a26c68ace8bf))
* dayjs ([ea435b9](https://github.com/DigneZzZ/subscription-page/commit/ea435b9e3554d5b1e6fca5cbc18df267cfef1f90))
* do not filter input headers ([dabcfd7](https://github.com/DigneZzZ/subscription-page/commit/dabcfd7b3c0abf5f1898a6f2cd23c827bae13c97))
* enhance text formatting in installation guide widget for better readability ([28e3bc5](https://github.com/DigneZzZ/subscription-page/commit/28e3bc572d8127865a226ac43e537fc95d1eea03))
* ensure rootDiv dataset is cleared after error handling in RootLayout ([a6faf21](https://github.com/DigneZzZ/subscription-page/commit/a6faf21f129bca412ebaf2f7a45f3542534451b3))
* fail fast on invalid subpage config during startup ([b929ba6](https://github.com/DigneZzZ/subscription-page/commit/b929ba6098cbd774abb62b130b2e824bb96e5ac1))
* increase width of device selection input in InstallationGuideWidget ([3b3dce7](https://github.com/DigneZzZ/subscription-page/commit/3b3dce7eaaf5f6670311b1313949f69acea85dfe))
* ios26 ([edd2597](https://github.com/DigneZzZ/subscription-page/commit/edd2597ac2b5b24f0b2eddc5beda54adc056b3d7))
* lint ([0c72ad7](https://github.com/DigneZzZ/subscription-page/commit/0c72ad7a6f7373252c8571896c83aa3d0d401d51))
* lint ([cd57186](https://github.com/DigneZzZ/subscription-page/commit/cd571865b397b870957dee5d63be71dbfd3473f0))
* NativeSelect on Windows ([62ad429](https://github.com/DigneZzZ/subscription-page/commit/62ad4298123215e38d791a49abd483d5dae3b46c))
* pass supportEmail through vite-plugin-ejs build context ([92a8fe9](https://github.com/DigneZzZ/subscription-page/commit/92a8fe9291d4afb8d34e99e9b4f407f3fa622485))
* **payment:** create orders only on user click, not on page render ([a97acc4](https://github.com/DigneZzZ/subscription-page/commit/a97acc451a6d99068d3c0f49060c19bfd9979ecf))
* platform and app selection logic ([caafa85](https://github.com/DigneZzZ/subscription-page/commit/caafa85e38362526496138165ac31d4a0acec6d6))
* prevent rendering of LanguagePicker when only one locale is available ([d312918](https://github.com/DigneZzZ/subscription-page/commit/d312918cba1c7a38a72e71356dc679ad45669451))
* read user from subscriptionData.response.user ([2d3c49b](https://github.com/DigneZzZ/subscription-page/commit/2d3c49b3ff3318d14b07ded98ac28b24fa0df518))
* remove unnecessary offsetScrollbars prop from ScrollArea in RawKeysWidget ([be37d4c](https://github.com/DigneZzZ/subscription-page/commit/be37d4c5c6ad89dc18f34b8e1ab7513ec67636d8))
* sync zh translations to new format ([e3f6575](https://github.com/DigneZzZ/subscription-page/commit/e3f65750833ae646f06443c4c26b9aeccea2cade))
* ui ([b75d694](https://github.com/DigneZzZ/subscription-page/commit/b75d694cd1f4da41bec7be340e3a1c095c78789d))
* update Discord support link to use the correct domain in SubscriptionLinkWidget ([1bf4c4e](https://github.com/DigneZzZ/subscription-page/commit/1bf4c4e0f2b84976cb9e7196eddfc7cd94a9b34d))
* update documentation links and logo URL ([46964c7](https://github.com/DigneZzZ/subscription-page/commit/46964c7f881d8682032f6946791d3f708abf0085))
* update logo dimensions ([061df9b](https://github.com/DigneZzZ/subscription-page/commit/061df9b0839aac92b8ac469230c30360161977d1))
* update Russian translation for QR code import instruction ([cb0217b](https://github.com/DigneZzZ/subscription-page/commit/cb0217bacfe8580b577309fc2ac93d18482b3b13))
* update Russian translations for subscription-related terms ([52a8320](https://github.com/DigneZzZ/subscription-page/commit/52a83204637fe715ad84a036523bbb29c0a90028))
* update subscription URL handling and version bump ([24011c6](https://github.com/DigneZzZ/subscription-page/commit/24011c6223f43787a9117ba6b2fe15b3f221ab6d))
* update TypeScript paths and enhance Vite configuration ([ef38481](https://github.com/DigneZzZ/subscription-page/commit/ef384811f43f8c1a2a047f24461eff6397658f61))

## [7.2.1](https://github.com/DigneZzZ/subscription-page/compare/v7.2.0...v7.2.1) (2026-05-14)


### Bug Fixes

* **payment:** create orders only on user click, not on page render ([a97acc4](https://github.com/DigneZzZ/subscription-page/commit/a97acc451a6d99068d3c0f49060c19bfd9979ecf))

## [7.2.0](https://github.com/DigneZzZ/subscription-page/compare/v7.1.8...v7.2.0) (2026-05-06)


### Features

* add branding configuration to subscription page and update related components ([66807f8](https://github.com/DigneZzZ/subscription-page/commit/66807f8ca7defb300b7c36c28717647bcd56ff32))
* add Chatwoot live chat widget integration ([e8ce42d](https://github.com/DigneZzZ/subscription-page/commit/e8ce42de4442c72a8e1a8ab8b2d970b148b38557))
* add configurable raw keys display option ([b6cadff](https://github.com/DigneZzZ/subscription-page/commit/b6cadffffa9481ca7969fd45ba8ee4a499be78cd))
* add french translation ([b19725f](https://github.com/DigneZzZ/subscription-page/commit/b19725fd11bc03aedfc8696f53c52d3b23ad4167))
* add HappCryptoLink template variable, add  support for `HideGetLinkButton` ([4e9ab14](https://github.com/DigneZzZ/subscription-page/commit/4e9ab14c3164249612e93cbad789440eb330e95f))
* add MARZBAN_LEGACY_DROP_REVOKED_SUBSCRIPTIONS configuration ([e2d9ca9](https://github.com/DigneZzZ/subscription-page/commit/e2d9ca92e49e644d3731d75129d49f66cdcd0d2a))
* add new font families to theme and index.html ([a702b21](https://github.com/DigneZzZ/subscription-page/commit/a702b21adb86c397e13df8416609d2400b263662))
* add payment button to subscription page ([734768f](https://github.com/DigneZzZ/subscription-page/commit/734768f24d1b231c1ae41eaec6cb1ae152a6493e))
* add support for androidTV and appleTV platforms in app configuration and installation guide ([ff241d7](https://github.com/DigneZzZ/subscription-page/commit/ff241d7348899bb65ae56c551aac775d4562373b))
* add SUPPORT_EMAIL env and mailto support button ([b55246b](https://github.com/DigneZzZ/subscription-page/commit/b55246b6fd511196aff7e2ac7ab535a69049316d))
* app icons ([8780fbc](https://github.com/DigneZzZ/subscription-page/commit/8780fbc0892656f54affc67c81c9d1c6fd71674a))
* dynamic subpage configuration ([60e3c4d](https://github.com/DigneZzZ/subscription-page/commit/60e3c4df7aa28339b71984b100d1d462f58e1b29))
* enhance loading screen ([57994d6](https://github.com/DigneZzZ/subscription-page/commit/57994d6947e7d11ce0287b751a21f3bc986bd1cc))
* enhance subscription page configuration ([a5d98cf](https://github.com/DigneZzZ/subscription-page/commit/a5d98cf591757c961cb6f2bc53cad205ecdf03d1))
* enhance subscription page design ([3114fc9](https://github.com/DigneZzZ/subscription-page/commit/3114fc9a429118aca637c8e95a4c0952179366ac))
* enhance support link rendering in SubscriptionLinkWidget with platform-specific icons ([0d3e4d1](https://github.com/DigneZzZ/subscription-page/commit/0d3e4d19d4745bfc047dcf0e9c9399d5a03a07df))
* forward CardLink bill_id to payment webhook ([7d7068f](https://github.com/DigneZzZ/subscription-page/commit/7d7068ff6a82014a82299a15b982840728ca5a08))
* HMAC identity verification for Chatwoot widget ([bc2ce96](https://github.com/DigneZzZ/subscription-page/commit/bc2ce96d57d2927e619d0c95522cd4cba9565a23))
* implement migration for old app configuration format in MainPageConnector ([e5d2d82](https://github.com/DigneZzZ/subscription-page/commit/e5d2d82136c331feef812defdf1e25da70f9507c))
* nestjs backend ([4689df0](https://github.com/DigneZzZ/subscription-page/commit/4689df077405f106a6f1c9487f206c2b8716fc76))
* NestJS backend (move from Go) ([ed255c0](https://github.com/DigneZzZ/subscription-page/commit/ed255c017d2e13cdddcfd167cf4fc99ecae6b1c3))


### Bug Fixes

* adjust transition duration ([875235a](https://github.com/DigneZzZ/subscription-page/commit/875235aa08d0fa53c3a6118f3947270de57caa33))
* card styling ([934344f](https://github.com/DigneZzZ/subscription-page/commit/934344fb484356b3435ecfc722527117ec64ab3f))
* change card hover style ([612df87](https://github.com/DigneZzZ/subscription-page/commit/612df87550f8dea15ef58a3c3dd456c27e3bbae0))
* correct Russian translation for TUN Mode description in app-config.json ([04a1c07](https://github.com/DigneZzZ/subscription-page/commit/04a1c0784b4b3f5fe91b7ba269e7a26c68ace8bf))
* dayjs ([ea435b9](https://github.com/DigneZzZ/subscription-page/commit/ea435b9e3554d5b1e6fca5cbc18df267cfef1f90))
* do not filter input headers ([dabcfd7](https://github.com/DigneZzZ/subscription-page/commit/dabcfd7b3c0abf5f1898a6f2cd23c827bae13c97))
* enhance text formatting in installation guide widget for better readability ([28e3bc5](https://github.com/DigneZzZ/subscription-page/commit/28e3bc572d8127865a226ac43e537fc95d1eea03))
* ensure rootDiv dataset is cleared after error handling in RootLayout ([a6faf21](https://github.com/DigneZzZ/subscription-page/commit/a6faf21f129bca412ebaf2f7a45f3542534451b3))
* fail fast on invalid subpage config during startup ([b929ba6](https://github.com/DigneZzZ/subscription-page/commit/b929ba6098cbd774abb62b130b2e824bb96e5ac1))
* increase width of device selection input in InstallationGuideWidget ([3b3dce7](https://github.com/DigneZzZ/subscription-page/commit/3b3dce7eaaf5f6670311b1313949f69acea85dfe))
* ios26 ([edd2597](https://github.com/DigneZzZ/subscription-page/commit/edd2597ac2b5b24f0b2eddc5beda54adc056b3d7))
* lint ([0c72ad7](https://github.com/DigneZzZ/subscription-page/commit/0c72ad7a6f7373252c8571896c83aa3d0d401d51))
* lint ([cd57186](https://github.com/DigneZzZ/subscription-page/commit/cd571865b397b870957dee5d63be71dbfd3473f0))
* NativeSelect on Windows ([62ad429](https://github.com/DigneZzZ/subscription-page/commit/62ad4298123215e38d791a49abd483d5dae3b46c))
* pass supportEmail through vite-plugin-ejs build context ([92a8fe9](https://github.com/DigneZzZ/subscription-page/commit/92a8fe9291d4afb8d34e99e9b4f407f3fa622485))
* platform and app selection logic ([caafa85](https://github.com/DigneZzZ/subscription-page/commit/caafa85e38362526496138165ac31d4a0acec6d6))
* prevent rendering of LanguagePicker when only one locale is available ([d312918](https://github.com/DigneZzZ/subscription-page/commit/d312918cba1c7a38a72e71356dc679ad45669451))
* read user from subscriptionData.response.user ([2d3c49b](https://github.com/DigneZzZ/subscription-page/commit/2d3c49b3ff3318d14b07ded98ac28b24fa0df518))
* remove unnecessary offsetScrollbars prop from ScrollArea in RawKeysWidget ([be37d4c](https://github.com/DigneZzZ/subscription-page/commit/be37d4c5c6ad89dc18f34b8e1ab7513ec67636d8))
* sync zh translations to new format ([e3f6575](https://github.com/DigneZzZ/subscription-page/commit/e3f65750833ae646f06443c4c26b9aeccea2cade))
* ui ([b75d694](https://github.com/DigneZzZ/subscription-page/commit/b75d694cd1f4da41bec7be340e3a1c095c78789d))
* update Discord support link to use the correct domain in SubscriptionLinkWidget ([1bf4c4e](https://github.com/DigneZzZ/subscription-page/commit/1bf4c4e0f2b84976cb9e7196eddfc7cd94a9b34d))
* update documentation links and logo URL ([46964c7](https://github.com/DigneZzZ/subscription-page/commit/46964c7f881d8682032f6946791d3f708abf0085))
* update logo dimensions ([061df9b](https://github.com/DigneZzZ/subscription-page/commit/061df9b0839aac92b8ac469230c30360161977d1))
* update Russian translation for QR code import instruction ([cb0217b](https://github.com/DigneZzZ/subscription-page/commit/cb0217bacfe8580b577309fc2ac93d18482b3b13))
* update Russian translations for subscription-related terms ([52a8320](https://github.com/DigneZzZ/subscription-page/commit/52a83204637fe715ad84a036523bbb29c0a90028))
* update subscription URL handling and version bump ([24011c6](https://github.com/DigneZzZ/subscription-page/commit/24011c6223f43787a9117ba6b2fe15b3f221ab6d))
* update TypeScript paths and enhance Vite configuration ([ef38481](https://github.com/DigneZzZ/subscription-page/commit/ef384811f43f8c1a2a047f24461eff6397658f61))
