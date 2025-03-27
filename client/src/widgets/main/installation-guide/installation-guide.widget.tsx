import { useState } from 'react';
import { Tabs, Group, Text, Timeline, ThemeIcon, Button } from '@mantine/core';
import { IconBrandAndroid, IconBrandApple, IconDeviceDesktop, IconDownload, IconCheck, IconStar } from '@tabler/icons-react';
import { apps } from '@/shared/config/apps.config';
import { AppConfig } from '@/shared/types/app.types';
import { useTranslation } from 'react-i18next';

interface InstallationGuideWidgetProps {
    subscription: {
        subscriptionUrl: string;
    };
}

export const InstallationGuideWidget: React.FC<InstallationGuideWidgetProps> = ({ subscription }) => {
    const { t } = useTranslation();
    const [defaultTab] = useState(() => {
        const userAgent = window?.navigator?.userAgent?.toLowerCase() || '';
        if (userAgent.includes('android')) return 'android';
        if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
        return 'desktop';
    });

    const [activeSubTab, setActiveSubTab] = useState({
        android: 'happ',
        ios: 'v2raytun-ios'
    });

    if (!subscription) return null;

    const { subscriptionUrl } = subscription;

    const openApp = (urlScheme: string) => {
        window.open(`${urlScheme}/${subscriptionUrl}`, '_blank');
    };

    const renderApps = (platform: 'ios' | 'android') => {
        const platformApps = apps
            .filter(app => app.platform === platform)
            .sort((a, b) => a.priority - b.priority);

        return (
            <div>
                <Group mb="md">
                    {platformApps.map((app: AppConfig) => (
                        <Button
                            key={app.id}
                            variant={activeSubTab[platform] === app.id ? 'filled' : 'light'}
                            onClick={() => setActiveSubTab({ ...activeSubTab, [platform]: app.id })}
                            rightSection={app.priority === 1 && <IconStar size={16} color="gold" />}
                        >
                            {app.name}
                        </Button>
                    ))}
                </Group>

                {platformApps.map((app: AppConfig) => (
                    activeSubTab[platform] === app.id && (
                        <Timeline key={app.id} active={1} bulletSize={32} color="teal" lineWidth={2}>
                            <Timeline.Item
                                bullet={
                                    <ThemeIcon color={app.priority === 1 ? 'yellow' : 'teal.5'} radius="xl" size={26}>
                                        <IconDownload size={16} />
                                    </ThemeIcon>
                                }
                                title={t('installation-guide.widget.ustanovite-i-otkroite', { app: app.name })}
                            >
                                <Text c="dimmed" mb={16} size="sm">
                                    {t(app.description)}
                                </Text>
                                {app.storeUrl && (
                                    <Button
                                        component="a"
                                        href={app.storeUrl}
                                        variant="light"
                                        mb={16}
                                    >
                                        {t('installation-guide.widget.open-in-store')}
                                    </Button>
                                )}
                                <Button
                                    onClick={() => openApp(app.urlScheme)}
                                    variant="filled"
                                    color={app.priority === 1 ? 'yellow' : 'blue'}
                                >
                                    {t('installation-guide.widget.add-subscription-button')}
                                </Button>
                            </Timeline.Item>

                            <Timeline.Item
                                bullet={
                                    <ThemeIcon color={app.priority === 1 ? 'yellow' : 'teal.5'} radius="xl" size={26}>
                                        <IconCheck size={16} />
                                    </ThemeIcon>
                                }
                                title={t('installation-guide.widget.connect-and-use')}
                            >
                                <Text c="dimmed" size="sm">
                                    {t('installation-guide.widget.connect-and-use-description')}
                                </Text>
                            </Timeline.Item>
                        </Timeline>
                    )
                ))}
            </div>
        );
    };

    return (
        <Tabs defaultValue={defaultTab}>
            <Group mb="md">
                <Text fw={700} size="xl">
                    {t('installation-guide.widget.instrukciya')}
                </Text>
                <Tabs.List>
                    <Tabs.Tab leftSection={<IconBrandAndroid />} value="android">
                        Android
                    </Tabs.Tab>
                    <Tabs.Tab leftSection={<IconBrandApple />} value="ios">
                        iOS
                    </Tabs.Tab>
                    <Tabs.Tab leftSection={<IconDeviceDesktop />} value="desktop">
                        {t('installation-guide.widget.pk')}
                    </Tabs.Tab>
                </Tabs.List>
            </Group>

            <Tabs.Panel value="android">
                {renderApps('android')}
            </Tabs.Panel>

            <Tabs.Panel value="ios">
                {renderApps('ios')}
            </Tabs.Panel>

            <Tabs.Panel value="desktop">
                {/* Desktop content */}
                <Text>Desktop content</Text>
            </Tabs.Panel>
        </Tabs>
    );
};
