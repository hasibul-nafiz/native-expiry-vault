import type { OcrPort } from '@/services/ocr';

import { MAX_CANDIDATES, scanImage } from '../scanImage';

import { NO_DATE, UK_PASSPORT, UK_PASSPORT_MISREAD } from './fixtures/recognisedText';

/**
 * The pipeline against a fake port. The parsers are asserted elsewhere; what
 * matters here is how the MRZ and the printed text are combined, and that a
 * bad pass ends in a usable state rather than an exception nobody catches.
 */

const TODAY = '2026-09-20';

function portReturning(text: string): OcrPort {
  return { recognize: async () => text };
}

describe('scanImage', () => {
  it('puts a verified MRZ expiry at the top', async () => {
    const result = await scanImage(portReturning(UK_PASSPORT), 'file:///photo.jpg', TODAY);

    expect(result.candidates[0].date).toBe('2030-10-28');
    expect(result.candidates[0].format).toBe('mrz');
    expect(result.mrz?.verified.expiryDate).toBe(true);
  });

  it('does not offer the same date twice when the print and the MRZ agree', async () => {
    const result = await scanImage(portReturning(UK_PASSPORT), 'file:///photo.jpg', TODAY);
    const matching = result.candidates.filter((candidate) => candidate.date === '2030-10-28');

    expect(matching).toHaveLength(1);
  });

  it('falls back to the printed date when the MRZ expiry is unreadable', async () => {
    const result = await scanImage(portReturning(UK_PASSPORT_MISREAD), 'file:///p.jpg', TODAY);

    // The zone parsed, but its expiry group is not six digits.
    expect(result.mrz).not.toBeNull();
    expect(result.mrz?.expiryDate).toBeNull();
    expect(result.candidates).toEqual([]);
  });

  it('reports the top score as the confidence written to the item', async () => {
    const result = await scanImage(portReturning(UK_PASSPORT), 'file:///photo.jpg', TODAY);

    expect(result.confidence).toBe(result.candidates[0].score);
  });

  it('reports no confidence when nothing was found', async () => {
    const result = await scanImage(portReturning(NO_DATE), 'file:///photo.jpg', TODAY);

    expect(result.candidates).toEqual([]);
    expect(result.confidence).toBeNull();
    expect(result.mrz).toBeNull();
  });

  it('keeps the raw text for re-parsing', async () => {
    const result = await scanImage(portReturning(UK_PASSPORT), 'file:///photo.jpg', TODAY);

    expect(result.rawText).toBe(UK_PASSPORT);
  });

  it('caps how many candidates the confirm screen has to show', async () => {
    const crowded = [
      'Expires 01/12/2027',
      'Renewed 14/03/2028',
      'Reviewed 2029-06-05',
      'Checked 08 JUL 2030',
      'Filed 19/09/2031',
      'Noted 2032-02-02',
    ].join('\n');

    const result = await scanImage(portReturning(crowded), 'file:///photo.jpg', TODAY);

    expect(result.candidates).toHaveLength(MAX_CANDIDATES);
  });

  it('handles an empty recognition without throwing', async () => {
    const result = await scanImage(portReturning(''), 'file:///photo.jpg', TODAY);

    expect(result).toEqual({ rawText: '', candidates: [], mrz: null, confidence: null });
  });

  it('lets a recognition failure surface, rather than pretending it found nothing', async () => {
    const failing: OcrPort = {
      recognize: async () => {
        throw new Error('native module missing');
      },
    };

    // A build without the native module must not look like a blurry photo.
    await expect(scanImage(failing, 'file:///photo.jpg', TODAY)).rejects.toThrow(
      'native module missing',
    );
  });
});
