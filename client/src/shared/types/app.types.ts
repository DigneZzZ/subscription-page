export interface AppConfig {
    id: string;
    name: string;
    priority: number;
    urlScheme: string;
    platform: 'ios' | 'android' | 'desktop';
    description: string;
    storeUrl?: string;
}
