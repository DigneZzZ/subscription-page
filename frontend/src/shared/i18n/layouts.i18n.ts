export interface ILayoutStrings {
    alternative: string
    indefinite: string
    indefiniteSubscription: string
    left: string
    leftOf: (limit: string) => string
    management: string
    perDays: (days: number) => string
    platform: string
    recommended: string
    renew: string
    reserveHeadline: (pct: number) => string
    resetShort: string
    subscriptionLink: string
    subscriptionUntil: (date: string) => string
    trafficLeftCaption: string
    unlimited: string
    unlimitedTraffic: string
}

type Lang = 'en' | 'fa' | 'fr' | 'ru' | 'zh'

const STRINGS: Record<Lang, ILayoutStrings> = {
    en: {
        alternative: 'Alternative',
        indefinite: 'Indefinite',
        indefiniteSubscription: 'Indefinite subscription',
        left: 'left',
        leftOf: (limit) => `of ${limit}`,
        management: 'Management',
        perDays: (days) => `in ${days} d.`,
        platform: 'Platform',
        recommended: 'Recommended',
        renew: 'Renew subscription',
        reserveHeadline: (pct) => `${pct}% in reserve`,
        resetShort: 'Reset',
        trafficLeftCaption: 'traffic left',
        subscriptionLink: 'Subscription link',
        subscriptionUntil: (date) => `Subscription until ${date}`,
        unlimited: 'Unlimited',
        unlimitedTraffic: 'Unlimited traffic'
    },
    ru: {
        alternative: 'Альтернатива',
        indefinite: 'Бессрочно',
        indefiniteSubscription: 'Бессрочная подписка',
        left: 'осталось',
        leftOf: (limit) => `из ${limit}`,
        management: 'Управление',
        perDays: (days) => `через ${days} дн.`,
        platform: 'Платформа',
        recommended: 'Рекомендуем',
        renew: 'Продлить подписку',
        reserveHeadline: (pct) => `${pct}% в запасе`,
        resetShort: 'Сбросить',
        trafficLeftCaption: 'трафика осталось',
        subscriptionLink: 'Ссылка на подписку',
        subscriptionUntil: (date) => `Подписка до ${date}`,
        unlimited: 'Безлимит',
        unlimitedTraffic: 'Безлимитный трафик'
    },
    fa: {
        alternative: 'جایگزین',
        indefinite: 'نامحدود',
        indefiniteSubscription: 'اشتراک دائمی',
        left: 'باقی‌مانده',
        leftOf: (limit) => `از ${limit}`,
        management: 'مدیریت',
        perDays: (days) => `تا ${days} روز`,
        platform: 'پلتفرم',
        recommended: 'پیشنهادی',
        renew: 'تمدید اشتراک',
        reserveHeadline: (pct) => `${pct}٪ ذخیره`,
        resetShort: 'بازنشانی',
        trafficLeftCaption: 'ترافیک باقی‌مانده',
        subscriptionLink: 'لینک اشتراک',
        subscriptionUntil: (date) => `اشتراک تا ${date}`,
        unlimited: 'نامحدود',
        unlimitedTraffic: 'ترافیک نامحدود'
    },
    fr: {
        alternative: 'Alternative',
        indefinite: 'Illimitée',
        indefiniteSubscription: 'Abonnement sans limite de durée',
        left: 'restant',
        leftOf: (limit) => `sur ${limit}`,
        management: 'Gestion',
        perDays: (days) => `dans ${days} j`,
        platform: 'Plateforme',
        recommended: 'Recommandé',
        renew: "Renouveler l'abonnement",
        reserveHeadline: (pct) => `${pct}% en réserve`,
        resetShort: 'Réinitialiser',
        trafficLeftCaption: 'de trafic restant',
        subscriptionLink: "Lien d'abonnement",
        subscriptionUntil: (date) => `Abonnement jusqu'au ${date}`,
        unlimited: 'Illimité',
        unlimitedTraffic: 'Trafic illimité'
    },
    zh: {
        alternative: '备选',
        indefinite: '永久',
        indefiniteSubscription: '长期有效订阅',
        left: '剩余',
        leftOf: (limit) => `共 ${limit}`,
        management: '管理',
        perDays: (days) => `${days} 天后`,
        platform: '平台',
        recommended: '推荐',
        renew: '续订订阅',
        reserveHeadline: (pct) => `剩余 ${pct}%`,
        resetShort: '重置',
        trafficLeftCaption: '剩余流量',
        subscriptionLink: '订阅链接',
        subscriptionUntil: (date) => `订阅至 ${date}`,
        unlimited: '不限量',
        unlimitedTraffic: '不限流量'
    }
}

export function getLayoutStrings(lang: string): ILayoutStrings {
    return STRINGS[lang as Lang] ?? STRINGS.en
}
