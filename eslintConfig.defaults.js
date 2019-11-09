module.exports = {
  plugins: ["@typescript-eslint", "import", "jest"],
  extends: [
    "eslint:recommended",
    "prettier",
    "plugin:@typescript-eslint/recommended",
    "prettier/@typescript-eslint",
    "plugin:import/typescript",
    "plugin:jest/recommended"
  ],
  rules: {
    "no-console": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_"
      }
    ],
    "@typescript-eslint/explicit-function-return-type": [
      "warn",
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true
      }
    ]
  },
  overrides: [
    {
      files: ["**/*.js", "**/*.jsx"],
      rules: {
        "@typescript-eslint/no-var-requires": "off"
      }
    },
    {
      files: ["**/*.test.[jt]s", "**/*.test.[jt]sx"],
      env: {
        "jest/globals": true
      },
      rules: {}
    }
  ],
  env: {
    es6: true
  }
};
