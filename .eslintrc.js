module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
  ],
  env: {
    node: true,
    es2021: true,
  },
  rules: {
    'no-console': 'off',
    'eqeqeq': ['error', 'always'],
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '.eslintrc.js',
    'tsconfig.json',
  ],
};