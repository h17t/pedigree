import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import noBareJsxStrings from './eslint-rules/no-bare-jsx-strings.js';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((c) => ({ ...c, files: ['**/*.{ts,tsx}'] })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y, pedigree: { rules: { 'no-bare-jsx-strings': noBareJsxStrings } } },
    languageOptions: { globals: { ...globals.browser, ...globals.es2022 } },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      ...jsxA11y.configs.strict.rules,
      'pedigree/no-bare-jsx-strings': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-globals': ['error', 'event'],
    },
  },
  {
    // Plain JS config and script files are not type-checked.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node }, ecmaVersion: 2022, sourceType: 'module' },
  },
  {
    files: ['scripts/**', 'eslint-rules/**', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'tests/e2e/**'],
    languageOptions: { globals: { ...globals.node } },
  },
);
