import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import checkFile from 'eslint-plugin-check-file';
import jsdoc from 'eslint-plugin-jsdoc';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const noAnyUnknown = {
  selector: 'TSAnyKeyword',
  message: 'any is banned — describe a concrete type.',
};

const noUnknown = {
  selector: 'TSUnknownKeyword',
  message: 'unknown is banned — describe a concrete union or type.',
};

const noFunctionDeclaration = {
  selector: 'FunctionDeclaration',
  message: 'Use arrow functions (const fn = () => {}).',
};

const noDefaultExport = {
  selector: 'ExportDefaultDeclaration',
  message: 'Use named exports (export const …), not default export.',
};

const fsdDeepImportBan = {
  group: [
    // app: deep files banned (@/app/i18n), public API — @/app only
    '@/app/*',
    // slices: internals banned (@/pages/home/X), public API — @/pages/home
    '@/pages/*/*',
    '@/pages/*/**',
    '@/widgets/*/*',
    '@/widgets/*/**',
    '@/features/*/*',
    '@/features/*/**',
    '@/entities/*/*',
    '@/entities/*/**',
    // shared segments: @/shared/ui/button banned, public API — @/shared/ui
    '@/shared/*/*',
    '@/shared/*/**',
  ],
  message: 'Import only the public API of a slice (index.ts), not internal files.',
};

const fsdRelativeParentBan = {
  group: ['../*', '../**'],
  message: 'Relative imports through the parent are banned. Use the @/ alias.',
};

/** Outside a slice only the public API; parent-relative paths are banned */
const fsdPublicApiPatterns = [fsdDeepImportBan, fsdRelativeParentBan];

/** Inside race-canvas deep imports of its own slice via @/ are allowed; foreign slices and parent-relative paths are banned */
const raceCanvasInternalPatterns = [
  {
    group: [
      '@/app/*',
      '@/pages/*/*',
      '@/pages/*/**',
      // foreign widgets — public API only; own slice (@/widgets/race-canvas/...) is allowed
      '@/widgets/!(race-canvas)/*',
      '@/widgets/!(race-canvas)/**',
      '@/features/*/*',
      '@/features/*/**',
      '@/entities/*/*',
      '@/entities/*/**',
      '@/shared/*/*',
      '@/shared/*/**',
    ],
    message: 'Import only the public API of a slice (index.ts), not internal files.',
  },
  fsdRelativeParentBan,
];

/** JSDoc is required for public functions, hooks and components */
const jsdocPublicRules = {
  ...jsdoc.configs['flat/recommended-typescript'].rules,
  'jsdoc/require-param-type': 'off',
  'jsdoc/require-returns-type': 'off',
  'jsdoc/require-param': 'off',
  'jsdoc/require-returns': 'off',
  'jsdoc/require-yields': 'off',
  'jsdoc/check-tag-names': ['error', { typed: true }],
  'jsdoc/require-description': [
    'error',
    {
      contexts: ['any'],
      descriptionStyle: 'body',
    },
  ],
  'jsdoc/require-jsdoc': [
    'error',
    {
      publicOnly: true,
      enableFixer: false,
      require: {
        ArrowFunctionExpression: true,
        ClassDeclaration: false,
        ClassExpression: false,
        FunctionDeclaration: true,
        FunctionExpression: true,
        MethodDefinition: false,
      },
      contexts: [
        // export const useX / PageShell / formatRaceTime = () => …
        'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
        'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > FunctionExpression',
      ],
    },
  ],
};

/** Shared code-style rules for the whole monorepo */
const sharedRules = {
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-console': ['error', { allow: ['warn', 'error'] }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
  ],
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: 'typeAlias',
      format: ['PascalCase'],
      prefix: ['T'],
    },
    {
      selector: 'interface',
      format: ['PascalCase'],
      prefix: ['I'],
    },
    // Hooks: useAuthUser, useRaceHud (no type-aware lint — by name only)
    {
      selector: 'variable',
      filter: {
        regex: '^use[A-Z]',
        match: true,
      },
      format: ['camelCase'],
    },
  ],
  'no-restricted-syntax': [
    'error',
    noAnyUnknown,
    noUnknown,
    noFunctionDeclaration,
    noDefaultExport,
  ],
  ...jsdocPublicRules,
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'apps/api/prisma/migrations/**',
      'apps/api/prisma/seed.js',
      'apps/api/prisma/seed.js.map',
      'apps/api/prisma/seed.d.ts',
      'apps/api/src/generated/**',
      'packages/shared/src/**/*.js',
      'eslint.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'check-file': checkFile, jsdoc },
    settings: {
      jsdoc: {
        mode: 'typescript',
      },
    },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': [
        'error',
        {
          'apps/web/src/**/': 'KEBAB_CASE',
          'apps/api/src/**/': 'KEBAB_CASE',
          'packages/*/src/**/': 'KEBAB_CASE',
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.tsx'],
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { jsdoc },
    rules: {
      ...sharedRules,
    },
  },
  // Tests and mocks: JSDoc / console not required
  {
    files: [
      '**/*.{test,spec}.{ts,tsx}',
      '**/*.integration.test.{ts,tsx}',
      '**/test/**/*.{ts,tsx}',
      'apps/api/test/**/*.ts',
    ],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-description': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['packages/shared/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}', 'apps/web/e2e/**/*.ts', 'apps/web/vitest.config.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': ['error', { patterns: fsdPublicApiPatterns }],
    },
  },
  {
    files: ['apps/web/src/widgets/race-canvas/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: raceCanvasInternalPatterns }],
    },
  },
  {
    files: ['apps/web/src/vite-env.d.ts'],
    rules: {
      '@typescript-eslint/naming-convention': 'off',
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-description': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['apps/api/src/**/*.ts', 'apps/api/test/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      // Nest: classes/methods instead of arrows — an exception to the general style
      'no-restricted-syntax': ['error', noAnyUnknown, noUnknown, noDefaultExport],
      'jsdoc/require-jsdoc': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
