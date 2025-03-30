import { IconArrowsUpDown, IconCalendar, IconCheck, IconUser, IconX } from '@tabler/icons-react'
import { Accordion, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

import { useSubscriptionInfoStoreInfo } from '@entities/subscription-info-store'

const InfoBlock = ({
    icon,
    title,
    value,
    color
}: {
    color: string
    icon: React.ReactNode
    title: string
    value: string
}) => (
    <Paper 
        p="xs" 
        radius="lg" 
        style={{ minWidth: 0 }}
    >
        <Group 
            mb={4} 
            gap="xs" 
            wrap="nowrap"
        >
            <ThemeIcon 
                color={color} 
                size="md" 
                variant="light"
            >
                {icon}
            </ThemeIcon>
            <Text 
                fw={500} 
                size="sm" 
                truncate
            >
                {title}
            </Text>
        </Group>
        <Text 
            c="dimmed" 
            size="xs" 
            truncate
            style={{ wordBreak: 'break-word' }}
        >
            {value}
        </Text>
    </Paper>
)

export const SubscriptionInfoWidget = () => {
    const { t } = useTranslation()
    const { subscription } = useSubscriptionInfoStoreInfo()

    if (!subscription) return null

    const { user } = subscription

    const formatDate = (dateStr: Date | string) => {
        return dayjs(dateStr).format('DD.MM.YYYY')
    }

    // Расчет оставшегося времени
    const expiresAt = dayjs(user.expiresAt)
    const now = dayjs()
    const remainingDays = expiresAt.isAfter(now) ? expiresAt.diff(now, 'day') : -1 // -1, если истек
    const remainingHours = expiresAt.isAfter(now) ? expiresAt.diff(now, 'hour') : 0

    // Определяем статус и цвет
    const statusText = user.userStatus === 'ACTIVE' 
        ? t('subscription-info.widget.active') 
        : t('subscription-info.widget.inactive')
    const statusColor = user.userStatus === 'ACTIVE' ? 'green' : 'red'

    // Формируем текст оставшегося времени или сообщение об оплате
    let remainingText: string
    if (remainingDays < 0) {
        remainingText = t('subscription-info.widget.payment-required')
    } else if (remainingDays < 3) {
        remainingText = `${remainingHours} ${t('subscription-info.widget.remaining-hours')}`
    } else {
        remainingText = `${remainingDays} ${t('subscription-info.widget.remaining-days')}`
    }

    return (
        <Accordion variant="contained" radius="md">
            <Accordion.Item value="subscription-info">
                <Accordion.Control>
                    <Stack gap={2}>
                        <Group gap="xs" wrap="nowrap">
                            <Text fw={500} size="md">
                                {user.username}
                            </Text>
                            <Text fw={500} size="md" c="gray">
                                -
                            </Text>
                            <Text fw={500} size="md" c={statusColor}>
                                {statusText}
                            </Text>
                        </Group>
                        <Text 
                            size="xs" 
                            c={remainingDays < 0 ? 'red' : 'dimmed'}
                        >
                            {remainingText}
                        </Text>
                    </Stack>
                </Accordion.Control>
                <Accordion.Panel>
                    <SimpleGrid 
                        cols={2} 
                        spacing="xs" 
                        verticalSpacing="xs"
                    >
                        <InfoBlock
                            color="blue"
                            icon={<IconUser size={16} />}
                            title={t('subscription-info.widget.name')}
                            value={user.username}
                        />

                        <InfoBlock
                            color={user.userStatus === 'ACTIVE' ? 'green' : 'red'}
                            icon={user.userStatus === 'ACTIVE' ? 
                                <IconCheck size={16} /> : 
                                <IconX size={16} />}
                            title={t('subscription-info.widget.status')}
                            value={
                                user.userStatus === 'ACTIVE'
                                    ? t('subscription-info.widget.active')
                                    : t('subscription-info.widget.inactive')
                            }
                        />

                        <InfoBlock
                            color="red"
                            icon={<IconCalendar size={16} />}
                            title={t('subscription-info.widget.expires')}
                            value={`${t('subscription-info.widget.at')} ${formatDate(user.expiresAt)}`}
                        />

                        <InfoBlock
                            color="yellow"
                            icon={<IconArrowsUpDown size={16} />}
                            title={t('subscription-info.widget.bandwidth')}
                            value={`${user.trafficUsed} / ${user.trafficLimit === '0' ? '∞' : user.trafficLimit}`}
                        />
                    </SimpleGrid>
                </Accordion.Panel>
            </Accordion.Item>
        </Accordion>
    )
}
