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

module.exports = {
  preset: 'jest-expo',
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
