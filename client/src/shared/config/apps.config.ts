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
}

export const apps: App[] = [
  // iOS Apps
  {
    id: 'happ-ios',
    name: 'Happ',
    platform: 'ios',
    urlScheme: 'happ://',
    badges: [{ type: 'top', label: 'TOP' }]
  },
  {
    id: 'v2raytun-ios',
    name: 'v2rayTun',
    platform: 'ios',
    urlScheme: 'v2raytun://'
  },
  {
    id: 'streisand-ios',
    name: 'Streisand',
    platform: 'ios',
    urlScheme: 'streisand://'
  },
  {
    id: 'shadowrocket-ios',
    name: 'ShadowRocket',
    platform: 'ios',
    urlScheme: 'shadowrocket://'
  },

  // Android Apps
  {
    id: 'happ-android',
    name: 'Happ',
    platform: 'android',
    urlScheme: 'happ://',
    badges: [{ type: 'top', label: 'TOP' }]
  },
  {
    id: 'hiddify-android',
    name: 'Hiddify',
    platform: 'android',
    urlScheme: 'hiddify://',
    badges: [{ type: 'beta', label: 'BETA' }]
  },
  {
    id: 'v2raytun-android',
    name: 'v2rayTun',
    platform: 'android',
    urlScheme: 'v2raytun://'
  },

  // Windows Apps
  {
    id: 'hiddify-windows',
    name: 'Hiddify',
    platform: 'windows',
    urlScheme: 'hiddify://',
    badges: [{ type: 'top', label: 'TOP' }]
  },
  {
    id: 'flclash-windows',
    name: 'FlClash',
    platform: 'windows',
    urlScheme: 'flclash://',
    badges: [{ type: 'beta', label: 'BETA' }]
  }
];