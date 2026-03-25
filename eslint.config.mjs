import nextConfig from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default [
  ...nextConfig,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'jsx-a11y/anchor-is-valid': 'error',
    },
  },
];
