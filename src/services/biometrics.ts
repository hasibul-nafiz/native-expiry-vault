import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * The only file in the app that imports `expo-local-authentication`.
 *
 * Same containment as `src/services/notifications.ts` and `src/components/Icon.tsx`:
 * the lock feature talks to `BiometricPort`, so every unlock path is testable
 * without a native module and without hardware that Jest cannot simulate.
 */

/**
 * What the device offers. `faceId` and `touchId` are Apple's names for it and
 * are what the button has to say on iOS; Android's equivalents are generic
 * because the vendor names are not ours to use.
 */
export type BiometricKind = 'faceId' | 'touchId' | 'face' | 'fingerprint' | 'iris' | 'none';

export interface BiometricCapability {
  /** The hardware exists. */
  available: boolean;
  /** The user has actually registered a face or finger with the OS. */
  enrolled: boolean;
  kind: BiometricKind;
}

export type BiometricOutcome =
  /** Verified. */
  | { status: 'success' }
  /** The user dismissed the sheet, or asked for the PIN instead. */
  | { status: 'cancelled' }
  /** Wrong face or finger. */
  | { status: 'failed' }
  /** No hardware, nothing enrolled, or the OS has locked biometrics out. */
  | { status: 'unavailable' };

export interface BiometricPromptOptions {
  promptMessage: string;
  cancelLabel: string;
}

export interface BiometricPort {
  getCapability(): Promise<BiometricCapability>;
  authenticate(options: BiometricPromptOptions): Promise<BiometricOutcome>;
}

export const UNAVAILABLE: BiometricCapability = {
  available: false,
  enrolled: false,
  kind: 'none',
};

function kindFor(types: LocalAuthentication.AuthenticationType[]): BiometricKind {
  const { FACIAL_RECOGNITION, FINGERPRINT, IRIS } = LocalAuthentication.AuthenticationType;

  if (types.includes(FACIAL_RECOGNITION)) {
    return Platform.OS === 'ios' ? 'faceId' : 'face';
  }

  if (types.includes(FINGERPRINT)) {
    return Platform.OS === 'ios' ? 'touchId' : 'fingerprint';
  }

  if (types.includes(IRIS)) {
    return 'iris';
  }

  return 'none';
}

/**
 * `lockout` and `lockout_permanent` are reported as unavailable rather than
 * failed: the OS has taken biometrics away for now, and the honest response is
 * to send the user to the PIN, not to let them keep tapping a sensor that will
 * not answer.
 */
function outcomeFor(error: LocalAuthentication.LocalAuthenticationError): BiometricOutcome {
  switch (error) {
    case 'user_cancel':
    case 'app_cancel':
    case 'system_cancel':
    case 'user_fallback':
              return { status: 'cancelled' };
    case 'not_available':
    case 'not_enrolled':
    case 'passcode_not_set':
    case 'lockout':
      return { status: 'unavailable' };
    default:
      return { status: 'failed' };
  }
}

export const biometricPort: BiometricPort = {
  async getCapability() {
    const available = await LocalAuthentication.hasHardwareAsync();

    if (!available) {
      return UNAVAILABLE;
    }

    const [enrolled, types] = await Promise.all([
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    return { available, enrolled, kind: kindFor(types) };
  },

  async authenticate({ promptMessage, cancelLabel }) {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      /*
        The app's own master PIN is the fallback, so the OS must not offer the
        device passcode as well. Two different "enter your code" screens behind
        one lock is a worse experience than one, and the device passcode does
        not prove knowledge of the PIN this vault was locked with.
      */
      disableDeviceFallback: true,
      /*
        Android only. A camera-based face unlock (Class 2) is weaker than the
        six-digit PIN it would be bypassing, so only Class 3 sensors count.
      */
      biometricsSecurityLevel: 'strong',
    });

    return result.success ? { status: 'success' } : outcomeFor(result.error);
  },
};
