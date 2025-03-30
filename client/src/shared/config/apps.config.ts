import { AppConfig } from '../types/app.types';

export const apps: AppConfig[] = [
    {
        id: 'happ',
        name: 'Happ',
        priority: 1,
        urlScheme: 'happ://add',
        platform: 'android',
        description: 'installation-guide.widget.add-subscription-description',
    },
    {
        id: 'hiddify',
        name: 'Hiddify',
        priority: 2,
        urlScheme: 'hiddify://import',
        platform: 'android',
        description: 'installation-guide.widget.add-subscription-description',
    },
    {
        id: 'v2raytun-android',
        name: 'V2RayTun',
        priority: 3,
        urlScheme: 'v2raytun://import',
        platform: 'android',
        description: 'installation-guide.widget.add-subscription-description',
    },
    {
        id: 'v2raytun-ios',
        name: 'V2RayTun',
        priority: 1,
        urlScheme: 'v2raytun://import',
        platform: 'ios',
        description: 'installation-guide.widget.add-subscription-description',
    },
    {
        id: 'shadowsocks-ios',
        name: 'Shadowsocks',
        priority: 2,
        urlScheme: 'shadowsocks://import',
        platform: 'ios',
        description: 'installation-guide.widget.add-subscription-description',
    }
];
