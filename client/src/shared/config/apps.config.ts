interface AppBadge {
  type: 'top' | 'beta';
  label: string;
}

export interface App {
  id: string;
  name: string;
  platform: 'ios' | 'android' | 'windows';
  urlScheme: string;
  badges?: AppBadge[];
  priority?: number; // Добавляем атрибут для приоритета
}

export const apps: App[] = [
  // iOS Apps
  {
    id: 'happ-ios',
    name: 'Happ',
    platform: 'ios',
    urlScheme: 'happ://',
    badges: [{ type: 'top', label: 'TOP' }],
    priority: 1 // Пример приоритета
  },
  {
    id: 'v2raytun-ios',
    name: 'v2rayTun',
    platform: 'ios',
    urlScheme: 'v2raytun://',
    priority: 2
  },
  {
    id: 'shadowsocks-ios',
    name: 'Shadowsocks',
    platform: 'ios',
    urlScheme: 'shadowsocks://',
    priority: 3
  },

  // Android Apps
  {
    id: 'happ-android',
    name: 'Happ',
    platform: 'android',
    urlScheme: 'happ://',
    badges: [{ type: 'top', label: 'TOP' }],
    priority: 1
  },
  {
    id: 'v2raytun-android',
    name: 'v2rayTun',
    platform: 'android',
    urlScheme: 'v2raytun://',
    priority: 2
  },
  {
    id: 'hiddify-android',
    name: 'Hiddify',
    platform: 'android',
    urlScheme: 'hiddify://',
    badges: [{ type: 'beta', label: 'BETA' }],
    priority: 3
  }
];