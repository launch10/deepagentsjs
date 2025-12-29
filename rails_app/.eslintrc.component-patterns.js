/**
 * ESLint rules for enforcing Launch10 component patterns
 *
 * These rules prevent regressions to:
 * - Boolean-only component props (anti-pattern)
 * - Manual store syncing in components
 * - Mixing graph state with Rails data
 *
 * Usage: merge with main .eslintrc.js
 */

module.exports = {
  rules: {
    // Limit boolean props to 2 maximum
    "react/boolean-prop-naming": [
      "warn",
      {
        propNames: ["is", "has", "should", "can"],
        rule: /^(is|has|should|can)[A-Z]([A-Za-z0-9]*)$/,
        validateNested: true,
      },
    ],

    // Warn on excessive props (indicator of too-complex component)
    "react/function-component-definition": [
      "warn",
      {
        namedComponents: "function-declaration",
        unnamedComponents: "arrow-function",
      },
    ],

    // Prevent overly complex components
    "complexity": ["warn", { max: 10 }],

    // Prevent direct store mutations in components (only allowed in store files)
    "no-restricted-properties": [
      "error",
      {
        object: "state",
        property: "set",
        message:
          "Direct state.set() calls are only allowed in store definition files. Use store action methods instead.",
      },
    ],

    // Prevent manual message syncing (use SDK hooks)
    "no-restricted-syntax": [
      "warn",
      {
        selector:
          "CallExpression[callee.name='setMessages'] > Identifier[name=/useChat|useStore/]",
        message:
          "Don't manually sync messages. Use langgraph-ai-sdk hooks (useChat, useChatContext) which handle this automatically.",
      },
    ],

    // Warn on console statements that indicate debugging left in code
    "no-console": [
      "warn",
      {
        allow: ["warn", "error"],
      },
    ],

    // Require JSDoc for exported components
    "require-jsdoc": [
      "warn",
      {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: false,
          ClassDeclaration: false,
          ArrowFunctionExpression: false,
          FunctionExpression: false,
        },
      },
    ],
  },

  overrides: [
    // Store files - allow direct mutations
    {
      files: ["**/stores/*.ts", "*/stores/*.tsx"],
      rules: {
        "no-restricted-properties": "off",
      },
    },

    // Component files - strict rules
    {
      files: ["**/components/**/*.tsx"],
      rules: {
        "react/boolean-prop-naming": "error",
        "react/function-component-definition": "error",
        "complexity": ["error", { max: 8 }],
        "require-jsdoc": "warn",
      },
    },

    // Test files - relax some rules
    {
      files: ["**/*.test.tsx", "**/*.spec.tsx"],
      rules: {
        "react/boolean-prop-naming": "off",
        "require-jsdoc": "off",
      },
    },

    // Story files - relax some rules
    {
      files: ["**/*.stories.tsx"],
      rules: {
        "react/boolean-prop-naming": "off",
        "require-jsdoc": "off",
      },
    },
  ],
};
