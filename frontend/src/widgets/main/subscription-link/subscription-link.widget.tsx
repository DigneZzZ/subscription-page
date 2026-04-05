import {
    IconBrandDiscord,
    IconBrandTelegram,
    IconBrandVk,
    IconCopy,
    IconCreditCard,
    IconLink,
    IconMessageChatbot
} from '@tabler/icons-react'
import { ActionIcon, Button, Group, Image, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useClipboard } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { renderSVG } from 'uqr'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { useSubscription } from '@entities/subscription-info-store'
import { usePaymentTariffs, type IPaymentTariff } from '@entities/payment-store'
import { vibrate } from '@shared/utils/vibrate'
import { useTranslation } from '@shared/hooks'

import classes from './subscription-link.module.css'

interface IProps {
    hideGetLink: boolean
    paymentUrl: string
    supportUrl: string
}

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

const PERIOD_LABELS: Record<number, { ru: string; en: string }> = {
    1: { ru: '1 месяц', en: '1 month' },
    3: { ru: '3 месяца', en: '3 months' },
    6: { ru: '6 месяцев', en: '6 months' },
    12: { ru: '12 месяцев', en: '12 months' }
}

function formatAmount(amount: number, currency: string): string {
    const symbol = CURRENCY_SYMBOLS[currency] ?? currency
    return `${amount} ${symbol}`
}

function getPeriodLabel(months: number, lang: string): string {
    const labels = PERIOD_LABELS[months]
    if (!labels) {
        return lang === 'ru' ? `${months} мес.` : `${months} mo.`
    }
    return lang === 'ru' ? labels.ru : labels.en
}

export const SubscriptionLinkWidget = ({ supportUrl, hideGetLink, paymentUrl }: IProps) => {
    const { t, baseTranslations, currentLang } = useTranslation()
    const subscription = useSubscription()
    const clipboard = useClipboard({ timeout: 10000 })
    const tariffs = usePaymentTariffs()

    const isRu = currentLang === 'ru'
    const hasPayment = paymentUrl !== '' || tariffs.length > 0

    const subscriptionUrl = constructSubscriptionUrl(
        window.location.href,
        subscription.user.shortUuid
    )

    const handleCopy = () => {
        notifications.show({
            title: t(baseTranslations.linkCopied),
            message: t(baseTranslations.linkCopiedToClipboard),
            color: 'cyan'
        })
        clipboard.copy(subscriptionUrl)
    }

    const renderSupportLink = (supportUrl: string) => {
        const iconConfig = {
            't.me': { icon: IconBrandTelegram, color: '#0088cc' },
            'discord.com': { icon: IconBrandDiscord, color: '#5865F2' },
            'vk.com': { icon: IconBrandVk, color: '#0077FF' }
        }

        const matchedPlatform = Object.entries(iconConfig).find(([domain]) =>
            supportUrl.includes(domain)
        )

        const { icon: Icon, color } = matchedPlatform
            ? matchedPlatform[1]
            : { icon: IconMessageChatbot, color: 'cyan' }

        return (
            <ActionIcon
                c={color}
                component="a"
                href={supportUrl}
                radius="md"
                rel="noopener noreferrer"
                size="xl"
                style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
                target="_blank"
                variant="default"
            >
                <Icon />
            </ActionIcon>
        )
    }

    const handleGetLink = () => {
        vibrate('tap')

        const subscriptionQrCode = renderSVG(subscriptionUrl, {
            whiteColor: '#161B22',
            blackColor: '#22d3ee'
        })

        modals.open({
            centered: true,
            title: t(baseTranslations.getLink),
            classNames: {
                content: classes.modalContent,
                header: classes.modalHeader,
                title: classes.modalTitle
            },
            children: (
                <Stack align="center">
                    <Image
                        src={`data:image/svg+xml;utf8,${encodeURIComponent(subscriptionQrCode)}`}
                        style={{ borderRadius: 'var(--mantine-radius-md)' }}
                    />
                    <Text c="white" fw={600} size="lg" ta="center">
                        {t(baseTranslations.scanQrCode)}
                    </Text>
                    <Text c="dimmed" size="sm" ta="center">
                        {t(baseTranslations.scanQrCodeDescription)}
                    </Text>

                    <Button
                        fullWidth
                        leftSection={<IconCopy />}
                        onClick={handleCopy}
                        radius="md"
                        variant="light"
                    >
                        {t(baseTranslations.copyLink)}
                    </Button>
                </Stack>
            )
        })
    }

    const handleTariffClick = (tariff: IPaymentTariff) => {
        const shortUuid = subscription.user.shortUuid
        const username = subscription.user.username
        const orderId = `${shortUuid}_${tariff.months}m`

        fetch('/api/payment-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId,
                months: tariff.months,
                amount: tariff.amount,
                currency: tariff.currency,
                shortUuid,
                username
            })
        }).catch(() => {})

        window.open(tariff.url, '_blank', 'noopener,noreferrer')
        modals.closeAll()
    }

    const renderTariffCard = (tariff: IPaymentTariff) => (
        <UnstyledButton
            className={classes.tariffCard}
            key={tariff.months}
            onClick={() => handleTariffClick(tariff)}
        >
            <Text c="white" fw={600} size="sm">
                {getPeriodLabel(tariff.months, currentLang)}
            </Text>
            <Text c="cyan" fw={700} mt={4} size="lg">
                {formatAmount(tariff.amount, tariff.currency)}
            </Text>
        </UnstyledButton>
    )

    const handlePayment = () => {
        vibrate('tap')

        if (tariffs.length === 0 && paymentUrl !== '') {
            window.open(paymentUrl, '_blank', 'noopener,noreferrer')
            return
        }

        modals.open({
            centered: true,
            title: isRu ? 'Выберите тариф' : 'Choose a plan',
            classNames: {
                content: classes.modalContent,
                header: classes.modalHeader,
                title: classes.modalTitle
            },
            children: (
                <Stack>
                    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                        {tariffs.map(renderTariffCard)}
                    </SimpleGrid>
                </Stack>
            )
        })
    }

    return (
        <Group gap="xs" ml="auto" wrap="nowrap">
            {!hideGetLink && (
                <ActionIcon
                    className={classes.actionIcon}
                    onClick={handleGetLink}
                    radius="md"
                    size="xl"
                    variant="default"
                >
                    <IconLink />
                </ActionIcon>
            )}

            {hasPayment && (
                <Button
                    className={classes.payButton}
                    leftSection={<IconCreditCard size={18} />}
                    onClick={handlePayment}
                    radius="md"
                    size="md"
                    variant="filled"
                >
                    {isRu ? 'Оплатить' : 'Pay'}
                </Button>
            )}

            {supportUrl !== '' && renderSupportLink(supportUrl)}
        </Group>
    )
}
