import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, Screen, Text } from '@/components';
import type { IsoDate } from '@/db/models';
import { todayLocal } from '@/features/expiry';
import { pickImagesFromLibrary, PhotoPermissionError } from '@/services/imagePicker';
import { ocrPort, OcrUnavailableError, type OcrPort } from '@/services/ocr';
import { useTheme } from '@/theme';

import {
  AUTO_CAPTURE_INTERVAL_MS,
  autoCaptureReducer,
  initialAutoCaptureState,
  shouldCapture,
} from './autoCapture';
import type { DateCandidate } from './parseDates';
import { ScanConfirmSheet } from './ScanConfirmSheet';
import { publishScan } from './scanHandoff';
import { scanImage, type ScanResult } from './scanImage';

/**
 * The camera, the OCR pass, and the route back with a date.
 *
 * Presented full-screen with no tab bar, which is how the export draws it. The
 * Scan tab is a launcher for this screen rather than the screen itself, so the
 * camera is only ever mounted while it is being looked at — a camera held open
 * behind a tab is a battery and privacy cost for nothing.
 *
 * Everything that decides anything is elsewhere and pure: `parseDates`,
 * `parseMrz` and `autoCaptureReducer`. What is left here is a timer, a
 * shutter, and a permission.
 */

/** Auto mode's stills are for a model, not an album. */
const AUTO_QUALITY = 0.5;
/** The manual shutter's still may be kept as the document's attachment. */
const MANUAL_QUALITY = 0.8;

type Mode = 'auto' | 'manual';

export interface ScannerScreenProps {
  /**
   * What to do with a confirmed scan. The route decides: dismissing back to a
   * waiting add-item form, or opening one.
   */
  onScanned: () => void;
  /** Leave without a scan. */
  onCancel: () => void;
  /** Injected by tests. */
  port?: OcrPort;
  pickImages?: typeof pickImagesFromLibrary;
  today?: IsoDate;
}

export function ScannerScreen({
  onScanned,
  onCancel,
  port = ocrPort,
  pickImages = pickImagesFromLibrary,
  today,
}: ScannerScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const [mode, setMode] = useState<Mode>('manual');
  const [auto, dispatch] = useReducer(autoCaptureReducer, initialAutoCaptureState);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [tipsOpen, setTipsOpen] = useState(false);
  const [asking, setAsking] = useState(false);

  const [resolvedToday] = useState(() => today ?? todayLocal());

  /**
   * What the confirm sheet shows: a manual capture if there was one, else
   * whatever auto mode locked onto.
   *
   * Derived rather than copied into state. Mirroring the reducer's result into
   * a second `useState` from an effect would make two sources of truth for one
   * fact and give the sheet a frame where it disagrees with the machine.
   */
  const shownResult = result ?? (auto.phase === 'locked' ? auto.result : null);

  /** One pass: capture, recognise, parse. Shared by both modes. */
  const runScan = useCallback(
    async (uri: string): Promise<ScanResult> => {
      const scanned = await scanImage(port, uri, resolvedToday);
      setImageUri(uri);

      return scanned;
    },
    [port, resolvedToday],
  );

  const describeFailure = useCallback((cause: unknown): string => {
    if (cause instanceof OcrUnavailableError) {
      return 'Text recognition is not available on this build of the app. Type the date in instead.';
    }

    return 'That image could not be read. Try again, or type the date in instead.';
  }, []);

  const shoot = useCallback(async () => {
    setError(undefined);
    setBusy(true);

    try {
      const photo = await camera.current?.takePictureAsync({ quality: MANUAL_QUALITY });

      if (photo === undefined) {
        setError('The camera did not return an image. Try again.');

        return;
      }

      setResult(await runScan(photo.uri));
    } catch (cause) {
      setError(describeFailure(cause));
    } finally {
      setBusy(false);
    }
  }, [describeFailure, runScan]);

  /**
   * The auto-capture loop.
   *
   * The reducer decides whether a picture is due; this only takes it. Nothing
   * here sets a deadline of its own, which is what keeps the attempt cap the
   * single place the loop can be stopped.
   */
  useEffect(() => {
    if (mode !== 'auto' || permission?.granted !== true) {
      return;
    }

    const timer = setInterval(() => {
      dispatch({ type: 'tick' });
    }, AUTO_CAPTURE_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [mode, permission?.granted]);

  useEffect(() => {
    if (!shouldCapture(auto)) {
      return;
    }

    let live = true;

    camera.current
      ?.takePictureAsync({ quality: AUTO_QUALITY, skipProcessing: true })
      .then(async (photo) => {
        const scanned = await scanImage(port, photo.uri, resolvedToday);

        if (live) {
          setImageUri(photo.uri);
          dispatch({ type: 'result', result: scanned });
        }
      })
      .catch(() => {
        if (live) {
          // A blurred frame or a busy camera. Ordinary; the loop carries on.
          dispatch({ type: 'failed' });
        }
      });

    return () => {
      live = false;
    };
  }, [auto, port, resolvedToday]);

  // Backgrounding stops the loop. A phone in a pocket must not keep taking
  // photographs and running a model over them.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        dispatch({ type: 'stop' });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const chooseMode = useCallback((next: Mode) => {
    setMode(next);
    dispatch(next === 'auto' ? { type: 'start' } : { type: 'stop' });
  }, []);

  const importFromLibrary = useCallback(async () => {
    setError(undefined);
    setBusy(true);

    try {
      const [picked] = await pickImages();

      if (picked === undefined) {
        return;
      }

      setResult(await runScan(picked.uri));
    } catch (cause) {
      setError(
        cause instanceof PhotoPermissionError
          ? 'ExpiryVault needs access to your photos to read a document from one.'
          : describeFailure(cause),
      );
    } finally {
      setBusy(false);
    }
  }, [describeFailure, pickImages, runScan]);

  const confirm = useCallback(
    (candidate: DateCandidate, date: IsoDate) => {
      if (shownResult === null || imageUri === null) {
        return;
      }

      const mrz = shownResult.mrz;

      publishScan({
        expiryDate: date,
        ...(mrz?.documentNumber !== null && mrz?.documentNumber !== undefined
          ? { documentNumber: mrz.documentNumber }
          : {}),
        ...(mrz?.issuingCountry !== null && mrz?.issuingCountry !== undefined
          ? { country: mrz.issuingCountry }
          : {}),
        rawText: shownResult.rawText,
        confidence: candidate.score,
        imageUri,
      });

      onScanned();
    },
    [imageUri, onScanned, shownResult],
  );

  const retake = useCallback(() => {
    setResult(null);
    dispatch(mode === 'auto' ? { type: 'start' } : { type: 'stop' });
  }, [mode]);

  const grant = useCallback(() => {
    setAsking(true);
    void requestPermission().finally(() => {
      setAsking(false);
    });
  }, [requestPermission]);

  if (permission === null) {
    return (
      <Screen>
        <Text color="onSurfaceVariant" testID="scan-permission-loading" variant="bodyMd">
          Checking camera access…
        </Text>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <CameraRationale
        askable={permission.canAskAgain}
        asking={asking}
        error={error}
        onCancel={onCancel}
        onGrant={grant}
        onImport={importFromLibrary}
      />
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.inverseSurface }]}>
      <CameraView facing="back" ref={camera} style={styles.fill} testID="scan-camera" />

      <View
        pointerEvents="box-none"
        style={[
          styles.overlay,
          { paddingBottom: insets.bottom + theme.spacing.lg, paddingTop: insets.top },
        ]}
      >
        <View style={[styles.topRow, { padding: theme.spacing.md }]}>
          <Button label="Close" onPress={onCancel} size="sm" testID="scan-close" variant="ghost" />
          <Button
            label="Tips"
            onPress={() => {
              setTipsOpen((open) => !open);
            }}
            size="sm"
            testID="scan-tips"
            variant="ghost"
          />
        </View>

        <View pointerEvents="none" style={styles.frameArea}>
          <View
            style={[
              styles.frame,
              { borderColor: theme.colors.inverseOnSurface, borderRadius: theme.radius.lg },
            ]}
            testID="scan-frame"
          />
          <Text color="inverseOnSurface" style={styles.hint} variant="bodyMd">
            {statusHint(mode, auto.phase, busy)}
          </Text>
        </View>

        {tipsOpen ? (
          <View
            style={[
              styles.tips,
              {
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.lg,
                gap: theme.spacing.xs,
                margin: theme.spacing.md,
                padding: theme.spacing.md,
              },
            ]}
            testID="scan-tips-panel"
          >
            <Text variant="labelLg">Getting a clean read</Text>
            <Text color="onSurfaceVariant" variant="bodySm">
              Lay the document flat, fill the frame, and avoid direct glare on the page.
            </Text>
          </View>
        ) : null}

        {error === undefined ? null : (
          <View
            style={[
              styles.tips,
              {
                backgroundColor: theme.colors.errorContainer,
                borderRadius: theme.radius.lg,
                margin: theme.spacing.md,
                padding: theme.spacing.md,
              },
            ]}
          >
            <Text color="onErrorContainer" testID="scan-error" variant="bodySm">
              {error}
            </Text>
          </View>
        )}

        <View style={[styles.controls, { gap: theme.spacing.md, padding: theme.spacing.md }]}>
          <View style={[styles.modes, { gap: theme.spacing.sm }]}>
            <ModeChip active={mode === 'manual'} label="Manual" onPress={chooseMode} value="manual" />
            <ModeChip active={mode === 'auto'} label="Auto" onPress={chooseMode} value="auto" />
          </View>

          <Pressable
            accessibilityLabel="Capture the document"
            accessibilityRole="button"
            accessibilityState={{ busy, disabled: busy }}
            disabled={busy}
            onPress={() => {
              void shoot();
            }}
            style={({ pressed }) => [
              styles.shutter,
              {
                backgroundColor: theme.colors.inverseOnSurface,
                borderColor: theme.colors.primary,
              },
              pressed || busy ? { opacity: theme.interaction.pressedOpacity } : null,
            ]}
            testID="scan-shutter"
          />

          <Button
            disabled={busy}
            label="Import from library"
            onPress={() => {
              void importFromLibrary();
            }}
            testID="scan-import"
            variant="secondary"
          />
        </View>
      </View>

      <ScanConfirmSheet
        imageUri={imageUri}
        onConfirm={confirm}
        onEnterManually={onCancel}
        onRetake={retake}
        result={shownResult}
        visible={shownResult !== null}
      />
    </View>
  );
}

/** What the frame says, so the user knows whether anything is happening. */
export function statusHint(mode: Mode, phase: string, busy: boolean): string {
  if (busy) {
    return 'Reading the document…';
  }

  if (mode !== 'auto') {
    return 'Align the document inside the frame, then tap the shutter.';
  }

  if (phase === 'exhausted') {
    return 'Nothing readable yet. Tap the shutter to capture it yourself.';
  }

  return 'Hold steady — looking for a date.';
}

interface ModeChipProps {
  label: string;
  value: Mode;
  active: boolean;
  onPress: (value: Mode) => void;
}

function ModeChip({ label, value, active, onPress }: ModeChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={`${label} capture`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        onPress(value);
      }}
      style={{
        backgroundColor: active ? theme.colors.primary : theme.colors.surfaceContainerHighest,
        borderRadius: theme.radius.full,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
      }}
      testID={`scan-mode-${value}`}
    >
      <Text color={active ? 'onPrimary' : 'onSurface'} variant="labelMd">
        {label}
      </Text>
    </Pressable>
  );
}

interface CameraRationaleProps {
  askable: boolean;
  asking: boolean;
  error?: string;
  onGrant: () => void;
  onImport: () => Promise<void>;
  onCancel: () => void;
}

/**
 * The rationale, shown before the system prompt and again after a refusal.
 *
 * A refusal is not a dead end. Both other ways of getting a document in —
 * a photo from the library, or typing the date — are on this screen, because
 * someone who declines the camera still has a passport that expires.
 */
function CameraRationale({
  askable,
  asking,
  error,
  onGrant,
  onImport,
  onCancel,
}: CameraRationaleProps) {
  const theme = useTheme();

  return (
    <Screen>
      <View style={{ gap: theme.spacing.md }}>
        <Icon color="primary" name="search" size={32} />
        <Text accessibilityRole="header" variant="headlineMd">
          Scan a document
        </Text>
        <Text color="onSurfaceVariant" variant="bodyMd">
          ExpiryVault uses the camera only to read dates off the document in front of it. The image
          is processed on this device, it is never uploaded, and it is not kept unless you choose to
          attach it.
        </Text>

        {error === undefined ? null : (
          <Text color="error" testID="scan-error" variant="bodySm">
            {error}
          </Text>
        )}

        {askable ? (
          <Button
            disabled={asking}
            label="Allow camera access"
            loading={asking}
            onPress={onGrant}
            testID="scan-grant"
          />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <Text testID="scan-permission-denied" variant="bodyMd">
              Camera access is switched off for ExpiryVault. You can turn it on in Settings, or add
              the document another way.
            </Text>
            <Button
              label="Open settings"
              onPress={() => {
                void Linking.openSettings();
              }}
              testID="scan-settings"
              variant="secondary"
            />
          </View>
        )}

        <Button
          label="Use a photo instead"
          onPress={() => {
            void onImport();
          }}
          testID="scan-import"
          variant="secondary"
        />
        <Button
          label="Type the details in"
          onPress={onCancel}
          testID="scan-manual"
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { alignItems: 'center' },
  fill: { flex: 1 },
  frame: { borderWidth: 2, height: '55%', width: '85%' },
  frameArea: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  hint: { position: 'absolute', textAlign: 'center' },
  modes: { flexDirection: 'row' },
  overlay: {
    bottom: 0,
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  shutter: { borderRadius: 36, borderWidth: 4, height: 72, width: 72 },
  tips: {},
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
