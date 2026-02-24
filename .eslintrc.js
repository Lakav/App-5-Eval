module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    // Code clarity for students
    'no-console': 'off', // Allow console.log for educational purposes
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: 'error',
    curly: 'error',
  },
  ignorePatterns: ['dist/', 'node_modules/', '.eslintrc.js', '**/*.ts'],
};
