import rootConfig from "../../eslint.config.mjs";

export default [
  ...rootConfig,
  {
    ignores: ["android/**", "dist/**", ".expo/**"]
  },
  {
    files: ["metro.config.cjs"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        module: "readonly",
        require: "readonly"
      }
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  }
];
