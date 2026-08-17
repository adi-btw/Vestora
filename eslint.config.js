// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    // Edge Functions are Deno modules with URL imports and a different global
    // scope, so the Node-oriented rules here do not apply to them.
    ignores: ['dist/*', '.expo/*', 'coverage/*', 'supabase/functions/**'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);
