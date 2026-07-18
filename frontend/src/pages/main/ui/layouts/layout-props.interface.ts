import { TSubscriptionPagePlatformKey } from '@remnawave/subscription-page-types'
import { ComponentType } from 'react'

import { IBlockRendererProps } from '@widgets/main/installation-guide/components/blocks/renderer-block.interface'

export interface ILayoutProps {
    atLeastOnePlatformApp: boolean
    BlockRenderer: ComponentType<IBlockRendererProps>
    hasPlatformApps: Record<TSubscriptionPagePlatformKey, boolean>
    isMobile: boolean
    platform: TSubscriptionPagePlatformKey | undefined
    SubscriptionInfoBlockRenderer: ComponentType<{ isMobile: boolean }> | null
}
