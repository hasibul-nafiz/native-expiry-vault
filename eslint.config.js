const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

/**
 * Text that reaches the user must come from `src/i18n`, not from a literal in a
 * component. A one-off sweep would only hold until the next feature, so the
 * rule below is what actually keeps the guarantee: a bare string in JSX fails
 * `npm run lint`.
 *
 * `react/jsx-no-literals` covers JSX children. String *props* that render text
 * (`label`, `placeholder`, `accessibilityLabel`) are not reachable by any core
 * rule without a plugin, so they are covered by `no-restricted-syntax` below,
 * which matches a JSX attribute whose value is a plain string of two or more
 * words.
 */
const USER_FACING_PROPS = [
  'label',
  'title',
  'subtitle',
  'sublabel',
  'placeholder',
  'accessibilityLabel',
  'accessibilityHint',
];

const propSelector = `JSXAttribute[name.name=/^(${USER_FACING_PROPS.join('|')})$/] > Literal[value=/\\s/]`;

module.exports = [
  ...expoConfig,
  eslintConfigPrettier,
  {
    ignores: ['dist/', '.expo/', 'design/'],
  },
  {
    files: ['src/**/*.tsx', 'app/**/*.tsx'],
    ignores: [
      '**/__tests__/**',
      // The dev gallery and seed screens are `__DEV__`-only and never shipped.
      'src/theme/__dev__/**',
      'app/(app)/dev-*.tsx',
    ],
    rules: {
      'react/jsx-no-literals': [
        'error',
        { noStrings: true, ignoreProps: true, allowedStrings: ['—', '·', '%', '+', '/'] },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: propSelector,
          message:
            "User-facing text must come from src/i18n — use t('key') instead of a literal string.",
        },
      ],
    },
  },
];
