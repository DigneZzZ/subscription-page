import {
    IconBrandDiscord,
    IconBrandTelegram,
    IconBrandVk,
    IconCopy,
    IconCreditCard,
    IconLink,
    IconMail,
    IconMessageChatbot
} from '@tabler/icons-react'
import { ActionIcon, Button, Group, Image, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useClipboard } from '@mantine/hooks'
import { modals } from '@mantine/modals'
import { renderSVG } from 'uqr'
import clsx from 'clsx'

import { constructSubscriptionUrl } from '@shared/utils/construct-subscription-url'
import { useSubscription } from '@entities/subscription-info-store'
import { useHeaderPayButton } from '@entities/ui-preset-store'
import { vibrate } from '@shared/utils/vibrate'
import { useTranslation } from '@shared/hooks'
import { getQrColors } from '@shared/utils'

import { usePaymentModal } from './use-payment-modal'
import classes from './subscription-link.module.css'

interface IProps {
    hideGetLink: boolean
    supportEmail: string
    supportUrl: string
}

export const SubscriptionLinkWidget = ({ supportUrl, supportEmail, hideGetLink }: IProps) => {
    const { t, baseTranslations, currentLang } = useTranslation()
    const subscription = useSubscription()
    const clipboard = useClipboard({ timeout: 10000 })
    const { hasPayment, openPayment } = usePaymentModal()
    const headerPay = useHeaderPayButton()

    const isRu = currentLang === 'ru'

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

    const renderSupportEmailLink = (email: string) => {
        return (
            <ActionIcon
                c="cyan"
                component="a"
                href={`mailto:${email}`}
                radius="md"
                size="xl"
                style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
                variant="default"
            >
                <IconMail />
            </ActionIcon>
        )
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

        const subscriptionQrCode = renderSVG(subscriptionUrl, getQrColors())

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
                    <Text c="var(--sp-text)" fw={600} size="lg" ta="center">
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

            {hasPayment && headerPay && (
                <Button
                    className={clsx(classes.payButton, 'sp-cta')}
                    leftSection={<IconCreditCard size={18} />}
                    onClick={openPayment}
                    radius="md"
                    size="md"
                    variant="filled"
                >
                    {isRu ? 'Оплатить' : 'Pay'}
                </Button>
            )}

            {supportUrl !== '' && renderSupportLink(supportUrl)}

            {supportEmail !== '' && renderSupportEmailLink(supportEmail)}
        </Group>
    )
}
