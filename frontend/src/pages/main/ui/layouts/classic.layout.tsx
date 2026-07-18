import { Box, Stack } from '@mantine/core'

import { DevicesButton, RawKeysWidget, ResetTrafficButton } from '@widgets/main'

import { InstallGuide, LanguageFooter } from './summary-cards'
import { ILayoutProps } from './layout-props.interface'
import classes from './layouts.module.css'

/**
 * Classic (stock) flow: the subscription-info block variant + reset/devices
 * buttons, then the installation guide, raw keys and the language picker.
 * Structurally identical to the pre-preset `main.page.component` body.
 */
export const ClassicLayout = (props: ILayoutProps) => {
    const { isMobile, SubscriptionInfoBlockRenderer } = props

    return (
        <Box className={classes.pageNarrow}>
            <Stack gap="xl">
                {/* Page-level mount: these buttons must be reachable regardless of the
                    subscriptionInfoBlockType variant (cards/collapsed/expanded/hidden). */}
                <Stack gap="xs">
                    {SubscriptionInfoBlockRenderer && (
                        <SubscriptionInfoBlockRenderer isMobile={isMobile} />
                    )}
                    <ResetTrafficButton />
                    <DevicesButton />
                </Stack>

                <InstallGuide {...props} />

                <RawKeysWidget isMobile={isMobile} />

                <LanguageFooter />
            </Stack>
        </Box>
    )
}
