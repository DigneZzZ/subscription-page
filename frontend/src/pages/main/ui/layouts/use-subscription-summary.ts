import { useSubscription } from '@entities/subscription-info-store'
import { formatBytes } from '@shared/utils'

export interface ISubscriptionSummary {
    daysLeft: number
    expiresAt: Date
    isActive: boolean
    isIndefinite: boolean
    isUnlimited: boolean
    remainingBytes: number
    remainingLabel: string
    remainingPercent: number
    trafficLimit: string
    trafficUsed: string
    userStatus: 'ACTIVE' | 'DISABLED' | 'EXPIRED' | 'LIMITED'
}

const INDEFINITE_THRESHOLD_MS = 10 * 365 * 24 * 60 * 60 * 1000

export const useSubscriptionSummary = (): ISubscriptionSummary => {
    const subscription = useSubscription()
    const { user } = subscription

    const limitBytes = Number(user.trafficLimitBytes)
    const usedBytes = Number(user.trafficUsedBytes)
    const isUnlimited = !limitBytes
    const remainingBytes = isUnlimited ? 0 : Math.max(0, limitBytes - usedBytes)
    const expiresAt = new Date(user.expiresAt)

    return {
        daysLeft: user.daysLeft,
        expiresAt,
        isActive: user.isActive,
        isIndefinite: expiresAt.getTime() - Date.now() >= INDEFINITE_THRESHOLD_MS,
        isUnlimited,
        remainingBytes,
        remainingLabel: isUnlimited ? '∞' : formatBytes(remainingBytes),
        remainingPercent: isUnlimited
            ? 100
            : Math.max(0, Math.min(100, Math.round((remainingBytes / limitBytes) * 100))),
        trafficLimit: user.trafficLimit,
        trafficUsed: user.trafficUsed,
        userStatus: user.userStatus
    }
}
