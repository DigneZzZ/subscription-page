import {
    APP_CONFIG_ROUTE_LEADING_PATH,
    SubscriptionPageRawConfigSchema
} from '@remnawave/subscription-page-types'
import { GetSubscriptionInfoByShortUuidCommand } from '@remnawave/backend-contract'
import { Outlet } from 'react-router-dom'
import { useLayoutEffect } from 'react'
import consola from 'consola/browser'
import { ofetch } from 'ofetch'

import {
    useSubscriptionInfoStoreActions,
    useSubscriptionInfoStoreInfo
} from '@entities/subscription-info-store'
import { useAppConfigStoreActions, useIsConfigLoaded } from '@entities/app-config-store'
import { useDevicesStoreActions } from '@entities/devices-store'
import { usePaymentStoreActions } from '@entities/payment-store'
import { useSupportStoreActions } from '@entities/support-store'
import { LoadingScreen } from '@shared/ui'

import classes from './root.module.css'

export function RootLayout() {
    const subscriptionActions = useSubscriptionInfoStoreActions()
    const configActions = useAppConfigStoreActions()
    const paymentActions = usePaymentStoreActions()
    const supportActions = useSupportStoreActions()
    const devicesActions = useDevicesStoreActions()

    const { subscription } = useSubscriptionInfoStoreInfo()
    const isConfigLoaded = useIsConfigLoaded()

    useLayoutEffect(() => {
        const subPageDiv = document.getElementById('sbpg')

        if (subPageDiv) {
            const subscriptionUrl = subPageDiv.dataset.panel

            if (subscriptionUrl) {
                try {
                    const subscription: GetSubscriptionInfoByShortUuidCommand.Response = JSON.parse(
                        atob(subscriptionUrl)
                    )

                    subscriptionActions.setSubscriptionInfo({
                        subscription: subscription.response
                    })
                } catch (error) {
                    consola.log(error)
                } finally {
                    subPageDiv.remove()
                }
            }
        }

        const paymentDiv = document.getElementById('pmt')
        if (paymentDiv) {
            const paymentUrl = paymentDiv.dataset.url ?? ''
            paymentActions.setPaymentUrl(paymentUrl)

            const tariffsData = paymentDiv.dataset.tariffs ?? ''
            if (tariffsData) {
                try {
                    // atob yields a Latin1 byte-string; decode as UTF-8 so Cyrillic
                    // tariff names/descriptions don't become mojibake.
                    const tariffsJson = new TextDecoder('utf-8').decode(
                        Uint8Array.from(atob(tariffsData), (ch) => ch.charCodeAt(0))
                    )
                    const tariffs = JSON.parse(tariffsJson)
                    if (Array.isArray(tariffs)) {
                        paymentActions.setTariffs(tariffs)
                    }
                } catch {
                    consola.error('Failed to parse payment tariffs')
                }
            }

            const resetData = paymentDiv.dataset.reset ?? ''
            if (resetData) {
                try {
                    const reset = JSON.parse(atob(resetData))
                    if (
                        reset &&
                        typeof reset.amount === 'number' &&
                        typeof reset.currency === 'string'
                    ) {
                        paymentActions.setReset({
                            amount: reset.amount,
                            currency: reset.currency,
                            minPercent: typeof reset.minPercent === 'number' ? reset.minPercent : 0,
                            dynamic: reset.dynamic === true
                        })
                    }
                } catch {
                    consola.error('Failed to parse payment reset config')
                }
            }

            paymentDiv.remove()
        }

        const supportDiv = document.getElementById('sup')
        if (supportDiv) {
            const supportEmail = supportDiv.dataset.email ?? ''
            supportActions.setSupportEmail(supportEmail)
            supportDiv.remove()
        }

        const hwidDiv = document.getElementById('hwid')
        if (hwidDiv) {
            const hwidData = hwidDiv.dataset.hwid ?? ''
            if (hwidData) {
                try {
                    const parsed = JSON.parse(atob(hwidData))
                    devicesActions.setEnabled(parsed?.enabled === true)
                } catch {
                    consola.error('Failed to parse hwid config')
                }
            }
            hwidDiv.remove()
        }

        document.getElementById('ui')?.remove()

        const fetchConfig = async () => {
            try {
                const tempConfig = await ofetch<unknown>(
                    `${APP_CONFIG_ROUTE_LEADING_PATH}?v=${Date.now()}`,
                    {
                        parseResponse: (response) => JSON.parse(response)
                    }
                )

                const parsedConfig =
                    await SubscriptionPageRawConfigSchema.safeParseAsync(tempConfig)

                if (!parsedConfig.success) {
                    consola.error('Failed to parse app config:', parsedConfig.error)
                    return
                }

                configActions.setConfig(parsedConfig.data)
            } catch (error) {
                consola.error('Failed to fetch app config:', error)
            }
        }

        fetchConfig()
    }, [])

    if (!isConfigLoaded || !subscription) {
        return (
            <div className={classes.root}>
                <div className="animated-background"></div>
                <div className={classes.content}>
                    <main className={classes.main}>
                        <LoadingScreen height="100vh" />
                    </main>
                </div>
            </div>
        )
    }

    return (
        <div className={classes.root}>
            <div className="animated-background"></div>
            <div className={classes.content}>
                <main className={classes.main}>
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
