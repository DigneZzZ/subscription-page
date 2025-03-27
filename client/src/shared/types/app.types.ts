export interface AppConfig {
    id: string;
    name: string;
    priority: number;
    url?: string;
    urlScheme: string;
    platform: 'ios' | 'android' | 'desktop';
    description: string;
    storeUrl?: string;
}
