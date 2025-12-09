const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const tsParser = require("@typescript-eslint/parser");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const simpleImportSort = require("eslint-plugin-simple-import-sort");
const _import = require("eslint-plugin-import");
const unusedImports = require("eslint-plugin-unused-imports");
const localRules = require("eslint-plugin-local-rules");

const {
    fixupPluginRules,
} = require("@eslint/compat");

const globals = require("globals");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    languageOptions: {
        parser: tsParser,
        sourceType: "module",

        parserOptions: {
            project: "tsconfig.json",
            tsconfigRootDir: __dirname,
            warnOnUnsupportedTypeScriptVersion: false,
            EXPERIMENTAL_useSourceOfProjectReferenceRedirect: true,
        },

        globals: {
            ...globals.node,
            ...globals.jest,
            Atomics: "readonly",
            SharedArrayBuffer: "readonly",
        },
    },

    plugins: {
        "@typescript-eslint": typescriptEslint,
        "simple-import-sort": simpleImportSort,
        import: fixupPluginRules(_import),
        "unused-imports": unusedImports,
        "local-rules": localRules,
    },

    extends: compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:prettier/recommended",
    ),

    rules: {
        "@typescript-eslint/interface-name-prefix": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-empty-object-type": "off",
        "@typescript-eslint/no-wrapper-object-types": "off",
        "@typescript-eslint/no-unused-expressions": "off",
        "@typescript-eslint/no-explicit-any": "warn",
        "@typescript-eslint/no-empty-function": "warn",
        "@typescript-eslint/no-non-null-assertion": "warn",
        "@typescript-eslint/no-unused-vars": "off",
        "unused-imports/no-unused-imports": "error",

        "unused-imports/no-unused-vars": ["warn", {
            vars: "all",
            varsIgnorePattern: "^_",
            args: "after-used",
            argsIgnorePattern: "^_",
            ignoreRestSiblings: true,
        }],

        "import/first": "error",
        "import/no-duplicates": "error",
        "simple-import-sort/imports": "error",
        "simple-import-sort/exports": "error",

        "prettier/prettier": ["error", {
            endOfLine: "auto",
        }],

        "local-rules/no-console-in-production": "warn",
        "local-rules/no-direct-process-env": "error",
        "local-rules/no-hardcoded-credentials": "error",
        "local-rules/consistent-error-handling": "off",
    },
}, globalIgnores([
    "eslint-local-rules/**/*",
    "**/dist",
    "**/node_modules",
])]);
