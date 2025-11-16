// @ts-check
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';

export default [
  // Configuración global
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.d.ts'
    ]
  },

  // Configuración de TypeScript
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'import': importPlugin
    },
    rules: {
      // Reglas de TypeScript
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Reglas de importación
      'import/order': ['error', {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        'alphabetize': { order: 'asc' }
      }],
      'import/no-unresolved': 'error',
      'import/named': 'error',
      'import/no-absolute-path': 'error',
      'import/no-dynamic-require': 'error',
      'import/no-self-import': 'error',
      'import/no-cycle': 'error',
      'import/no-useless-path-segments': 'error',
      'import/export': 'error',
      'import/no-named-as-default': 'error',
      'import/no-deprecated': 'warn',
      'import/no-mutable-exports': 'error',
      'import/first': 'error',
      'import/no-duplicates': 'error',
      'import/extensions': ['error', 'ignorePackages', {
        'js': 'never',
        'jsx': 'never',
        'ts': 'never',
        'tsx': 'never'
      }]
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
          moduleDirectory: ['node_modules', 'src/']
        }
      }
    }
  },

  // Configuración para tests
  {
    files: ['test/**/*.ts', 'test/**/*.tsx'],
    rules: {
      'no-console': 'off',
      'import/no-extraneous-dependencies': 'off'
    }
  }
];
