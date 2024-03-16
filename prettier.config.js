/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
const config = {
  plugins: ["prettier-plugin-tailwindcss"],
  "trailingComma": "all",
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 120,
  "proseWrap": "preserve",
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always"
};

export default config;
