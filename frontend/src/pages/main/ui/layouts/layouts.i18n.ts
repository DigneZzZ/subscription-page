export interface ILayoutStrings {
    alternative: string
    devices: string
    indefinite: string
    installation: string
    left: string
    leftOf: (limit: string) => string
    management: string
    perDays: (days: number) => string
    platform: string
    recommended: string
    renew: string
    reset: string
    subscriptionLink: string
    subscriptionUntil: (date: string) => string
    unlimited: string
}

type Lang = 'en' | 'fa' | 'fr' | 'ru' | 'zh'

const STRINGS: Record<Lang, ILayoutStrings> = {
    en: {
        alternative: 'Alternative',
        devices: 'Devices',
        indefinite: 'Indefinite',
        installation: 'Installation',
        left: 'left',
        leftOf: (limit) => `of ${limit}`,
        management: 'Management',
        perDays: (days) => `in ${days} d.`,
        platform: 'Platform',
        recommended: 'Recommended',
        renew: 'Renew subscription',
        reset: 'Reset',
        subscriptionLink: 'Subscription link',
        subscriptionUntil: (date) => `Subscription until ${date}`,
        unlimited: 'Unlimited'
    },
    ru: {
        alternative: 'Альтернатива',
        devices: 'Устройства',
        indefinite: 'Бессрочно',
        installation: 'Установка',
        left: 'осталось',
        leftOf: (limit) => `из ${limit}`,
        management: 'Управление',
        perDays: (days) => `через ${days} дн.`,
        platform: 'Платформа',
        recommended: 'Рекомендуем',
        renew: 'Продлить подписку',
        reset: 'Сброс',
        subscriptionLink: 'Ссылка на подписку',
        subscriptionUntil: (date) => `Подписка до ${date}`,
        unlimited: 'Безлимит'
    },
    fa: {
        alternative: 'جایگزین',
        devices: 'دستگاه‌ها',
        indefinite: 'نامحدود',
        installation: 'نصب',
        left: 'باقی‌مانده',
        leftOf: (limit) => `از ${limit}`,
        management: 'مدیریت',
        perDays: (days) => `تا ${days} روز`,
        platform: 'پلتفرم',
        recommended: 'پیشنهادی',
        renew: 'تمدید اشتراک',
        reset: 'بازنشانی',
        subscriptionLink: 'لینک اشتراک',
        subscriptionUntil: (date) => `اشتراک تا ${date}`,
        unlimited: 'نامحدود'
    },
    fr: {
        alternative: 'Alternative',
        devices: 'Appareils',
        indefinite: 'Illimitée',
        installation: 'Installation',
        left: 'restant',
        leftOf: (limit) => `sur ${limit}`,
        management: 'Gestion',
        perDays: (days) => `dans ${days} j`,
        platform: 'Plateforme',
        recommended: 'Recommandé',
        renew: "Renouveler l'abonnement",
        reset: 'Réinitialiser',
        subscriptionLink: "Lien d'abonnement",
        subscriptionUntil: (date) => `Abonnement jusqu'au ${date}`,
        unlimited: 'Illimité'
    },
    zh: {
        alternative: '备选',
        devices: '设备',
        indefinite: '永久',
        installation: '安装',
        left: '剩余',
        leftOf: (limit) => `共 ${limit}`,
        management: '管理',
        perDays: (days) => `${days} 天后`,
        platform: '平台',
        recommended: '推荐',
        renew: '续订订阅',
        reset: '重置',
        subscriptionLink: '订阅链接',
        subscriptionUntil: (date) => `订阅至 ${date}`,
        unlimited: '不限量'
    }
}

export function getLayoutStrings(lang: string): ILayoutStrings {
    return STRINGS[lang as Lang] ?? STRINGS.en
}
