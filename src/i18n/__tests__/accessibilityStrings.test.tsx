import { render, screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Input, Text } from '@/components';
import { Keypad } from '@/features/lock/components/Keypad';
import { PinDots } from '@/features/lock/components/PinDots';
import { ThemeProvider } from '@/theme';

import { resetPreferencesStore, updatePreferences } from '@/settings/store';

import { initialiseI18n } from '../index';

/**
 * What a screen reader is handed.
 *
 * Two layers. The runtime cases prove the labels come from the catalogue, in
 * the locale the app is running in. The source scan is what stops the next
 * one being written as a literal — F13 found eight of those, plus one that had
 * been quoted by mistake and announced its own source code.
 */

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderWithTheme(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}

const noop = () => undefined;

/**
 * Switched through the preference rather than i18next directly: `useLocale`
 * pushes the preference back into i18next on every render, so a bare
 * `changeLanguage` is undone by the first component that mounts.
 */
async function useBengali() {
  await updatePreferences({ language: 'bn' });
}

beforeEach(() => {
  initialiseI18n('en');
  resetPreferencesStore();
});

afterEach(async () => {
  await updatePreferences({ language: 'en' });
  resetPreferencesStore();
});

describe('labels follow the active locale', () => {
  it('names each keypad digit in English', () => {
    renderWithTheme(<Keypad onBackspace={noop} onDigit={noop} />);

    expect(screen.getByLabelText('Digit 7')).toBeOnTheScreen();
  });

  it('names each keypad digit in Bengali', async () => {
    await useBengali();
    renderWithTheme(<Keypad onBackspace={noop} onDigit={noop} />);

    // The keypad's glyphs are Latin digits by design (see `src/i18n/format.ts`),
    // so only the word around them translates.
    expect(screen.getByLabelText('অঙ্ক 7')).toBeOnTheScreen();
  });

  it('marks a required field in the active locale', async () => {
    await useBengali();
    renderWithTheme(<Input label="নাম" required value="" />);

    expect(screen.getByLabelText('নাম, আবশ্যক')).toBeOnTheScreen();
  });

  /**
   * The composed label — six anonymous dots read as one sentence. The English
   * wording is covered in `LockScreen.test.tsx`; what matters here is that the
   * sentence is assembled by the catalogue and not by string concatenation, so
   * Bengali can put the total before the count.
   */
  it('reads the PIN dots as one element with a count', async () => {
    await useBengali();
    renderWithTheme(<PinDots filled={3} label="Master PIN" />);

    expect(screen.getByLabelText('Master PIN, 6টির মধ্যে 3টি অঙ্ক দেওয়া হয়েছে')).toBeOnTheScreen();
  });
});

describe('uppercase is presentational', () => {
  /**
   * `textTransform` changes the glyphs only. Uppercasing the string instead
   * changes what VoiceOver reads, which is how "DAYS LEFT" became four letters
   * spelled out, and does nothing at all in Bengali.
   */
  it('leaves the underlying string in its natural case', () => {
    renderWithTheme(<Text uppercase>Days left</Text>);

    expect(screen.getByText('Days left')).toBeOnTheScreen();
    expect(screen.queryByText('DAYS LEFT')).toBeNull();
  });
});

describe('no accessibility string is hardcoded', () => {
  const root = path.resolve(__dirname, '../../..');

  /**
   * The dev gallery is excluded: it is not a shipped screen and its labels name
   * component variants rather than anything a user reads.
   */
  const files = [
    'src/components/Input.tsx',
    'src/components/Card.tsx',
    'src/features/lock/components/Keypad.tsx',
    'src/features/lock/components/PinDots.tsx',
    'src/features/add-item/components/StepProgress.tsx',
    'src/features/add-item/components/DateField.tsx',
    'src/features/add-item/components/CaptureStep.tsx',
    'src/features/add-item/components/RemindersStep.tsx',
    'src/features/item-detail/components/DetailFacts.tsx',
    'src/features/item-detail/components/AttachmentsSection.tsx',
    'src/features/ocr/ScanConfirmSheet.tsx',
    'src/features/ocr/ScannerScreen.tsx',
    'app/(app)/_layout.tsx',
  ];

  /** `accessibilityLabel="Save"` or `accessibilityHint={`Read from ${x}`}`. */
  const literal = /accessibility(?:Label|Hint)=(?:"[^"]*[A-Za-z]|\{`[^`]*[A-Za-z])/;

  it.each(files)('%s builds every label from the catalogue', (file) => {
    const source = readFileSync(path.join(root, file), 'utf8');
    const offenders = source
      .split('\n')
      .map((line, index) => [index + 1, line] as const)
      .filter(([, line]) => literal.test(line));

    expect(offenders).toEqual([]);
  });
});
