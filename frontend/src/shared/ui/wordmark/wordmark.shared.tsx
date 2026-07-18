import { Box, Group, Title } from '@mantine/core'

export const Wordmark = ({ title }: { title: string }) => {
    const words = title.trim().split(/\s+/)
    const head = words.slice(0, -1).join(' ')
    const tail = words[words.length - 1]

    return (
        <Group gap={11} wrap="nowrap">
            <Box
                aria-hidden
                style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background:
                        'conic-gradient(from 210deg, var(--sp-acc-bright), var(--sp-acc-deep) 40%, var(--sp-acc) 70%, var(--sp-acc-bright))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <Box
                    style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: 'var(--sp-bg)'
                    }}
                />
            </Box>
            <Title
                fw={600}
                order={4}
                size="md"
                style={{ letterSpacing: '0.14em', textTransform: 'uppercase' }}
            >
                {head && <span className="logo-text-normal">{head} </span>}
                <span className="logo-text-highlight">{tail}</span>
            </Title>
        </Group>
    )
}
