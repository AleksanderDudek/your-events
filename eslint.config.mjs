import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

// What eslint-config-next used to enforce (core JS, TypeScript, the Rules of
// Hooks / React Compiler checks, its handful of JSX accessibility rules), minus
// the @next/* rules that have nothing left to check.
export default tseslint.config(
  { ignores: ['build/**', 'out/**', '.react-router/**', 'dev-dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    plugins: { 'jsx-a11y': jsxA11y },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // The JSX accessibility rules eslint-config-next enabled, at its severity.
      // Accessibility is otherwise checked where it can be seen: jest-axe in
      // the unit specs, @axe-core/playwright in e2e/a11y.spec.ts.
      'jsx-a11y/alt-text': ['warn', { elements: ['img'] }],
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-proptypes': 'warn',
      'jsx-a11y/aria-unsupported-elements': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      'jsx-a11y/role-supports-aria-props': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'jsx-a11y/anchor-is-valid': 'error',
    },
  },
  {
    // The service worker runs in a worker scope.
    files: ['src/sw.ts'],
    languageOptions: { globals: globals.serviceworker },
  }
);
