const CURRENCY_SYMBOLS: Record<string, string> = {
    RUB: '₽',
    USD: '$',
    EUR: '€',
    UAH: '₴',
    KZT: '₸',
    BYN: 'Br',
    GBP: '£',
    TRY: '₺'
}

export function formatAmount(amount: number, currency: string): string {
    const symbol = CURRENCY_SYMBOLS[currency] ?? currency
    return `${amount} ${symbol}`
}
