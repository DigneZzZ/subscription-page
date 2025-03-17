import { Tabs, Badge, Text, Group, Button, Stack } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { IconBrandWindows, IconBrandApple, IconBrandAndroid } from '@tabler/icons-react';
import { apps, App } from '@shared/config/apps.config';
import { useSubscriptionInfoStoreInfo } from '@entities/subscription-info-store';

export const AppsTabsWidget = () => {
  const { t } = useTranslation();
  const clipboard = useClipboard({ timeout: 3000 });
  const { remnawaveSubscription } = useSubscriptionInfoStoreInfo();

  if (!remnawaveSubscription) return null;

  const handleCopyUrl = (app: App) => {
    const fullUrl = `${app.urlScheme}${remnawaveSubscription.subscriptionUrl}`;
    clipboard.copy(fullUrl);
    notifications.show({
      title: t('apps.widget.link-copied'),
      message: t('apps.widget.link-copied-to-clipboard'),
      color: 'teal'
    });
  };

  const renderAppBadges = (app: App) => {
    if (!app.badges) return null;

    return app.badges.map((badge, index) => (
      <Badge
        key={`${app.id}-${index}`}
        color={badge.type === 'top' ? 'yellow' : 'blue'}
        variant="light"
      >
        {badge.label}
      </Badge>
    ));
  };

  const renderApps = (platform: 'ios' | 'android' | 'windows') => {
    const platformApps = apps.filter(app => app.platform === platform);
    
    return (
      <Stack gap="md">
        {platformApps.map(app => (
          <Group key={app.id} position="apart">
            <Group spacing="xs">
              <Text>{app.name}</Text>
              {renderAppBadges(app)}
            </Group>
            <Button
              variant="light"
              onClick={() => handleCopyUrl(app)}
            >
              {t('apps.widget.copy-link')}
            </Button>
          </Group>
        ))}
      </Stack>
    );
  };

  return (
    <Tabs defaultValue="ios">
      <Tabs.List>
        <Tabs.Tab
          value="ios"
          icon={<IconBrandApple size="1rem" />}
        >
          iOS
        </Tabs.Tab>
        <Tabs.Tab
          value="android"
          icon={<IconBrandAndroid size="1rem" />}
        >
          Android
        </Tabs.Tab>
        <Tabs.Tab
          value="windows"
          icon={<IconBrandWindows size="1rem" />}
        >
          Windows
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="ios" pt="md">
        {renderApps('ios')}
      </Tabs.Panel>

      <Tabs.Panel value="android" pt="md">
        {renderApps('android')}
      </Tabs.Panel>

      <Tabs.Panel value="windows" pt="md">
        {renderApps('windows')}
      </Tabs.Panel>
    </Tabs>
  );
};