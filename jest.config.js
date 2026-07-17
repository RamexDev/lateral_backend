module.exports = {
  verbose: true,
  testEnvironment: 'node',
  testTimeout: 15000,
  forceExit: true,
  detectOpenHandles: false,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/db/migrations/**',
    '!src/db/seeds/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
