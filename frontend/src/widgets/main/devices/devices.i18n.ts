type Lang = 'en' | 'fa' | 'fr' | 'ru' | 'zh'

export interface IDeviceStrings {
    added: string
    cancel: string
    close: string
    codeSentTo: string
    confirmDeleteAllBody: string
    confirmDeleteAllTitle: string
    delete: string
    deleteAll: string
    devicesCount: (n: number, limit: null | number) => string
    empty: string
    enterCode: string
    errorBlocked: string
    errorGeneric: string
    errorNotLinked: string
    errorTgSend: string
    linkTelegramHint: string
    manage: string
    resend: (sec: number) => string
    sendCode: string
    sendCodePrompt: string
    sessionEndsIn: (mmss: string) => string
    title: string
    verify: string
}

const STRINGS: Record<Lang, IDeviceStrings> = {
    en: {
        title: 'Devices',
        manage: 'Manage devices',
        linkTelegramHint: 'Link Telegram to your subscription to manage devices',
        devicesCount: (n, limit) => (limit ? `${n} of ${limit} devices` : `${n} devices`),
        sendCode: 'Send code to Telegram',
        sendCodePrompt: "We'll send a 6-digit code to your Telegram to confirm it's you.",
        codeSentTo: 'We sent a 6-digit code to your Telegram.',
        enterCode: 'Enter the code',
        verify: 'Confirm',
        resend: (sec) => (sec > 0 ? `Resend in ${sec}s` : 'Resend code'),
        sessionEndsIn: (mmss) => `Session ends in ${mmss}`,
        delete: 'Remove',
        deleteAll: 'Remove all devices',
        confirmDeleteAllTitle: 'Remove all devices',
        confirmDeleteAllBody: 'Remove every device from this subscription?',
        empty: 'No devices',
        added: 'Added',
        errorGeneric: 'Something went wrong. Try again later.',
        errorBlocked: 'Too many attempts. Try again in 10 minutes.',
        errorNotLinked: 'Telegram is not linked to this subscription.',
        errorTgSend: 'Could not send the code. Try again later.',
        close: 'Close',
        cancel: 'Cancel'
    },
    ru: {
        title: 'Устройства',
        manage: 'Управлять устройствами',
        linkTelegramHint: 'Привяжите Telegram к подписке, чтобы управлять устройствами',
        devicesCount: (n, limit) => (limit ? `${n} из ${limit} устройств` : `${n} устройств`),
        sendCode: 'Отправить код в Telegram',
        sendCodePrompt: 'Отправим 6-значный код в ваш Telegram для подтверждения.',
        codeSentTo: 'Мы отправили 6-значный код в ваш Telegram.',
        enterCode: 'Введите код',
        verify: 'Подтвердить',
        resend: (sec) => (sec > 0 ? `Повтор через ${sec}с` : 'Отправить код повторно'),
        sessionEndsIn: (mmss) => `Сессия завершится через ${mmss}`,
        delete: 'Удалить',
        deleteAll: 'Удалить все устройства',
        confirmDeleteAllTitle: 'Удаление всех устройств',
        confirmDeleteAllBody: 'Удалить все устройства из этой подписки?',
        empty: 'Устройств нет',
        added: 'Добавлено',
        errorGeneric: 'Что-то пошло не так. Попробуйте позже.',
        errorBlocked: 'Слишком много попыток. Повторите через 10 минут.',
        errorNotLinked: 'Telegram не привязан к этой подписке.',
        errorTgSend: 'Не удалось отправить код. Попробуйте позже.',
        close: 'Закрыть',
        cancel: 'Отмена'
    },
    zh: {
        title: '设备',
        manage: '管理设备',
        linkTelegramHint: '请将 Telegram 绑定到订阅以管理设备',
        devicesCount: (n, limit) => (limit ? `${n} / ${limit} 台设备` : `${n} 台设备`),
        sendCode: '发送验证码到 Telegram',
        sendCodePrompt: '我们将向您的 Telegram 发送 6 位验证码以确认您的身份。',
        codeSentTo: '我们已向您的 Telegram 发送 6 位验证码。',
        enterCode: '输入验证码',
        verify: '确认',
        resend: (sec) => (sec > 0 ? `${sec} 秒后重发` : '重新发送验证码'),
        sessionEndsIn: (mmss) => `会话将在 ${mmss} 后结束`,
        delete: '移除',
        deleteAll: '移除所有设备',
        confirmDeleteAllTitle: '移除所有设备',
        confirmDeleteAllBody: '移除此订阅的所有设备？',
        empty: '没有设备',
        added: '添加于',
        errorGeneric: '出错了，请稍后再试。',
        errorBlocked: '尝试次数过多，请 10 分钟后再试。',
        errorNotLinked: '此订阅未绑定 Telegram。',
        errorTgSend: '无法发送验证码，请稍后再试。',
        close: '关闭',
        cancel: '取消'
    },
    fa: {
        title: 'دستگاه‌ها',
        manage: 'مدیریت دستگاه‌ها',
        linkTelegramHint: 'برای مدیریت دستگاه‌ها تلگرام را به اشتراک خود متصل کنید',
        devicesCount: (n, limit) => (limit ? `${n} از ${limit} دستگاه` : `${n} دستگاه`),
        sendCode: 'ارسال کد به تلگرام',
        sendCodePrompt: 'برای تأیید هویت، کد ۶ رقمی به تلگرام شما ارسال می‌کنیم.',
        codeSentTo: 'کد ۶ رقمی به تلگرام شما ارسال شد.',
        enterCode: 'کد را وارد کنید',
        verify: 'تأیید',
        resend: (sec) => (sec > 0 ? `ارسال مجدد در ${sec} ثانیه` : 'ارسال مجدد کد'),
        sessionEndsIn: (mmss) => `جلسه در ${mmss} پایان می‌یابد`,
        delete: 'حذف',
        deleteAll: 'حذف همه دستگاه‌ها',
        confirmDeleteAllTitle: 'حذف همه دستگاه‌ها',
        confirmDeleteAllBody: 'همه دستگاه‌ها از این اشتراک حذف شوند؟',
        empty: 'دستگاهی نیست',
        added: 'افزوده‌شده',
        errorGeneric: 'مشکلی پیش آمد. بعداً دوباره تلاش کنید.',
        errorBlocked: 'تلاش بیش از حد. ۱۰ دقیقه دیگر تلاش کنید.',
        errorNotLinked: 'تلگرام به این اشتراک متصل نیست.',
        errorTgSend: 'ارسال کد ممکن نشد. بعداً تلاش کنید.',
        close: 'بستن',
        cancel: 'لغو'
    },
    fr: {
        title: 'Appareils',
        manage: 'Gérer les appareils',
        linkTelegramHint: 'Liez Telegram à votre abonnement pour gérer les appareils',
        devicesCount: (n, limit) => (limit ? `${n} sur ${limit} appareils` : `${n} appareils`),
        sendCode: 'Envoyer le code sur Telegram',
        sendCodePrompt: 'Nous enverrons un code à 6 chiffres sur votre Telegram pour confirmer.',
        codeSentTo: 'Nous avons envoyé un code à 6 chiffres sur votre Telegram.',
        enterCode: 'Saisissez le code',
        verify: 'Confirmer',
        resend: (sec) => (sec > 0 ? `Renvoyer dans ${sec}s` : 'Renvoyer le code'),
        sessionEndsIn: (mmss) => `La session se termine dans ${mmss}`,
        delete: 'Supprimer',
        deleteAll: 'Supprimer tous les appareils',
        confirmDeleteAllTitle: 'Supprimer tous les appareils',
        confirmDeleteAllBody: 'Supprimer tous les appareils de cet abonnement ?',
        empty: 'Aucun appareil',
        added: 'Ajouté',
        errorGeneric: 'Une erreur est survenue. Réessayez plus tard.',
        errorBlocked: 'Trop de tentatives. Réessayez dans 10 minutes.',
        errorNotLinked: "Telegram n'est pas lié à cet abonnement.",
        errorTgSend: "Impossible d'envoyer le code. Réessayez plus tard.",
        close: 'Fermer',
        cancel: 'Annuler'
    }
}

export function getDeviceStrings(lang: string): IDeviceStrings {
    return STRINGS[lang as Lang] ?? STRINGS.en
}
