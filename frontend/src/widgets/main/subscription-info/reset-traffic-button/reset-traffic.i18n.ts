type Lang = 'en' | 'fa' | 'fr' | 'ru' | 'zh'

export interface IResetStrings {
    cancel: string
    confirmBody: (price: string) => string
    confirmTitle: string
    pay: string
    resetTraffic: string
}

const STRINGS: Record<Lang, IResetStrings> = {
    en: {
        resetTraffic: 'Reset traffic',
        confirmTitle: 'Reset traffic',
        confirmBody: (price) => `Reset your traffic for ${price}? This is a paid action.`,
        pay: 'Pay',
        cancel: 'Cancel'
    },
    ru: {
        resetTraffic: 'Сбросить трафик',
        confirmTitle: 'Сброс трафика',
        confirmBody: (price) => `Сбросить трафик за ${price}? Действие платное.`,
        pay: 'Оплатить',
        cancel: 'Отмена'
    },
    zh: {
        resetTraffic: '重置流量',
        confirmTitle: '重置流量',
        confirmBody: (price) => `支付 ${price} 重置流量？这是一项付费操作。`,
        pay: '支付',
        cancel: '取消'
    },
    fa: {
        resetTraffic: 'بازنشانی ترافیک',
        confirmTitle: 'بازنشانی ترافیک',
        confirmBody: (price) =>
            `ترافیک خود را با پرداخت ${price} بازنشانی می‌کنید؟ این عملیات هزینه دارد.`,
        pay: 'پرداخت',
        cancel: 'لغو'
    },
    fr: {
        resetTraffic: 'Réinitialiser le trafic',
        confirmTitle: 'Réinitialiser le trafic',
        confirmBody: (price) => `Réinitialiser votre trafic pour ${price} ? Cette action est payante.`,
        pay: 'Payer',
        cancel: 'Annuler'
    }
}

export function getResetStrings(lang: string): IResetStrings {
    return STRINGS[lang as Lang] ?? STRINGS.en
}
