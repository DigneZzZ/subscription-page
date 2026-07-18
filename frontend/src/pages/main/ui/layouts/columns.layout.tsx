import { Box, Stack } from '@mantine/core'

import {
    DevicesButton,
    RawKeysWidget,
    ResetTrafficButton,
    usePaymentModal
} from '@widgets/main'
import { getLayoutStrings } from '@shared/i18n'
import { useTranslation } from '@shared/hooks'

import {
    CtaButton,
    InstallGuide,
    LanguageFooter,
    LinkCard,
    SummaryCards
} from './summary-cards'
import { ILayoutProps } from './layout-props.interface'
import classes from './layouts.module.css'

/**
 * Columns layout: a sticky left rail (summary cards, renew CTA, management
 * buttons, subscription link) beside the installation guide, with raw keys and
 * the language picker spanning full width below.
 */
export const ColumnsLayout = (props: ILayoutProps) => {
    const { isMobile } = props
    const { currentLang } = useTranslation()
    const s = getLayoutStrings(currentLang)
    const { hasPayment, openPayment } = usePaymentModal()

    return (
        <Box className={classes.pageWide}>
            <Box className={classes.twocol}>
                <Box className={classes.twocolLeft}>
                    <SummaryCards />
                    {hasPayment && <CtaButton label={s.renew} onClick={openPayment} />}
                    <Stack gap="xs">
                        <DevicesButton />
                        <ResetTrafficButton />
                    </Stack>
                    <LinkCard />
                </Box>

                <Box>
                    <InstallGuide {...props} />
                </Box>
            </Box>

            <Stack gap="xl" mt="xl">
                <RawKeysWidget isMobile={isMobile} />
                <LanguageFooter />
            </Stack>
        </Box>
    )
}
