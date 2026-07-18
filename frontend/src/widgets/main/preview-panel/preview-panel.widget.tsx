import { ActionIcon, Box, CopyButton, Text } from '@mantine/core'
import { IconCheck, IconCopy } from '@tabler/icons-react'
import clsx from 'clsx'

import {
    TLayoutPreset,
    useLayoutPreset,
    useThemePreset,
    useUiPresetActions
} from '@entities/ui-preset-store'
import { THEME_PRESETS } from '@shared/constants'
import { vibrate } from '@shared/utils/vibrate'

import classes from './preview-panel.module.css'

interface ILayoutChipDef {
    label: string
    layout: TLayoutPreset
    letter: string
}

// Order + letters mirror the backend LAYOUT_PRESET contract (a/b/c/e/f — 'd' is reserved/unused).
const LAYOUT_CHIPS: ILayoutChipDef[] = [
    { letter: 'a', layout: 'classic', label: 'a · Classic' },
    { letter: 'b', layout: 'hero', label: 'b · Hero' },
    { letter: 'c', layout: 'columns', label: 'c · Columns' },
    { letter: 'e', layout: 'tiles', label: 'e · Tiles' },
    { letter: 'f', layout: 'banner', label: 'f · Banner' }
]

const LAYOUT_LETTERS: Record<TLayoutPreset, string> = {
    banner: 'f',
    classic: 'a',
    columns: 'c',
    hero: 'b',
    tiles: 'e'
}

const THEME_LIST = Object.values(THEME_PRESETS).sort((a, b) => a.id - b.id)

export const PreviewPanel = () => {
    const themePreset = useThemePreset()
    const layoutPreset = useLayoutPreset()
    const { setLayoutPreset, setThemePreset } = useUiPresetActions()

    const envHint = `THEME_PRESET=${themePreset} LAYOUT_PRESET=${LAYOUT_LETTERS[layoutPreset]}`

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
                            {chip.label}
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
                    ENV →
                </Text>
                <Box className={classes.chipGroup}>
                    <Text className={classes.envHint} component="span">
                        {envHint}
                    </Text>
                    <CopyButton value={envHint}>
                        {({ copied, copy }) => (
                            <ActionIcon
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
