// Import Vitest config helper.
import { defineConfig } from 'vitest/config';

// Export test configuration.
export default defineConfig({
  test: {
    // Use Node environment.
    environment: 'node',

    // Load shared test setup.
    setupFiles: ['./tests/setup.js'],

    // Integration tests can be slow.
    testTimeout: 30000,

    // Run test files one at a time.
    // These integration tests share MySQL and Redis state.
    fileParallelism: false
  }
});