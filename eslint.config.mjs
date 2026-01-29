import globals from 'globals';
import eslintJs from '@eslint/js';
import eslintTs from 'typescript-eslint';
import tsParser from '@typescript-eslint/parser';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

const tsFiles = ['{src,test}/**/*.ts'];

export default [
  { ignores: ['docs/*', 'build/*', 'dist/*', '**/*.js'] }, // global ignores
  eslintJs.configs.recommended,
  ...eslintTs.configs.recommended.map((config) => ({
    ...config,
    files: tsFiles,
  })),
  ...eslintTs.configs.stylistic.map((config) => ({
    ...config,
    files: tsFiles,
  })),
  {
    files: tsFiles,
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2024,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      'no-redeclare': 'off',
    },
  },
  eslintPluginPrettierRecommended,
];
