import { ActionIcon, Box, CopyButton, Text } from '@mantine/core'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import clsx from 'clsx'

import {
    EFFECT_FLAGS,
    TLayoutPreset,
    useEffects,
    useLayoutPreset,
    useThemePreset,
    useUiPresetActions
} from '@entities/ui-preset-store'
import { THEME_PRESETS } from '@shared/constants'
import { vibrate } from '@shared/utils/vibrate'

import classes from './preview-panel.module.css'

type TLayoutLetter = 'a' | 'b' | 'c' | 'e' | 'f' | 'j' | 'k' | 'l'

interface ILayoutChipDef {
    layout: TLayoutPreset
    letter: TLayoutLetter
    name: string
}

// Single source of truth for the layout ↔ letter contract (mirrors the backend
// LAYOUT_PRESET env — a/b/c/e/f, 'd' is reserved/unused). Both the visible chip
// label and the ENV hint's letter are derived from this list, never duplicated.
const LAYOUT_CHIPS: ILayoutChipDef[] = [
    { letter: 'a', layout: 'classic', name: 'Classic' },
    { letter: 'b', layout: 'hero', name: 'Hero' },
    { letter: 'c', layout: 'columns', name: 'Columns' },
    { letter: 'e', layout: 'tiles', name: 'Tiles' },
    { letter: 'f', layout: 'banner', name: 'Banner' },
    { letter: 'j', layout: 'aurora', name: 'Aurora' },
    { letter: 'k', layout: 'network', name: 'Network' },
    { letter: 'l', layout: 'billboard', name: 'Billboard' }
]

const LAYOUT_LETTERS: Record<TLayoutPreset, TLayoutLetter> = Object.fromEntries(
    LAYOUT_CHIPS.map((chip) => [chip.layout, chip.letter])
) as Record<TLayoutPreset, TLayoutLetter>

const THEME_LIST = Object.values(THEME_PRESETS).sort((a, b) => a.id - b.id)

export const PreviewPanel = () => {
    const themePreset = useThemePreset()
    const layoutPreset = useLayoutPreset()
    const effects = useEffects()
    const { setLayoutPreset, setThemePreset, toggleEffect } = useUiPresetActions()

    const fxHint = effects.length > 0 ? ` EFFECTS=${effects.join(',')}` : ''
    const envHint = `THEME_PRESET=${themePreset} LAYOUT_PRESET=${LAYOUT_LETTERS[layoutPreset]}${fxHint}`

    return (
        <Box className={classes.panel}>
            <Box className={classes.row}>
                <Text className={classes.rowHint} component="span">
                    LAYOUT →
                </Text>
                <Box className={classes.chipGroup}>
                    {LAYOUT_CHIPS.map((chip) => (
                        <Box
                            className={clsx(
                                classes.chip,
                                layoutPreset === chip.layout && classes.chipActive
                            )}
                            component="button"
                            key={chip.layout}
                            onClick={() => {
                                vibrate('tap')
                                setLayoutPreset(chip.layout)
                            }}
                            type="button"
                        >
                            {chip.letter} · {chip.name}
                        </Box>
                    ))}
                </Box>
            </Box>

            <Box className={classes.row}>
                <Text className={classes.rowHint} component="span">
                    THEME →
                </Text>
                <Box className={classes.chipGroup}>
                    {THEME_LIST.map((preset) => (
                        <Box
                            className={clsx(
                                classes.chip,
                                themePreset === preset.id && classes.chipActive
                            )}
                            component="button"
                            key={preset.id}
                            onClick={() => {
                                vibrate('tap')
                                setThemePreset(preset.id)
                            }}
                            type="button"
                        >
                            <Text className={classes.chipNo} component="span">
                                {preset.id}
                            </Text>
                            <Box className={classes.dots}>
                                <Box style={{ background: preset.bg }} />
                                <Box style={{ background: preset.accent[4] }} />
                            </Box>
                            {preset.name}
                        </Box>
                    ))}
                </Box>
            </Box>

            <Box className={classes.row}>
                <Text className={classes.rowHint} component="span">
                    FX →
                </Text>
                <Box className={classes.chipGroup}>
                    {EFFECT_FLAGS.map((flag) => {
                        const on = effects.includes(flag)
                        return (
                            <Box
                                className={clsx(classes.chip, on && classes.chipActive)}
                                component="button"
                                key={flag}
                                onClick={() => {
                                    vibrate('tap')
                                    toggleEffect(flag)
                                }}
                                type="button"
                            >
                                {on ? '✓' : '✕'} {flag}
                            </Box>
                        )
                    })}
                </Box>
            </Box>

            <Box className={classes.row}>
                <Text className={classes.rowHint} component="span">
                    ENV →
                </Text>
                <Box className={classes.chipGroup}>
                    <Text className={classes.envHint} component="span">
                        {envHint}
                    </Text>
                    <CopyButton value={envHint}>
                        {({ copied, copy }) => (
                            <ActionIcon
                                aria-label="Copy env values"
                                color={copied ? 'teal' : 'gray'}
                                onClick={() => {
                                    vibrate('drop')
                                    copy()
                                }}
                                size="sm"
                                variant="subtle"
                            >
                                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            </ActionIcon>
                        )}
                    </CopyButton>
                </Box>
            </Box>
        </Box>
    )
}
