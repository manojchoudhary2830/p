import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@domains/(.*)$': '<rootDir>/src/domains/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: false }],
  },
  setupFilesAfterEnv: ['<rootDir>/tests/fixtures/setup.ts'],
  testMatch: ['**/*.test.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/domains/**/*.ts',
    'src/shared/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThresholds: {
    global: { branches: 70, functions: 75, lines: 75, statements: 75 },
  },
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};

export default config;
