// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * ESLint (flat config, ESLint 9+).
 *
 * This config is intentionally pragmatic for a large legacy codebase that
 * still carries `@ts-nocheck`, `any`, and untyped admin components. The audit
 * (Review #180) noted there was no ESLint at all; the priority here is to give
 * the repo a real, CI-enforced linter without breaking the build on decades of
 * accumulated loose typing. As `@ts-nocheck` and `any` are removed incrementally,
 * these rules can be tightened.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // React Hooks rules are genuinely valuable and non-noisy. rules-of-hooks is
      // set to "warn" (not "error") because StaffOperationsPanel.tsx currently
      // contains pre-existing conditional hook calls that need a dedicated
      // refactor before the rule can be enforced as a hard gate.
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',

      // Legacy-code accommodation: disable the rules that would otherwise fail
      // the whole repo before its type-safety debt is paid down.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-empty': 'off',
      'no-useless-escape': 'off',
      'no-constant-condition': 'off',
      'no-empty-pattern': 'off',
      'no-async-promise-executor': 'off',
      'no-extra-boolean-cast': 'off',
      'no-prototype-builtins': 'off',
      'no-case-declarations': 'off',
      'prefer-const': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
