import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { files: ["**/*.{js,mjs,cjs,ts}"], languageOptions: { globals: globals.browser } },
  { files: ["**/*.{js,mjs,cjs,ts}"], plugins: { js }, extends: ["js/recommended"] },
  tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      // Enforce explicit type annotations
      "@typescript-eslint/typedef": [
        "warn",
        {
          arrayDestructuring: true,
          arrowParameter: true,
          memberVariableDeclaration: true,
          objectDestructuring: true,
          parameter: true,
          propertyDeclaration: true,
          variableDeclaration: true
        }
      ],
      "@typescript-eslint/explicit-function-return-type": ["warn"],
      "@typescript-eslint/no-inferrable-types": "off", // Allows explicit types even when they could be inferred

      // Allow 'any' type to be used
      "@typescript-eslint/no-explicit-any": "off", // This turns off the rule that would otherwise disallow using 'any'

    }
  }
]);
