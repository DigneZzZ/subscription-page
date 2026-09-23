type Lang = 'en' | 'fa' | 'fr' | 'ru' | 'zh'

export interface ISupportLauncherStrings {
    close: string
    support: string
    unreadSuffix: string
}

const STRINGS: Record<Lang, ISupportLauncherStrings> = {
    en: { support: 'Support', close: 'Close chat', unreadSuffix: ', new message' },
    ru: { support: 'Поддержка', close: 'Закрыть чат', unreadSuffix: ', новое сообщение' },
    zh: { support: '客服', close: '关闭聊天', unreadSuffix: '，新消息' },
    fa: { support: 'پشتیبانی', close: 'بستن گفتگو', unreadSuffix: '، پیام جدید' },
    fr: { support: 'Support', close: 'Fermer le chat', unreadSuffix: ', nouveau message' }
}

export const getSupportLauncherStrings = (lang: string): ISupportLauncherStrings =>
    STRINGS[lang as Lang] ?? STRINGS.en
