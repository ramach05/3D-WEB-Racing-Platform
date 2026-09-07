import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const noAnyUnknown = {
  selector: 'TSAnyKeyword',
  message: 'Запрещён any — опиши конкретный тип.',
};

const noUnknown = {
  selector: 'TSUnknownKeyword',
  message: 'Запрещён unknown — опиши конкретный union или type.',
};

const noFunctionDeclaration = {
  selector: 'FunctionDeclaration',
  message: 'Используй стрелочные функции (const fn = () => {}).',
};

const fsdDeepImportBan = {
  group: [
    // app: запрет deep-файлов (@/app/i18n), public API — только @/app
    '@/app/*',
    // slices: запрет внутренностей (@/pages/home/X), public API — @/pages/home
    '@/pages/*/*',
    '@/pages/*/**',
    '@/widgets/*/*',
    '@/widgets/*/**',
    '@/features/*/*',
    '@/features/*/**',
    '@/entities/*/*',
    '@/entities/*/**',
    // shared segments: запрет @/shared/ui/button, public API — @/shared/ui
    '@/shared/*/*',
    '@/shared/*/**',
  ],
  message: 'Импортируй только public API слайса (index.ts), не внутренние файлы.',
};

const fsdRelativeParentBan = {
  group: ['../*', '../**'],
  message: 'Не используй относительные импорты через родителя. Нужен алиас @/.',
};

/** Снаружи слайса — только public API; родительские относительные пути запрещены */
const fsdPublicApiPatterns = [fsdDeepImportBan, fsdRelativeParentBan];

/**
 * Внутри race-canvas разрешены deep-импорты своего слайса через @/,
 * чужие слайсы и родительские относительные пути по-прежнему запрещены.
 */
const raceCanvasInternalPatterns = [
  {
    group: [
      '@/app/*',
      '@/pages/*/*',
      '@/pages/*/**',
      // чужие widgets — только public API; свой слайс (@/widgets/race-canvas/...) разрешён
      '@/widgets/!(race-canvas)/*',
      '@/widgets/!(race-canvas)/**',
      '@/features/*/*',
      '@/features/*/**',
      '@/entities/*/*',
      '@/entities/*/**',
      '@/shared/*/*',
      '@/shared/*/**',
    ],
    message: 'Импортируй только public API слайса (index.ts), не внутренние файлы.',
  },
  fsdRelativeParentBan,
];

/** Общие правила стиля кода для всего monorepo */
const sharedRules = {
  '@typescript-eslint/no-explicit-any': 'error',
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
  ],
  'no-restricted-syntax': ['error', noAnyUnknown, noUnknown, noFunctionDeclaration],
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
      'packages/shared/src/**/*.js',
      'eslint.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
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
    rules: {
      ...sharedRules,
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
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
