import type { IsoDate } from '@/db/models';
import { todayLocal } from '@/features/expiry';
import type { OcrPort } from '@/services/ocr';

import { type DateCandidate, parseDates } from './parseDates';
import { type MrzResult, parseMrz } from './parseMrz';

/**
 * One pass over one image: recognise, parse, rank.
 *
 * Thin by design — everything that decides anything lives in `parseDates` and
 * `parseMrz`, which are pure. This layer only sequences them and folds the MRZ
 * expiry date into the same ranked list as the printed ones, so the confirm
 * screen has a single thing to render.
 */

/** How many candidates the confirm screen offers before "type it instead". */
export const MAX_CANDIDATES = 4;

/** The score an MRZ expiry earns when its check digit passes. */
const MRZ_VERIFIED_SCORE = 0.98;
/** And when it does not: still the best reading, no longer trustworthy. */
const MRZ_UNVERIFIED_SCORE = 0.5;

export interface ScanResult {
  /**
   * Everything recognised, stored on the item as `ocr_raw_text` so a future
   * version can re-parse without asking for the document again.
   *
   * It contains the MRZ, and the MRZ contains the document number and date of
   * birth. Treated like `documentNumber`: encrypted at rest by SQLCipher,
   * masked at render, never logged.
   */
  rawText: string;
  /** Best first, capped at `MAX_CANDIDATES`. Empty when nothing was found. */
  candidates: DateCandidate[];
  mrz: MrzResult | null;
  /**
   * The best candidate's score, written to `items.ocr_confidence`.
   *
   * This is **our ranking**, not an OCR confidence: ML Kit returns no
   * numeric confidence of any kind. Nothing in the UI may present it as one.
   */
  confidence: number | null;
}

/** Merges the MRZ expiry into the printed candidates, outranking them. */
function withMrzCandidate(
  candidates: readonly DateCandidate[],
  mrz: MrzResult | null,
): DateCandidate[] {
  if (mrz === null || mrz.expiryDate === null) {
    return [...candidates];
  }

  const expiryDate = mrz.expiryDate;
  const mrzCandidate: DateCandidate = {
    date: expiryDate,
    score: mrz.verified.expiryDate ? MRZ_VERIFIED_SCORE : MRZ_UNVERIFIED_SCORE,
    source: mrz.lines[mrz.lines.length - 1],
    format: 'mrz',
    ambiguous: false,
  };

  // The printed expiry and the MRZ expiry are usually the same date. Keeping
  // both would offer the user the same answer twice, so the MRZ reading wins
  // and the printed one is dropped.
  const others = candidates.filter((candidate) => candidate.date !== expiryDate);

  return [mrzCandidate, ...others];
}

export async function scanImage(
  port: OcrPort,
  imageUri: string,
  today: IsoDate = todayLocal(),
): Promise<ScanResult> {
  const rawText = await port.recognize(imageUri);
  const mrz = parseMrz(rawText, today);
  const candidates = withMrzCandidate(parseDates(rawText, today), mrz).slice(0, MAX_CANDIDATES);

  return {
    rawText,
    candidates,
    mrz,
    confidence: candidates.length === 0 ? null : candidates[0].score,
  };
}
