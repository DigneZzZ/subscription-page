import {
    IconBrandAndroid,
    IconBrandApple,
    IconCheck,
    IconCloudDownload,
    IconDeviceDesktop,
    IconDownload,
    IconExternalLink,
    IconStar
} from '@tabler/icons-react'
import { Button, Group, Select, Text, ThemeIcon, Timeline } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { useSubscriptionInfoStoreInfo } from '@entities/subscription-info-store'

type DeviceType = 'android' | 'ios' | 'desktop'
type AppType = 'happ' | 'v2raytun' | 'hiddify' | 'shadowrocket' | 'flclash' | null

export const InstallationGuideWidget = () => {
    const { t } = useTranslation()
    const { subscription } = useSubscriptionInfoStoreInfo()

    const [device, setDevice] = useState<DeviceType>(() => {
        const userAgent = window?.navigator?.userAgent?.toLowerCase() || ''
        if (userAgent.includes('android')) return 'android'
        if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios'
        return 'desktop'
    })
    const [app, setApp] = useState<AppType>(device === 'desktop' ? 'hiddify' : 'happ')

    useEffect(() => {
        setApp(device === 'desktop' ? 'hiddify' : 'happ')
    }, [device])

    if (!subscription) return null

    const { subscriptionUrl } = subscription
    const shadowrocketUrl = btoa(subscriptionUrl)

    const openHapp = () => window.open(`happ://add/${subscriptionUrl}`, '_blank')
    const openHiddify = () => window.open(`hiddify://import/${subscriptionUrl}`, '_blank')
    const openClash = () => window.open(`clash://install-config?url=${subscriptionUrl}`, '_blank')

    const deviceOptions = [
        { value: 'android', label: 'Android', icon: <IconBrandAndroid size={16} /> },
        { value: 'ios', label: 'iOS', icon: <IconBrandApple size={16} /> },
        { value: 'desktop', label: t('installation-guide.widget.pk'), icon: <IconDeviceDesktop size={16} /> }
    ]

    const appOptions = {
        android: [
            { value: 'happ', label: 'Happ', recommended: true },
            { value: 'v2raytun', label: 'V2RayTun' },
            { value: 'hiddify', label: 'Hiddify' }
        ],
        ios: [
            { value: 'happ', label: 'Happ', recommended: true },
            { value: 'v2raytun', label: 'V2RayTun' },
            { value: 'shadowrocket', label: 'Shadowrocket' }
        ],
        desktop: [
            { value: 'hiddify', label: 'Hiddify', recommended: true },
            { value: 'flclash', label: 'FLClash' }
        ]
    }

    const handleDeviceChange = (value: string | null) => {
        const newDevice = value as DeviceType
        if (newDevice && newDevice !== device) {
            setDevice(newDevice)
        }
    }

    return (
        <div>
            <Group mb="md" justify="space-between" align="center">
                <Text fw={700} size="xl">
                    {t('installation-guide.widget.instrukciya')}
                </Text>
                <Select
                    data={deviceOptions.map(option => ({
                        value: option.value,
                        label: option.label
                    }))}
                    value={device}
                    onChange={handleDeviceChange}
                    placeholder="Выберите устройство"
                    size="md"
                    radius="md"
                    style={{ width: 150 }}
                    leftSection={deviceOptions.find(opt => opt.value === device)?.icon}
                />
            </Group>

            {/* Кнопки приложений */}
            {(
                <Group 
                    mb="md" 
                    style={{ 
                        padding: '8px', 
                        borderRadius: '8px', 
                        gap: '8px', 
                        flexWrap: 'nowrap', 
                        overflow: 'hidden' 
                    }}
                >
                    {appOptions[device].map(option => (
                        <Button
                            key={option.value}
                            variant={app === option.value ? 'filled' : 'light'}
                            onClick={() => setApp(option.value as AppType)}
                            rightSection={option.recommended ? <IconStar size={14} color="gold" /> : null}
                            radius="md"
                            styles={{
                                root: {
                                    fontWeight: 600,
                                    padding: '8px 12px',
                                    boxShadow: app === option.value ? '0 0 10px rgba(0, 255, 255, 0.5)' : 'none',
                                    height: 'auto',
                                    lineHeight: '1.5',
                                    minWidth: 0,
                                    flex: '1 0 auto',
                                    fontSize: '12px',
                                    '@media (min-width: 576px)': {
                                        padding: '12px 20px',
                                        fontSize: '14px'
                                    }
                                },
                                label: {
                                    overflow: 'visible'
                                }
                            }}
                        >
                            {option.label}
                        </Button>
                    ))}
                </Group>
            )}

            {/* Android Apps */}
            {device === 'android' && app === 'happ' && (
                <Timeline active={1} bulletSize={32} color="teal" lineWidth={2}>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconDownload size={16} /></ThemeIcon>}
                        title={t('installation-guide.widget.ustanovite-i-otkroite-happ')}
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            {t('installation-guide.widget.open-google-play')}
                        </Text>
                        <Button
                            component="a"
                            href="https://play.google.com/store/apps/details?id=com.happproxy"
                            leftSection={<IconExternalLink size={16} />}
                            target="_blank"
                            variant="light"
                            radius="md"
                        >
                            {t('installation-guide.widget.open-in-google-play')}
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCloudDownload size={16} /></ThemeIcon>}
                        title={t('installation-guide.widget.add-subscription')}
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            {t('installation-guide.widget.add-subscription-description')}
                        </Text>
                        <Button 
                            onClick={openHapp} 
                            variant="filled" 
                            radius="md"
                        >
                            {t('installation-guide.widget.add-subscription-button')}
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCheck size={16} /></ThemeIcon>}
                        title={t('installation-guide.widget.connect-and-use')}
                    >
                        <Text c="dimmed" size="sm">
                            {t('installation-guide.widget.connect-and-use-description')}
                        </Text>
                    </Timeline.Item>
                </Timeline>
            )}

            {device === 'android' && app === 'v2raytun' && (
                <Timeline active={1} bulletSize={32} color="teal" lineWidth={2}>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconDownload size={16} /></ThemeIcon>}
                        title="Установите V2RayTun"
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            Установите приложение V2RayTun из Google Play
                        </Text>
                        <Button
                            component="a"
                            href="https://play.google.com/store/apps/details?id=com.v2raytun.android"
                            leftSection={<IconExternalLink size={16} />}
                            target="_blank"
                            variant="light"
                            radius="md"
                        >
                            Открыть в Google Play
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCloudDownload size={16} /></ThemeIcon>}
                        title="Добавить подписку"
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            Нажмите кнопку ниже, чтобы добавить конфигурацию в V2RayTun
                        </Text>
                        <Button
                            onClick={() => window.open(`v2raytun://import/${subscriptionUrl}`, '_blank')}
                            variant="filled"
                            radius="md"
                        >
                             {t('installation-guide.widget.add-subscription-button')}
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCheck size={16} /></ThemeIcon>}
                        title="Подключение"
                    >
                        <Text c="dimmed" size="sm">
                            Выберите сервер и нажмите кнопку подключения
                        </Text>
                    </Timeline.Item>
                </Timeline>
            )}

            {device === 'android' && app === 'hiddify' && (
                <Timeline active={1} bulletSize={32} color="teal" lineWidth={2}>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconDownload size={16} /></ThemeIcon>}
                        title="Установите Hiddify"
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            Установите приложение Hiddify из Google Play
                        </Text>
                        <Button
                            component="a"
                            href="https://play.google.com/store/apps/details?id=app.hiddify.com"
                            leftSection={<IconExternalLink size={16} />}
                            target="_blank"
                            variant="light"
                            radius="md"
                        >
                            Открыть в Google Play
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCloudDownload size={16} /></ThemeIcon>}
                        title="Добавить подписку"
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            Нажмите кнопку ниже, чтобы добавить конфигурацию в Hiddify
                        </Text>
                        <Button 
                            onClick={openHiddify} 
                            variant="filled" 
                            radius="md"
                        >
                            {t('installation-guide.widget.add-subscription-button')}
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCheck size={16} /></ThemeIcon>}
                        title="Подключение"
                    >
                        <Text c="dimmed" size="sm">
                            {t('installation-guide.widget.select-server-hiddify')}
                        </Text>
                    </Timeline.Item>
                </Timeline>
            )}

            {/* iOS Apps */}
            {device === 'ios' && app === 'happ' && (
                <Timeline active={1} bulletSize={32} color="teal" lineWidth={2}>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconDownload size={16} /></ThemeIcon>}
                        title={t('installation-guide.widget.ustanovite-i-otkroite-happ')}
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            {t('installation-guide.widget.install-app-store-description')}
                        </Text>
                        <Button
                            component="a"
                            href="https://apps.apple.com/us/app/happ-proxy-utility/id6504287215"
                            leftSection={<IconExternalLink size={16} />}
                            target="_blank"
                            variant="light"
                            radius="md"
                        >
                            {t('installation-guide.widget.open-app-store')}
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCloudDownload size={16} /></ThemeIcon>}
                        title={t('installation-guide.widget.add-subscription')}
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            {t('installation-guide.widget.add-ios-subscription-description')}
                        </Text>
                        <Button 
                            onClick={openHapp} 
                            variant="filled" 
                            radius="md"
                        >
                            {t('installation-guide.widget.add-subscription-button')}
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCheck size={16} /></ThemeIcon>}
                        title={t('installation-guide.widget.connect-and-use')}
                    >
                        <Text c="dimmed" size="sm">
                            {t('installation-guide.widget.connect-and-use-description')}
                        </Text>
                    </Timeline.Item>
                </Timeline>
            )}

            {device === 'ios' && app === 'v2raytun' && (
                <Timeline active={1} bulletSize={32} color="teal" lineWidth={2}>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconDownload size={16} /></ThemeIcon>}
                        title="Установите V2RayTun"
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            Установите приложение V2RayTun из App Store
                        </Text>
                        <Button
                            component="a"
                            href="https://apps.apple.com/ru/app/v2raytun/id6476628951"
                            leftSection={<IconExternalLink size={16} />}
                            target="_blank"
                            variant="light"
                            radius="md"
                        >
                            Открыть в App Store
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCloudDownload size={16} /></ThemeIcon>}
                        title="Добавить подписку"
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            Нажмите кнопку ниже, чтобы добавить конфигурацию в V2RayTun
                        </Text>
                        <Button
                            onClick={() => window.open(`v2raytun://import/${subscriptionUrl}`, '_blank')}
                            variant="filled"
                            radius="md"
                        >
                             {t('installation-guide.widget.add-subscription-button')}
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCheck size={16} /></ThemeIcon>}
                        title="Подключение"
                    >
                        <Text c="dimmed" size="sm">
                            Выберите сервер и нажмите кнопку подключения
                        </Text>
                    </Timeline.Item>
                </Timeline>
            )}

            {device === 'ios' && app === 'shadowrocket' && (
                <Timeline active={2} bulletSize={32} color="teal" lineWidth={2}>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconDownload size={16} /></ThemeIcon>}
                        title="Установите Shadowrocket"
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            Установите приложение Shadowrocket из App Store
                        </Text>
                        <Button
                            component="a"
                            href="https://apps.apple.com/ru/app/shadowrocket/id932747118"
                            leftSection={<IconExternalLink size={16} />}
                            target="_blank"
                            variant="light"
                            radius="md"
                        >
                            Открыть в App Store
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCloudDownload size={16} /></ThemeIcon>}
                        title="Добавить роутинг"
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            Нажмите кнопку ниже, чтобы добавить файл конфигурации ru_direct.conf
                        </Text>
                        <Button
                            onClick={() => window.open('shadowrocket://config/add/https://dignezzz.github.io/ru_direct.conf', '_blank')}
                            variant="filled"
                            radius="md"
                        >
                            Добавить роутинг
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCloudDownload size={16} /></ThemeIcon>}
                        title="Добавить подписку"
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            Нажмите кнопку ниже, чтобы добавить конфигурацию в Shadowrocket
                        </Text>
                        <Button
                            onClick={() => window.open(`sub://${shadowrocketUrl}`, '_blank')}
                            variant="filled"
                            radius="md"
                        >
                             {t('installation-guide.widget.add-subscription-button')}
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCheck size={16} /></ThemeIcon>}
                        title="Подключение"
                    >
                        <Text c="dimmed" size="sm">
                            Выберите сервер и нажмите кнопку подключения
                        </Text>
                    </Timeline.Item>
                </Timeline>
            )}

            {/* Desktop Apps */}
            {device === 'desktop' && app === 'hiddify' && (
                <Timeline active={1} bulletSize={32} color="teal" lineWidth={2}>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconDownload size={16} /></ThemeIcon>}
                        title={t('installation-guide.widget.install-hiddify')}
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            {t('installation-guide.widget.install-hiddify-description')}
                        </Text>
                        <Group>
                            <Button
                                component="a"
                                href="https://github.com/hiddify/hiddify-app/releases/download/v2.5.7/Hiddify-Windows-Setup-x64.exe"
                                leftSection={<IconExternalLink size={16} />}
                                target="_blank"
                                variant="light"
                                radius="md"
                            >
                                Windows
                            </Button>
                            <Button
                                component="a"
                                href="https://github.com/hiddify/hiddify-app/releases/download/v2.5.7/Hiddify-MacOS.dmg"
                                leftSection={<IconExternalLink size={16} />}
                                target="_blank"
                                variant="light"
                                radius="md"
                            >
                                macOS
                            </Button>
                            <Button
                                component="a"
                                href="https://github.com/hiddify/hiddify-app/releases/download/v2.5.7/Hiddify-Linux-x64.AppImage"
                                leftSection={<IconExternalLink size={16} />}
                                target="_blank"
                                variant="light"
                                radius="md"
                            >
                                Linux
                            </Button>
                        </Group>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCloudDownload size={16} /></ThemeIcon>}
                        title={t('installation-guide.widget.add-subscription')}
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            {t('installation-guide.widget.add-subscription-pc-description')}
                        </Text>
                        <Button 
                            onClick={openHiddify} 
                            variant="filled" 
                            radius="md"
                        >
                            {t('installation-guide.widget.add-subscription-button')}
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCheck size={16} /></ThemeIcon>}
                        title={t('installation-guide.widget.connect-and-use')}
                    >
                        <Text c="dimmed" size="sm">
                            {t('installation-guide.widget.select-server-hiddify')}
                        </Text>
                    </Timeline.Item>
                </Timeline>
            )}

            {device === 'desktop' && app === 'flclash' && (
                <Timeline active={1} bulletSize={32} color="teal" lineWidth={2}>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconDownload size={16} /></ThemeIcon>}
                        title={t('installation-guide.widget.install-flclash') || 'Установите FLClash'}
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            {t('installation-guide.widget.install-flclash-description') || 'Скачайте и установите FLClash для вашей операционной системы'}
                        </Text>
                        <Group>
                            <Button
                                component="a"
                                href="https://github.com/chen08209/FlClash/releases/download/v0.8.80/FlClash-0.8.80-windows-amd64-setup.exe"
                                leftSection={<IconExternalLink size={16} />}
                                target="_blank"
                                variant="light"
                                radius="md"
                            >
                                Windows
                            </Button>
                            <Button
                                component="a"
                                href="https://github.com/chen08209/FlClash/releases/download/v0.8.80/FlClash-0.8.80-macos-arm64.dmg"
                                leftSection={<IconExternalLink size={16} />}
                                target="_blank"
                                variant="light"
                                radius="md"
                            >
                                macOS Apple Silicon
                            </Button>
                            <Button
                                component="a"
                                href="https://github.com/chen08209/FlClash/releases/download/v0.8.80/FlClash-0.8.80-macos-amd64.dmg"
                                leftSection={<IconExternalLink size={16} />}
                                target="_blank"
                                variant="light"
                                radius="md"
                            >
                                macOS Intel x64
                            </Button>
                            <Button
                                component="a"
                                href="https://github.com/chen08209/FlClash/releases/download/v0.8.80/FlClash-0.8.80-linux-amd64.AppImage"
                                leftSection={<IconExternalLink size={16} />}
                                target="_blank"
                                variant="light"
                                radius="md"
                            >
                                Linux
                            </Button>
                        </Group>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCloudDownload size={16} /></ThemeIcon>}
                        title={t('installation-guide.widget.add-subscription')}
                    >
                        <Text c="dimmed" mb={16} size="sm">
                            {t('installation-guide.widget.add-subscription-pc-description') || 'Нажмите кнопку ниже, чтобы добавить подписку в FLClash'}
                        </Text>
                        <Button 
                            onClick={openClash} 
                            variant="filled" 
                            radius="md"
                        >
                            {t('installation-guide.widget.add-subscription-button')}
                        </Button>
                    </Timeline.Item>
                    <Timeline.Item
                        bullet={<ThemeIcon color="teal.5" radius="xl" size={26}><IconCheck size={16} /></ThemeIcon>}
                        title={t('installation-guide.widget.connect-and-use')}
                    >
                        <Text c="dimmed" size="sm">
                            {t('installation-guide.widget.select-server-flclash') || 'Выберите сервер и активируйте подключение в FLClash'}
                        </Text>
                    </Timeline.Item>
                </Timeline>
            )}
        </div>
    )
}
