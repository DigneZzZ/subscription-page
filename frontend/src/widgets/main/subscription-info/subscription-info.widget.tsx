import {
    IconAlertCircle,
    IconArrowsUpDown,
    IconCalendar,
    IconCheck,
    IconChevronDown,
    IconUserScan,
    IconX
} from '@tabler/icons-react'
import {
    ActionIcon,
    Card,
    Collapse,
    Group,
    SimpleGrid,
    Stack,
    Text,
    ThemeIcon,
    Title
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

import {
    formatDate,
    getExpirationTextUtil
} from '@shared/utils/time-utils/get-expiration-text/get-expiration-text.util'
import { useSubscriptionInfoStoreInfo } from '@entities/subscription-info-store'
import { InfoBlockShared } from '@shared/ui/info-block/info-block.shared'

dayjs.extend(relativeTime)
export const SubscriptionInfoWidget = ({ isMobile }: { isMobile: boolean }) => {
    const { t, i18n } = useTranslation()
    const { subscription } = useSubscriptionInfoStoreInfo()
    const [opened, { toggle }] = useDisclosure(false)

    if (!subscription) return null

    const { user } = subscription

    const getStatusAndIcon = (): {
        color: string
        icon: React.ReactNode
        status: string
    } => {
        if (user.userStatus === 'ACTIVE' && user.daysLeft > 0) {
            return {
                color: 'teal',
                icon: <IconCheck size={isMobile ? 18 : 22} />,
                status: t('subscription-info.widget.active')
            }
        }
        if (
            (user.userStatus === 'ACTIVE' && user.daysLeft === 0) ||
            (user.daysLeft >= 0 && user.daysLeft <= 3)
        ) {
            return {
                color: 'orange',
                icon: <IconAlertCircle size={isMobile ? 18 : 22} />,
                status: t('subscription-info.widget.active')
            }
        }

        return {
            color: 'red',
            icon: <IconX size={isMobile ? 18 : 22} />,
            status: t('subscription-info.widget.inactive')
        }
    }

    const statusInfo = getStatusAndIcon()

    return (
        <Card p={{ base: 'sm', xs: 'md', sm: 'lg', md: 'xl' }} radius="lg" className="glass-card">
            <Group
                justify="space-between"
                gap="sm"
                wrap="nowrap"
                onClick={toggle}
                style={{ cursor: 'pointer' }}
            >
                <Group gap={isMobile ? 'xs' : 'sm'} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                    <ThemeIcon
                        color={statusInfo.color}
                        size={isMobile ? 32 : 40}
                        radius="xl"
                        variant="light"
                        style={{
                            background: `linear-gradient(135deg, var(--mantine-color-${statusInfo.color}-filled) 0%, var(--mantine-color-${statusInfo.color}-light) 100%)`,
                            border: `1px solid var(--mantine-color-${statusInfo.color}-4)`,
                            flexShrink: 0
                        }}
                    >
                        {statusInfo.icon}
                    </ThemeIcon>
                    <Text
                        c="white"
                        fw={600}
                        size={isMobile ? 'sm' : 'md'}
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {user.username}
                    </Text>
                    <Text c="dimmed" size={isMobile ? 'xs' : 'sm'}>
                        •
                    </Text>
                    <Text
                        c={user.daysLeft === 0 ? 'red' : 'dimmed'}
                        size={isMobile ? 'xs' : 'sm'}
                        fw={500}
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {getExpirationTextUtil(user.expiresAt, t, i18n)}
                    </Text>
                </Group>
                <ActionIcon
                    variant="subtle"
                    color="gray"
                    size={isMobile ? 'sm' : 'md'}
                    style={{
                        transform: opened ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 200ms ease'
                    }}
                >
                    <IconChevronDown size={isMobile ? 16 : 20} />
                </ActionIcon>
            </Group>

            <Collapse in={opened}>
                <Stack gap={isMobile ? 'sm' : 'md'} mt={isMobile ? 'sm' : 'md'}>
                    <SimpleGrid cols={{ base: 2, xs: 2, sm: 2 }} spacing="xs" verticalSpacing="xs">
                        <InfoBlockShared
                            color="blue"
                            icon={<IconUserScan size={16} />}
                            title={t('subscription-info.widget.name')}
                            value={user.username}
                        />

                        <InfoBlockShared
                            color={user.userStatus === 'ACTIVE' ? 'green' : 'red'}
                            icon={
                                user.userStatus === 'ACTIVE' ? (
                                    <IconCheck size={16} />
                                ) : (
                                    <IconX size={16} />
                                )
                            }
                            title={t('subscription-info.widget.status')}
                            value={
                                user.userStatus === 'ACTIVE'
                                    ? t('subscription-info.widget.active')
                                    : t('subscription-info.widget.inactive')
                            }
                        />

                        <InfoBlockShared
                            color="red"
                            icon={<IconCalendar size={16} />}
                            title={t('subscription-info.widget.expires')}
                            value={formatDate(user.expiresAt, t, i18n)}
                        />

                        <InfoBlockShared
                            color="yellow"
                            icon={<IconArrowsUpDown size={16} />}
                            title={t('subscription-info.widget.bandwidth')}
                            value={`${user.trafficUsed} / ${user.trafficLimit === '0' ? '∞' : user.trafficLimit}`}
                        />
                    </SimpleGrid>
                </Stack>
            </Collapse>
        </Card>
    )
}
