import { Box, Stack, Text } from '@mantine/core'

interface ITrafficGaugeProps {
    caption: string
    label: string
    percent: number
    size?: number
    sub?: string
}

export const TrafficGauge = ({ caption, label, percent, size = 148, sub }: ITrafficGaugeProps) => {
    const stroke = 11
    const radius = (size - stroke * 2) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference * (1 - Math.max(0, Math.min(100, percent)) / 100)

    return (
        <Box pos="relative" style={{ width: size, height: size, flexShrink: 0 }}>
            <svg height={size} style={{ transform: 'rotate(-90deg)' }} width={size}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    fill="none"
                    r={radius}
                    stroke="var(--sp-track)"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    fill="none"
                    r={radius}
                    stroke="var(--sp-acc)"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    strokeWidth={stroke}
                />
            </svg>
            <Stack
                align="center"
                gap={2}
                justify="center"
                pos="absolute"
                style={{ inset: 0 }}
            >
                <Text ff="heading" fw={600} size="23px">
                    {label}
                </Text>
                <Text c="var(--sp-dim)" size="11px">
                    {caption}
                </Text>
                {sub && (
                    <Text fw={600} size="11px">
                        {sub}
                    </Text>
                )}
            </Stack>
        </Box>
    )
}
