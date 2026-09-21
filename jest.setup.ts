/**
 * `expo-crypto` is a native module. Under jest-expo its automock resolves
 * `randomUUID()` to `undefined`, which would silently write null primary keys in
 * repository tests, so it is replaced with a deterministic double here rather
 * than in every test file.
 *
 * Determinism is the point: ids and key bytes are stable across runs, so a
 * failing assertion names a real bug rather than a random value.
 */
jest.mock('expo-crypto', () => {
  let counter = 0;

  return {
    randomUUID: (): string => {
      counter += 1;

      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    },
    getRandomBytesAsync: async (byteCount: number): Promise<Uint8Array> =>
      Uint8Array.from({ length: byteCount }, (_unused, index) => (index * 7 + 13) % 256),
  };
});

/**
 * `expo-notifications` is a native module too, and jest-expo's automock leaves
 * its emitter half-built — reading the last response throws before any test
 * assertion runs. The double below is inert but well-formed: no permission has
 * been asked for and nothing is pending, which is the state a fresh install is
 * in.
 *
 * Tests that care about the boundary (`src/services/__tests__/notifications`)
 * mock the module themselves, which takes precedence over this.
 */
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2, MAX: 5, MIN: 1 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({
    granted: false,
    canAskAgain: true,
    status: 'undetermined',
    expires: 'never',
  })),
  requestPermissionsAsync: jest.fn(async () => ({
    granted: false,
    canAskAgain: true,
    status: 'undetermined',
    expires: 'never',
  })),
  scheduleNotificationAsync: jest.fn(async () => 'test-notification'),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

/**
 * `@react-native-ml-kit/text-recognition` is a bare native module with no JS
 * fallback: importing it outside a dev build hands back a Proxy that throws on
 * any property access. Nothing in the suite should reach the real thing —
 * every OCR test drives a fake `OcrPort` — but `src/services/ocr.ts` imports
 * it at module scope, so anything that transitively imports the scanner needs
 * this to exist.
 *
 * It recognises nothing on purpose. A double that returned text would be
 * asserting the fixture, not the parser.
 */
jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: { recognize: jest.fn(async () => ({ text: '', blocks: [] })) },
  TextRecognitionScript: { LATIN: 'Latin' },
}));

/**
 * `expo-camera`'s automock gives `CameraView` no ref methods, so a test that
 * taps the shutter fails on `takePictureAsync` being undefined rather than on
 * anything it meant to assert.
 *
 * Permission starts undetermined and askable, which is what a fresh install
 * looks like; the tests that care set their own.
 */
jest.mock('expo-camera', () => {
  // `jest.mock` factories are hoisted above the imports, so React has to be
  // pulled in here rather than at the top of the file.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');

  const CameraView = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      const handle = { takePictureAsync: async () => ({ uri: 'file:///captured.jpg' }) };

      if (typeof ref === 'function') {
        ref(handle);
      } else if (ref !== null && typeof ref === 'object') {
        (ref as { current: unknown }).current = handle;
      }

    return React.createElement('CameraView', props);
  });

  CameraView.displayName = 'CameraView';

  return {
    CameraView,
    useCameraPermissions: jest.fn(() => [
      { granted: false, canAskAgain: true, status: 'undetermined', expires: 'never' },
      jest.fn(async () => ({ granted: true, canAskAgain: true, status: 'granted' })),
      jest.fn(),
    ]),
  };
});

/**
 * `expo-local-authentication`'s automock returns `undefined` from every query,
 * which reads as "no hardware" only by accident. This says it explicitly: a
 * device with no biometric sensor, which is the state every test that is not
 * about biometrics should see. F9's own tests inject a `BiometricPort` fake and
 * never reach this.
 */
jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
  authenticateAsync: jest.fn(async () => ({ success: false, error: 'not_available' })),
}));

/**
 * `expo-screen-capture` sets a native window flag with nothing to observe from
 * JS. Inert doubles keep `PrivacyShield`'s effect from throwing in every test
 * that mounts the root layout.
 */
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => undefined),
  allowScreenCaptureAsync: jest.fn(async () => undefined),
}));
