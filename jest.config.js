/**
 * The suite runs in a fixed, DST-observing, non-UTC timezone.
 *
 * Two reasons. A zone with a real offset catches code that assumes local time
 * is UTC, which a CI machine running in UTC would wave through. And F7's
 * delivery-time logic can only be tested across a daylight-saving transition in
 * a zone that has one.
 *
 * It has to be set here rather than inside a test: Jest's workers read the
 * timezone when they fork, and assigning `process.env.TZ` mid-test does not
 * reach V8's cached offset.
 */
process.env.TZ = 'America/New_York';

/**
 * `@noble/hashes` (F9's PBKDF2) ships ES modules only, and the preset tells
 * Babel to skip everything in `node_modules` bar a short allowlist. Extending
 * that list by rewriting it, rather than restating it, means a jest-expo
 * upgrade that adds a package to the allowlist does not silently drop it here.
 */
const preset = require('jest-expo/jest-preset');

const transformIgnorePatterns = preset.transformIgnorePatterns.map((pattern) =>
  pattern.startsWith('/node_modules/(?!(')
    ? pattern.replace('/node_modules/(?!(', '/node_modules/(?!(@noble|')
    : pattern,
);

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  /**
   * The preset treats every file under `__tests__` as a suite. F8's parser
   * fixtures live there too — they are shared test data, not tests — so the
   * fixtures directory is excluded rather than moved somewhere less obvious.
   */
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/fixtures/'],
};
