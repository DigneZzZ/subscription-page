import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests',
    testMatch: '**/*.spec.ts',
    fullyParallel: true,
    workers: 2,
    use: {
        baseURL: 'http://127.0.0.1:3335',
        channel: 'chrome',
        locale: 'ru-RU',
        viewport: { width: 1440, height: 1000 },
        trace: 'retain-on-failure'
    },
    webServer: {
        command: 'node tests/preview-server.mjs',
        url: 'http://127.0.0.1:3335',
        reuseExistingServer: !process.env.CI
    }
})
