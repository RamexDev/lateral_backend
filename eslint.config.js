// Import ESLint recommended rules.
import js from '@eslint/js';

// Export ESLint flat configuration.
export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-unused-vars': 'warn'
    }
  }
];
