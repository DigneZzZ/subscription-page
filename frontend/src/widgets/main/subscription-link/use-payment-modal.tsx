import {
    Accordion,
    Badge,
    Box,
    Group,
    SimpleGrid,
    Stack,
    Text,
    UnstyledButton
} from '@mantine/core'
import { IconBolt, IconClock, IconWorld } from '@tabler/icons-react'
import { modals } from '@mantine/modals'

import { type IPaymentTariff, usePaymentTariffs, usePaymentUrl } from '@entities/payment-store'
import { useSubscription } from '@entities/subscription-info-store'
import { formatAmount } from '@shared/utils/format-amount'
import { vibrate } from '@shared/utils/vibrate'
import { useTranslation } from '@shared/hooks'

import classes from './subscription-link.module.css'

const PERIOD_LABELS: Record<number, { en: string; ru: string; }> = {
    1: { ru: '1 месяц', en: '1 month' },
    3: { ru: '3 месяца', en: '3 months' },
    6: { ru: '6 месяцев', en: '6 months' },
    12: { ru: '12 месяцев', en: '12 months' }
}

function getPeriodLabel(months: number, days: number, lang: string): string {
    const ru = lang === 'ru'
    if (months > 0) {
        const labels = PERIOD_LABELS[months]
        if (labels) {
            return ru ? labels.ru : labels.en
        }
        return ru ? `${months} мес.` : `${months} mo.`
    }
    if (days > 0) {
        return ru ? `${days} дн.` : `${days} d.`
    }
    return ru ? '0 дн.' : '0 d.'
}

function renderDescIcon(line: string) {
    const isConnections = /подключ|connection|устройств|device/i.test(line)

    return isConnections ? (
        <IconWorld color="#22d3ee" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
    ) : (
        <IconBolt color="#facc15" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
    )
}

interface IUsePaymentModal {
    hasPayment: boolean
    openPayment: () => void
}

export const usePaymentModal = (): IUsePaymentModal => {
    const { currentLang } = useTranslation()
    const subscription = useSubscription()
    const tariffs = usePaymentTariffs()
    const paymentUrl = usePaymentUrl()

    const isRu = currentLang === 'ru'
    const hasPayment = paymentUrl !== '' || tariffs.length > 0

    const handleTariffClick = (tariff: IPaymentTariff) => {
        const { shortUuid } = subscription.user
        // Prefer the explicit tariff id (several tariffs can share a period); fall back to months.
        const param = tariff.id != null ? `id=${tariff.id}` : `months=${tariff.months}`
        const url = `/api/pay?shortUuid=${encodeURIComponent(shortUuid)}&${param}`
        window.open(url, '_blank', 'noopener,noreferrer')
        modals.closeAll()
    }

    const renderTariffCard = (tariff: IPaymentTariff) => {
        const descLines = (tariff.description ?? '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)

        return (
            <UnstyledButton
                className={classes.tariffCard}
                key={tariff.id ?? `${tariff.months}-${tariff.amount}`}
                onClick={() => handleTariffClick(tariff)}
            >
                <Group align="flex-start" gap="sm" justify="space-between" w="100%" wrap="nowrap">
                    <Box style={{ minWidth: 0 }}>
                        <Text c="var(--sp-text)" className={classes.tariffName} fw={700} size="sm">
                            {tariff.name ?? getPeriodLabel(tariff.months, tariff.days ?? 0, currentLang)}
                        </Text>
                        <Text c="dimmed" mt={2} size="xs">
                            {getPeriodLabel(tariff.months, tariff.days ?? 0, currentLang)}
                        </Text>
                    </Box>
                    <Group gap={10} wrap="nowrap">
                        <Text c="var(--sp-text)" fw={700} size="lg" style={{ whiteSpace: 'nowrap' }}>
                            {formatAmount(tariff.amount, tariff.currency)}
                        </Text>
                        <span className={classes.radio} />
                    </Group>
                </Group>
                {descLines.length > 0 ? (
                    <>
                        <span className={classes.cardDivider} />
                        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={8} verticalSpacing={4} w="100%">
                            {descLines.map((line, index) => (
                                <Group align="flex-start" gap={6} key={index} wrap="nowrap">
                                    {renderDescIcon(line)}
                                    <Text c="dimmed" lh={1.3} size="xs">
                                        {line}
                                    </Text>
                                </Group>
                            ))}
                        </SimpleGrid>
                    </>
                ) : null}
            </UnstyledButton>
        )
    }

    const openPayment = () => {
        vibrate('tap')

        if (tariffs.length === 0 && paymentUrl !== '') {
            window.open(paymentUrl, '_blank', 'noopener,noreferrer')
            return
        }

        const dayTariffs = tariffs
            .filter((tariff) => tariff.months <= 0)
            .sort((a, b) => a.amount - b.amount)

        const groupsMap = new Map<number, IPaymentTariff[]>()
        for (const tariff of tariffs) {
            if (tariff.months > 0) {
                const list = groupsMap.get(tariff.months) ?? []
                list.push(tariff)
                groupsMap.set(tariff.months, list)
            }
        }

        const monthGroups = [...groupsMap.entries()]
            .map(([months, items]) => ({
                currency: items[0].currency,
                items: [...items].sort((a, b) => a.amount - b.amount),
                minPrice: Math.min(...items.map((item) => item.amount)),
                months
            }))
            .sort((a, b) => a.months - b.months)

        modals.open({
            centered: true,
            title: isRu ? 'Выберите тариф' : 'Choose a plan',
            classNames: {
                content: classes.modalContent,
                header: classes.modalHeader,
                title: classes.modalTitle
            },
            children: (
                <Stack gap="md">
                    {dayTariffs.length > 0 ? (
                        <Stack gap="xs">
                            <Group c="dimmed" gap={6}>
                                <IconClock size={15} />
                                <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                                    {isRu ? 'Посуточные тарифы' : 'Daily plans'}
                                </Text>
                            </Group>
                            {dayTariffs.map(renderTariffCard)}
                        </Stack>
                    ) : null}

                    {monthGroups.length > 0 ? (
                        <Accordion
                            classNames={{
                                chevron: classes.accChevron,
                                control: classes.accControl,
                                item: classes.accItem
                            }}
                            defaultValue={String(monthGroups[0].months)}
                            variant="separated"
                        >
                            {monthGroups.map((group) => (
                                <Accordion.Item key={group.months} value={String(group.months)}>
                                    <Accordion.Control
                                        icon={<IconClock className={classes.groupIcon} size={18} />}
                                    >
                                        <Group gap="xs" justify="space-between" pr="sm" wrap="nowrap">
                                            <Text c="var(--sp-text)" fw={600}>
                                                {getPeriodLabel(group.months, 0, currentLang)}
                                            </Text>
                                            <Badge className={classes.priceBadge} variant="light">
                                                {isRu ? 'от' : 'from'}{' '}
                                                {formatAmount(group.minPrice, group.currency)}
                                            </Badge>
                                        </Group>
                                    </Accordion.Control>
                                    <Accordion.Panel>
                                        <Stack gap="xs">{group.items.map(renderTariffCard)}</Stack>
                                    </Accordion.Panel>
                                </Accordion.Item>
                            ))}
                        </Accordion>
                    ) : null}
                </Stack>
            )
        })
    }

    return { hasPayment, openPayment }
}
