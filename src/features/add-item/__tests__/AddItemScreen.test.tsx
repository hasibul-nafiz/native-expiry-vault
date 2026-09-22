import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { itemsRepository, reminderRulesRepository } from '@/db';
import { DatabaseProvider } from '@/db/DatabaseProvider';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';
import type { Database } from '@/db/types';
import { publishScan, resetScanHandoff } from '@/features/ocr';
import type { NotificationPort, PermissionState } from '@/services/notifications';
import { ThemeProvider } from '@/theme';

import { AddItemScreen } from '../AddItemScreen';

/**
 * Saving is the app's just-in-time moment for the notification prompt, so the
 * tests have to say which permission state they are in. `granted` is the
 * default here because most of them are about the form, not the prompt.
 */
function makePort(permission: PermissionState = 'granted'): NotificationPort {
  return {
    getPermission: async () => permission,
    requestPermission: async () => permission,
    schedule: async () => 'identifier',
    cancelAll: async () => undefined,
    listScheduled: async () => [],
  };
}

const mockBack = jest.fn();
const mockPush = jest.fn();

/**
 * `useFocusEffect` runs its callback on mount here, which is what focus does
 * the first time a screen appears. The form collects a pending scan from it,
 * so a mock that did nothing would make that path untestable.
 */
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useFocusEffect: (callback: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react') as typeof import('react');

    useEffect(callback, [callback]);
  },
}));

/**
 * The date picker is a native SwiftUI / Compose view with no JS representation,
 * so it is replaced with a button that reports a fixed selection. What is under
 * test here is the form's handling of the chosen date, not the picker itself —
 * that needs a device.
 */
const PICKED_ISO_DATE = '2031-05-14';

jest.mock('@expo/ui/community/datetime-picker', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    DateTimePicker: ({
      onValueChange,
      testID,
    }: {
      onValueChange?: (event: unknown, date: Date) => void;
      testID?: string;
    }) => (
      <Pressable
        onPress={() => {
          onValueChange?.({}, new Date(2031, 4, 14, 12, 0, 0));
        }}
        testID={testID}
      >
        <Text>picker</Text>
      </Pressable>
    ),
  };
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

let db: Database;

function wrap(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <DatabaseProvider database={db}>{ui}</DatabaseProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

/** Opens the date field and selects the mock picker's fixed date. */
async function chooseExpiryDate() {
  fireEvent.press(screen.getByTestId('field-expiry'));
  fireEvent.press(await screen.findByTestId('field-expiry-picker'));

  expect(await screen.findByText(PICKED_ISO_DATE)).toBeOnTheScreen();
}

/** Walks the wizard to the details step with a category chosen. */
async function reachDetails(category = 'passport') {
  fireEvent.press(screen.getByTestId(`category-card-${category}`));
  fireEvent.press(screen.getByTestId('primary-cta'));
  expect(await screen.findByTestId('capture-pick-photos')).toBeOnTheScreen();
  fireEvent.press(screen.getByTestId('primary-cta'));
  expect(await screen.findByTestId('field-title')).toBeOnTheScreen();
}

beforeEach(async () => {
  mockBack.mockClear();
  mockPush.mockClear();
  // The handoff slot is module-level, so it outlives a single render.
  resetScanHandoff();
  db = await createMigratedTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('step gating', () => {
  it('starts on the category step', () => {
    wrap(<AddItemScreen />);

    expect(screen.getByTestId('step-progress')).toHaveAccessibilityValue({ now: 1 });
    expect(screen.getByTestId('category-grid')).toBeOnTheScreen();
  });

  it('will not advance until a category is chosen', async () => {
    wrap(<AddItemScreen />);

    fireEvent.press(screen.getByTestId('primary-cta'));

    await waitFor(() => {
      expect(screen.getByTestId('category-grid')).toBeOnTheScreen();
    });
    expect(screen.queryByTestId('capture-pick-photos')).not.toBeOnTheScreen();
  });

  it('advances once a category is chosen', async () => {
    wrap(<AddItemScreen />);

    fireEvent.press(screen.getByTestId('category-card-passport'));
    fireEvent.press(screen.getByTestId('primary-cta'));

    expect(await screen.findByTestId('capture-pick-photos')).toBeOnTheScreen();
  });

  it('will not leave the details step while required fields are invalid', async () => {
    wrap(<AddItemScreen />);
    await reachDetails();

    // No title, no expiry date.
    fireEvent.press(screen.getByTestId('primary-cta'));

    expect(await screen.findByText('Give the document a name.')).toBeOnTheScreen();
    expect(screen.queryByTestId('escalation-switch')).not.toBeOnTheScreen();
  });

  it('can step back', async () => {
    wrap(<AddItemScreen />);

    fireEvent.press(screen.getByTestId('category-card-passport'));
    fireEvent.press(screen.getByTestId('primary-cta'));
    await screen.findByTestId('capture-pick-photos');

    fireEvent.press(screen.getByTestId('back-button'));

    expect(await screen.findByTestId('category-grid')).toBeOnTheScreen();
  });

  it('offers no back button on the first step', () => {
    wrap(<AddItemScreen />);

    expect(screen.queryByTestId('back-button')).not.toBeOnTheScreen();
  });

  it('disables jump pills for steps not yet reached', async () => {
    wrap(<AddItemScreen />);

    // Unlike the export, where goToStep() lets you jump straight to Save.
    expect(screen.getByTestId('step-pill-4')).toBeDisabled();

    fireEvent.press(screen.getByTestId('category-card-passport'));
    fireEvent.press(screen.getByTestId('primary-cta'));
    await screen.findByTestId('capture-pick-photos');

    expect(screen.getByTestId('step-pill-1')).not.toBeDisabled();
    expect(screen.getByTestId('step-pill-4')).toBeDisabled();
  });
});

describe('the capture step', () => {
  it('opens the scanner, telling it this form is waiting underneath', async () => {
    wrap(<AddItemScreen />);

    fireEvent.press(screen.getByTestId('category-card-passport'));
    fireEvent.press(screen.getByTestId('primary-cta'));

    fireEvent.press(await screen.findByTestId('capture-scan'));

    // `from=add` is what makes a confirmed scan come back here rather than
    // open a second, empty form.
    expect(mockPush).toHaveBeenCalledWith('/scan?from=add');
  });

  it('applies a scan waiting in the handoff, landing on Verify to check it', async () => {
    publishScan({
      expiryDate: '2030-10-28',
      documentNumber: 'P4920191',
      country: 'GB',
      rawText: 'P<GBRSMITH<<JOHN<ROBERT',
      confidence: 0.98,
      imageUri: 'file:///captured.jpg',
    });

    wrap(<AddItemScreen />);

    // Straight to step 3: the scan prefills, and the user checks it.
    expect(await screen.findByTestId('field-title')).toBeOnTheScreen();
    expect(screen.getByText('2030-10-28')).toBeOnTheScreen();
    expect(screen.getByTestId('field-number')).toHaveDisplayValue('P4920191');
    expect(screen.getByTestId('field-country')).toHaveDisplayValue('GB');
  });

  it('applies a scan only once, so stepping back does not overwrite an edit', async () => {
    publishScan({
      expiryDate: '2030-10-28',
      rawText: 'Expires 28 OCT 2030',
      confidence: 0.7,
      imageUri: 'file:///captured.jpg',
    });

    const view = wrap(<AddItemScreen />);
    await screen.findByTestId('field-title');
    view.unmount();

    // The slot is empty now, so a form mounted afterwards starts clean.
    wrap(<AddItemScreen />);

    expect(await screen.findByTestId('category-grid')).toBeOnTheScreen();
  });

  it('can be passed with no attachment at all', async () => {
    wrap(<AddItemScreen />);
    await reachDetails();

    expect(screen.getByTestId('field-title')).toBeOnTheScreen();
  });

  it('lists a picked image and can remove it', async () => {
    const pickImages = jest.fn(async () => [
      { uri: 'file:///tmp/a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg', byteSize: 10 },
    ]);
    wrap(<AddItemScreen pickImages={pickImages} />);

    fireEvent.press(screen.getByTestId('category-card-passport'));
    fireEvent.press(screen.getByTestId('primary-cta'));
    fireEvent.press(await screen.findByTestId('capture-pick-photos'));

    expect(await screen.findByTestId('attachment-a.jpg')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('remove-a.jpg'));

    await waitFor(() => {
      expect(screen.queryByTestId('attachment-a.jpg')).not.toBeOnTheScreen();
    });
  });

  it('explains a denied photo permission instead of failing silently', async () => {
    const { PhotoPermissionError } =
      jest.requireActual<typeof import('@/services/imagePicker')>('@/services/imagePicker');
    const pickImages = jest.fn(async () => {
      throw new PhotoPermissionError();
    });
    wrap(<AddItemScreen pickImages={pickImages} />);

    fireEvent.press(screen.getByTestId('category-card-passport'));
    fireEvent.press(screen.getByTestId('primary-cta'));
    fireEvent.press(await screen.findByTestId('capture-pick-photos'));

    expect(await screen.findByTestId('capture-error')).toHaveTextContent(/access to your photos/);
  });
});

describe('validation messages', () => {
  it('rejects an invalid country code', async () => {
    wrap(<AddItemScreen />);
    await reachDetails();

    fireEvent.changeText(screen.getByTestId('field-country'), 'DEU');
    fireEvent(screen.getByTestId('field-country'), 'blur');

    expect(await screen.findByText(/two-letter country code/)).toBeOnTheScreen();
  });

  it('rejects a title of only whitespace', async () => {
    wrap(<AddItemScreen />);
    await reachDetails();

    fireEvent.changeText(screen.getByTestId('field-title'), '    ');
    fireEvent(screen.getByTestId('field-title'), 'blur');

    expect(await screen.findByText('Give the document a name.')).toBeOnTheScreen();
  });
});

describe('reminder presets', () => {
  it('pre-selects the offsets for the chosen category', async () => {
    wrap(<AddItemScreen />);
    await reachDetails('warranty');

    fireEvent.changeText(screen.getByTestId('field-title'), 'MacBook');
    await chooseExpiryDate();
    fireEvent.press(screen.getByTestId('primary-cta'));

    // Warranty's preset is 30 and 7 days, so no 180-day option exists.
    expect(await screen.findByTestId('reminder-30')).toBeOnTheScreen();
    expect(screen.getByTestId('reminder-7')).toBeOnTheScreen();
    expect(screen.queryByTestId('reminder-180')).not.toBeOnTheScreen();
  });
});

describe('saving', () => {
  it('keeps Save disabled until the form is complete', () => {
    wrap(<AddItemScreen />);

    // The export's header Save is always enabled and bypasses the wizard.
    expect(screen.getByTestId('header-save')).toBeDisabled();
  });

  it('asks for notification permission after the first save, not before', async () => {
    wrap(<AddItemScreen port={makePort('undetermined')} />);
    await reachDetails('warranty');

    fireEvent.changeText(screen.getByTestId('field-title'), 'MacBook warranty');
    await chooseExpiryDate();
    fireEvent.press(screen.getByTestId('primary-cta'));

    await screen.findByTestId('reminder-30');
    // Nothing has been asked yet: the prompt has to explain itself, and it
    // cannot until there is a document it is about.
    expect(screen.queryByTestId('reminders-sheet')).not.toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('primary-cta'));

    expect(await screen.findByTestId('reminders-sheet')).toBeOnTheScreen();
    // The document is saved first, so declining costs nothing.
    await waitFor(async () => {
      expect(await itemsRepository.listItems(db)).toHaveLength(1);
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('closes the form once the prompt is dismissed', async () => {
    wrap(<AddItemScreen port={makePort('undetermined')} />);
    await reachDetails('warranty');

    fireEvent.changeText(screen.getByTestId('field-title'), 'MacBook warranty');
    await chooseExpiryDate();
    fireEvent.press(screen.getByTestId('primary-cta'));

    await screen.findByTestId('reminder-30');
    fireEvent.press(screen.getByTestId('primary-cta'));

    fireEvent.press(await screen.findByTestId('reminders-grant'));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('does not ask again once permission has already been refused', async () => {
    wrap(<AddItemScreen port={makePort('denied')} />);
    await reachDetails('warranty');

    fireEvent.changeText(screen.getByTestId('field-title'), 'MacBook warranty');
    await chooseExpiryDate();
    fireEvent.press(screen.getByTestId('primary-cta'));

    await screen.findByTestId('reminder-30');
    fireEvent.press(screen.getByTestId('primary-cta'));

    // Re-prompting does nothing on either platform; the bell is the way back.
    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('reminders-sheet')).not.toBeOnTheScreen();
  });

  it('writes the item and dismisses the sheet', async () => {
    wrap(<AddItemScreen port={makePort('granted')} />);
    await reachDetails('warranty');

    fireEvent.changeText(screen.getByTestId('field-title'), 'MacBook warranty');
    await chooseExpiryDate();
    fireEvent.press(screen.getByTestId('primary-cta'));

    await screen.findByTestId('reminder-30');
    fireEvent.press(screen.getByTestId('primary-cta'));

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled();
    });

    const items = await itemsRepository.listItems(db);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: 'MacBook warranty', category: 'warranty' });

    const rules = await reminderRulesRepository.listReminderRulesForItem(db, items[0].id);
    expect(rules.length).toBeGreaterThan(0);
  });
});

describe('dismissing', () => {
  it('closes without prompting when nothing has been entered', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    wrap(<AddItemScreen />);

    fireEvent.press(screen.getByTestId('cancel-button'));

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('confirms before discarding a part-filled form', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    wrap(<AddItemScreen />);

    fireEvent.press(screen.getByTestId('category-card-passport'));
    await waitFor(() => {
      expect(screen.getByTestId('category-card-passport')).toBeSelected();
    });

    fireEvent.press(screen.getByTestId('cancel-button'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Discard this document?',
      expect.any(String),
      expect.any(Array),
    );
    expect(mockBack).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
