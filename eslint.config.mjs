import globals from "globals";
import pluginJs from "@eslint/js";


export default [
  {files: ["**/*.js"], languageOptions: {sourceType: "commonjs"}},
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
  {
    rules: {
      'class-methods-use-this': 'off',
      curly: 'error',
      'default-case': 'error',
      'dot-notation': 'error',
      'guard-for-in': 'error',
      'no-class-assign': 'error',
      'no-console': 'off',
      'no-eval': 'error',
      'no-invalid-regexp': 'error',
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'sort-imports': 'off',
    }
  }
];