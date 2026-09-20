import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { OcrPort } from '@/services/ocr';
import { OcrUnavailableError } from '@/services/ocr';
import { ThemeProvider } from '@/theme';

import { resetScanHandoff } from '../scanHandoff';
import { ScannerScreen } from '../ScannerScreen';

import { NO_DATE, UK_PASSPORT } from './fixtures/recognisedText';

/**
 * The camera screen, with `expo-camera` and the OCR port both faked.
 *
 * What is worth asserting here is the shape of the flow, not the picture: the
 * rationale comes before the system prompt, a refusal is not a dead end, and
 * a capture ends at the confirm sheet rather than saving anything.
 */

const TODAY = '2026-09-20';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockedPermissions = jest.mocked(useCameraPermissions);

type Permission = { granted: boolean; canAskAgain: boolean; status: string };

function setPermission(permission: Permission | null, request = jest.fn()) {
  mockedPermissions.mockReturnValue([
    permission,
    request,
    jest.fn(),
  ] as unknown as ReturnType<typeof useCameraPermissions>);

  return request;
}

const GRANTED = { granted: true, canAskAgain: true, status: 'granted' };
const UNDETERMINED = { granted: false, canAskAgain: true, status: 'undetermined' };
const REFUSED = { granted: false, canAskAgain: false, status: 'denied' };

function portReturning(text: string): OcrPort {
  return { recognize: async () => text };
}

function wrap(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}

const noop = () => undefined;

interface Overrides {
  port?: OcrPort;
  onScanned?: jest.Mock;
  onCancel?: jest.Mock;
  pickImages?: jest.Mock;
}

function renderScanner({ port = portReturning(UK_PASSPORT), ...rest }: Overrides = {}) {
  return wrap(
    <ScannerScreen
      onCancel={rest.onCancel ?? noop}
      onScanned={rest.onScanned ?? noop}
      pickImages={rest.pickImages ?? jest.fn(async () => [])}
      port={port}
      today={TODAY}
    />,
  );
}

beforeEach(() => {
  resetScanHandoff();
  setPermission(GRANTED);
});

describe('camera permission', () => {
  it('explains what the camera is for before asking the system', () => {
    const request = setPermission(UNDETERMINED);
    renderScanner();

    // The prompt is not fired on mount: the rationale is shown first.
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByText(/never uploaded/)).toBeOnTheScreen();
    expect(screen.getByTestId('scan-grant')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan-camera')).not.toBeOnTheScreen();
  });

  it('asks the system only when the user agrees to', async () => {
    const request = setPermission(UNDETERMINED, jest.fn(async () => GRANTED));
    renderScanner();

    fireEvent.press(screen.getByTestId('scan-grant'));

    await waitFor(() => {
      expect(request).toHaveBeenCalled();
    });
  });

  it('is not a dead end when the camera is refused for good', () => {
    setPermission(REFUSED);
    renderScanner();

    expect(screen.getByTestId('scan-permission-denied')).toBeOnTheScreen();
    // Both other ways in are still on the screen.
    expect(screen.getByTestId('scan-import')).toBeOnTheScreen();
    expect(screen.getByTestId('scan-manual')).toBeOnTheScreen();
    expect(screen.getByTestId('scan-settings')).toBeOnTheScreen();
  });

  it('lets a refusal be answered by typing the details in', () => {
    setPermission(REFUSED);
    const onCancel = jest.fn();
    renderScanner({ onCancel });

    fireEvent.press(screen.getByTestId('scan-manual'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('waits rather than guessing while the permission is still unknown', () => {
    setPermission(null);
    renderScanner();

    expect(screen.getByTestId('scan-permission-loading')).toBeOnTheScreen();
  });

  it('shows the viewfinder once the camera is allowed', () => {
    renderScanner();

    expect(screen.getByTestId('scan-camera')).toBeOnTheScreen();
    expect(screen.getByTestId('scan-shutter')).toBeOnTheScreen();
  });
});

describe('capturing', () => {
  it('ends a manual capture at the confirm sheet, saving nothing', async () => {
    const onScanned = jest.fn();
    renderScanner({ onScanned });

    fireEvent.press(screen.getByTestId('scan-shutter'));

    expect(await screen.findByTestId('scan-confirm-sheet')).toBeOnTheScreen();
    expect(await screen.findByTestId('scan-candidate-2030-10-28')).toBeOnTheScreen();
    expect(onScanned).not.toHaveBeenCalled();
  });

  it('hands the confirmed date back and leaves', async () => {
    const onScanned = jest.fn();
    renderScanner({ onScanned });

    fireEvent.press(screen.getByTestId('scan-shutter'));
    fireEvent.press(await screen.findByTestId('scan-candidate-2030-10-28'));

    expect(onScanned).toHaveBeenCalled();
  });

  it('offers the confirm sheet even when nothing was read', async () => {
    renderScanner({ port: portReturning(NO_DATE) });

    fireEvent.press(screen.getByTestId('scan-shutter'));

    expect(await screen.findByTestId('scan-nothing-found')).toBeOnTheScreen();
  });

  it('blames the build, not the photo, when the native module is missing', async () => {
    const port: OcrPort = {
      recognize: async () => {
        throw new OcrUnavailableError(new Error('linking error'));
      },
    };
    renderScanner({ port });

    fireEvent.press(screen.getByTestId('scan-shutter'));

    expect(await screen.findByTestId('scan-error')).toHaveTextContent(/not available on this build/);
  });

  it('can read a document from the photo library instead', async () => {
    const pickImages = jest.fn(async () => [
      { uri: 'file:///library.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg', byteSize: 1 },
    ]);
    renderScanner({ pickImages });

    fireEvent.press(screen.getByTestId('scan-import'));

    expect(await screen.findByTestId('scan-candidate-2030-10-28')).toBeOnTheScreen();
  });

  it('does nothing when the library picker is dismissed', async () => {
    const pickImages = jest.fn(async () => []);
    renderScanner({ pickImages });

    fireEvent.press(screen.getByTestId('scan-import'));

    await waitFor(() => {
      expect(pickImages).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('scan-confirm-sheet')).not.toBeOnTheScreen();
  });
});

describe('modes', () => {
  it('starts in manual, so nothing is photographed until asked', () => {
    renderScanner();

    expect(screen.getByTestId('scan-mode-manual')).toBeSelected();
    expect(screen.getByTestId('scan-mode-auto')).not.toBeSelected();
  });

  it('switches to auto and says what it is doing', () => {
    renderScanner();

    fireEvent.press(screen.getByTestId('scan-mode-auto'));

    expect(screen.getByTestId('scan-mode-auto')).toBeSelected();
    expect(screen.getByText(/Hold steady/)).toBeOnTheScreen();
  });

  it('offers the tips the export promises', () => {
    renderScanner();

    fireEvent.press(screen.getByTestId('scan-tips'));

    expect(screen.getByTestId('scan-tips-panel')).toHaveTextContent(/glare/);
  });

  it('can be closed without scanning anything', () => {
    const onCancel = jest.fn();
    renderScanner({ onCancel });

    fireEvent.press(screen.getByTestId('scan-close'));

    expect(onCancel).toHaveBeenCalled();
  });
});
