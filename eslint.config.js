// @ts-check
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

const tsFiles = ['src/**/*.ts', 'apps/**/*.ts', 'libs/**/*.ts', 'test/**/*.ts'];

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },

  // Flat recommended from @typescript-eslint: configures parser + recommended rules
  ...tsPlugin.configs['flat/recommended'],

  // Project-specific overrides + Prettier
  {
    files: tsFiles,
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      // Disable ESLint rules that conflict with Prettier
      ...prettierConfig.rules,

      'prettier/prettier': ['error', { endOfLine: 'auto' }],

      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Not in the original recommended — allow require() for Node.js polyfills
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
