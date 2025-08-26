export default [
  {
    ignores: ["node_modules"]
  },
  {
    files: ["**/*.{js,jsx}"] ,
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    rules: {}
  }
];
