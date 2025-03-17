import React from 'react';
import { Tabs, Group, Text, Button, Timeline, ThemeIcon } from '@mantine/core';
import { IconBrandAndroid, IconBrandApple, IconDeviceDesktop, IconDownload, IconCheck, IconCloudDownload } from '@tabler/icons';
import { t } from 'i18next';
import { apps } from '../../shared/config/apps.config';

const InstallationGuide = () => {
  const iosApps = apps.filter(app => app.platform === 'ios');
  const androidApps = apps.filter(app => app.platform === 'android');

  const getPriorityBadge = (priority?: number) => {
    if (priority === 1) {
      return <span style={{ color: 'red' }}>★</span>; // Пример выделения приоритета
    }
    return null;
  };

  return (
    <Tabs defaultValue="ios">
      <Group mb="md">
        <Text fw={700} size="xl">
          {t('installation-guide.widget.instrukciya')}
        </Text>
        <Tabs.List>
          <Tabs.Tab leftSection={<IconBrandApple />} value="ios">
            iOS
          </Tabs.Tab>
          <Tabs.Tab leftSection={<IconBrandAndroid />} value="android">
            Android
          </Tabs.Tab>
          <Tabs.Tab leftSection={<IconDeviceDesktop />} value="desktop">
            {t('installation-guide.widget.pk')}
          </Tabs.Tab>
        </Tabs.List>
      </Group>

      <Tabs.Panel value="ios">
        <Tabs defaultValue="happ-ios">
          {iosApps.map(app => (
            <Tabs.Tab key={app.id} value={app.id}>
              {getPriorityBadge(app.priority)} {app.name}
            </Tabs.Tab>
          ))}
          {iosApps.map(app => (
            <Tabs.Panel key={app.id} value={app.id}>
              <Timeline active={1} bulletSize={32} color="teal" lineWidth={2}>
                <Timeline.Item
                  bullet={
                    <ThemeIcon color="teal.5" radius="xl" size={26}>
                      <IconDownload size={16} />
                    </ThemeIcon>
                  }
                  title={t('installation-guide.widget.ustanovite-i-otkroite-happ')}
                >
                  <Text c="dimmed" mb={16} size="sm">
                    {t('installation-guide.widget.install-app-store-description')}
                  </Text>
                  <Button
                    component="a"
                    href={app.urlScheme}
                    leftSection={<IconCloudDownload size={16} />}
                    target="_blank"
                    variant="light"
                  >
                    {t('installation-guide.widget.open-app-store')}
                  </Button>
                </Timeline.Item>
              </Timeline>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Tabs.Panel>

      <Tabs.Panel value="android">
        <Tabs defaultValue="happ-android">
          {androidApps.map(app => (
            <Tabs.Tab key={app.id} value={app.id}>
              {getPriorityBadge(app.priority)} {app.name}
            </Tabs.Tab>
          ))}
          {androidApps.map(app => (
            <Tabs.Panel key={app.id} value={app.id}>
              <Timeline active={1} bulletSize={32} color="teal" lineWidth={2}>
                <Timeline.Item
                  bullet={
                    <ThemeIcon color="teal.5" radius="xl" size={26}>
                      <IconDownload size={16} />
                    </ThemeIcon>
                  }
                  title={t('installation-guide.widget.ustanovite-i-otkroite-happ')}
                >
                  <Text c="dimmed" mb={16} size="sm">
                    {t('installation-guide.widget.open-google-play')}
                  </Text>
                  <Button
                    component="a"
                    href={app.urlScheme}
                    leftSection={<IconCloudDownload size={16} />}
                    target="_blank"
                    variant="light"
                  >
                    {t('installation-guide.widget.open-in-google-play')}
                  </Button>
                </Timeline.Item>
              </Timeline>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Tabs.Panel>

    </Tabs>
  );
};

export default InstallationGuide;