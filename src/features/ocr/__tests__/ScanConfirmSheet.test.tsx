import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme';

import { ScanConfirmSheet } from '../ScanConfirmSheet';
import { scanImage, type ScanResult } from '../scanImage';

import { UK_PASSPORT, WARRANTY_RECEIPT } from './fixtures/recognisedText';

/**
 * The gate every scan passes through. What matters is that an ambiguous
 * reading cannot be accepted without choosing between its two dates, and that
 * there is always a way out to typing it in.
 */

const TODAY = '2026-09-20';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function wrap(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
}

/**
 * Built through the real pipeline rather than assembled by hand, so what the
 * sheet is given is what the scanner actually produces — including the MRZ
 * candidate, which `parseDates` alone does not supply.
 */
async function resultFor(text: string): Promise<ScanResult> {
  return scanImage({ recognize: async () => text }, 'file:///captured.jpg', TODAY);
}

const noop = () => undefined;

/** The common case, built once: a passport with a verified MRZ. */
let passport: ScanResult;

beforeAll(async () => {
  passport = await resultFor(UK_PASSPORT);
});

interface Overrides {
  result?: ScanResult | null;
  onConfirm?: jest.Mock;
  onRetake?: jest.Mock;
  onEnterManually?: jest.Mock;
}

function renderSheet({ result = passport, ...handlers }: Overrides = {}) {
  return wrap(
    <ScanConfirmSheet
      imageUri="file:///captured.jpg"
      onConfirm={handlers.onConfirm ?? noop}
      onEnterManually={handlers.onEnterManually ?? noop}
      onRetake={handlers.onRetake ?? noop}
      result={result}
      visible
    />,
  );
}

describe('ScanConfirmSheet', () => {
  it('offers the dates it read and returns the one chosen', () => {
    const onConfirm = jest.fn();
    renderSheet({ onConfirm });

    fireEvent.press(screen.getByTestId('scan-candidate-2030-10-28'));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2030-10-28', format: 'mrz' }),
      '2030-10-28',
    );
  });

  it('shows the captured image so the user can see what was read', () => {
    renderSheet();

    expect(screen.getByTestId('scan-preview')).toBeOnTheScreen();
  });

  it('says a passport expiry came from a verified machine-readable zone', () => {
    renderSheet();

    expect(screen.getByText(/checksum verified/)).toBeOnTheScreen();
  });

  it('lists the other fields the zone supplied', () => {
    renderSheet();

    expect(screen.getByTestId('scan-mrz')).toHaveTextContent(/P4920191/);
    expect(screen.getByTestId('scan-mrz')).toHaveTextContent(/GB/);
  });

  it('offers both readings of an ambiguous date, neither preselected', async () => {
    renderSheet({ result: await resultFor(WARRANTY_RECEIPT) });

    // The receipt has two ambiguous dates — purchase and warranty end — so
    // each gets its own block of two.
    expect(screen.getAllByTestId('scan-ambiguous').length).toBeGreaterThan(0);
    expect(screen.getByTestId('scan-candidate-2029-03-04')).toBeOnTheScreen();
    expect(screen.getByTestId('scan-candidate-2029-04-03')).toBeOnTheScreen();
  });

  it('returns whichever reading of an ambiguous date was chosen', async () => {
    const onConfirm = jest.fn();
    renderSheet({ onConfirm, result: await resultFor(WARRANTY_RECEIPT) });

    fireEvent.press(screen.getByTestId('scan-candidate-2029-04-03'));

    // The alternative, not the one the parser happened to list first.
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ ambiguous: true }),
      '2029-04-03',
    );
  });

  it('says so plainly when nothing was found, rather than showing an empty list', async () => {
    renderSheet({ result: await resultFor('Thank you for your purchase') });

    expect(screen.getByTestId('scan-nothing-found')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan-candidates')).not.toBeOnTheScreen();
  });

  it('always offers a way out to typing the date in', async () => {
    const onEnterManually = jest.fn();
    renderSheet({ onEnterManually, result: await resultFor('nothing here') });

    fireEvent.press(screen.getByTestId('scan-manual'));

    expect(onEnterManually).toHaveBeenCalled();
  });

  it('can go back to the camera without accepting anything', () => {
    const onRetake = jest.fn();
    const onConfirm = jest.fn();
    renderSheet({ onConfirm, onRetake });

    fireEvent.press(screen.getByTestId('scan-retake'));

    expect(onRetake).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
