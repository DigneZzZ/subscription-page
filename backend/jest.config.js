/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: 'src',
    testRegex: '.*\\.spec\\.ts$',
    moduleNameMapper: {
        '^@common/(.*)$': '<rootDir>/common/$1',
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
        'node_modules/nanoid/.+\\.js$': [
            'ts-jest',
            { tsconfig: 'tsconfig.json', isolatedModules: true },
        ],
    },
    transformIgnorePatterns: ['node_modules/(?!(nanoid)/)'],
};
