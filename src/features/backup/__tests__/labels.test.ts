import { testT } from '@/i18n/testing';
import { backupErrorReasons, MIN_PASSWORD_LENGTH, type BackupErrorReason } from '@/services/backup';

import { backupErrorKey, exportSummary, formatBytes, passwordProblemKey } from '../labels';

/**
 * `testT` returns a real i18next `t` bound to a locale, not a stub that echoes
 * its key — a stub would let a missing key or a dropped interpolation pass,
 * which is exactly what these functions exist to get right.
 */
const t = testT('en');
const bn = testT('bn');

describe('backupErrorKey', () => {
  it('has a distinct message for every reason', () => {
    const messages = backupErrorReasons.map((reason) => t(backupErrorKey(reason)));

    expect(new Set(messages).size).toBe(backupErrorReasons.length);
  });

  /**
   * i18next returns the key itself when a lookup misses, so "did it resolve?"
   * is `result !== key` — not a substring check, since the English copy
   * legitimately ends with the word "backup".
   */
  it('resolves every reason to real copy in both locales', () => {
    for (const reason of backupErrorReasons) {
      const key = backupErrorKey(reason);

      expect(t(key)).not.toBe(key);
      expect(bn(key)).not.toBe(key);
    }
  });

  /**
   * The two that matter most. A wrong passphrase is fixable by the person
   * holding it; a damaged file is not, and telling them to check their
   * passphrase sends them round a loop with no exit.
   */
  it('tells a wrong passphrase apart from a damaged file', () => {
    expect(t(backupErrorKey('wrong-password'))).toMatch(/passphrase/i);
    expect(t(backupErrorKey('corrupt'))).toMatch(/damaged/i);
  });

  it('promises the vault is untouched wherever that is true', () => {
    const untouched: BackupErrorReason[] = ['corrupt', 'invalid-payload', 'io'];

    for (const reason of untouched) {
      expect(t(backupErrorKey(reason))).toMatch(/has not been changed/i);
    }
  });
});

describe('passwordProblemKey', () => {
  it.each(['too-short', 'too-long', 'single-character', 'mismatch'] as const)(
    'resolves %s to real copy in both locales',
    (problem) => {
      const key = passwordProblemKey(problem);

      expect(t(key, { length: MIN_PASSWORD_LENGTH })).not.toBe(key);
      expect(bn(key, { length: MIN_PASSWORD_LENGTH })).not.toBe(key);
    },
  );

  /**
   * An unfilled placeholder renders as a literal `{{length}}` at runtime and
   * reads fine in review — the failure mode the missing-key test was built for.
   * This is the call-site half of it: the parameter these messages are given is
   * the one they interpolate.
   */
  it.each(['en', 'bn'] as const)('fills the length placeholder in %s', (locale) => {
    const translate = testT(locale);
    const rendered = translate(passwordProblemKey('too-short'), {
      length: MIN_PASSWORD_LENGTH,
    });

    expect(rendered).toContain(String(MIN_PASSWORD_LENGTH));
    expect(rendered).not.toMatch(/\{\{|\}\}/);
  });
});

describe('formatBytes', () => {
  it('reports bytes below a kilobyte', () => {
    expect(formatBytes(512, 'en', t)).toBe('512 B');
  });

  it('reports whole kilobytes', () => {
    expect(formatBytes(4096, 'en', t)).toBe('4 KB');
  });

  it('keeps one decimal above a megabyte, so 4.2 and 4.8 stay apart', () => {
    expect(formatBytes(4.2 * 1024 * 1024, 'en', t)).toBe('4.2 MB');
    expect(formatBytes(4.8 * 1024 * 1024, 'en', t)).toBe('4.8 MB');
  });

  it('switches unit exactly at the boundary', () => {
    expect(formatBytes(1023, 'en', t)).toBe('1,023 B');
    expect(formatBytes(1024, 'en', t)).toBe('1 KB');
  });

  it('handles an empty vault', () => {
    expect(formatBytes(0, 'en', t)).toBe('0 B');
  });

  /** Bengali's default numbering system is `beng`; every formatter is pinned. */
  it('renders Latin digits in Bengali', () => {
    expect(formatBytes(4096, 'bn', bn)).toMatch(/4/);
    expect(formatBytes(4096, 'bn', bn)).not.toMatch(/[০-৯]/);
  });
});

describe('exportSummary', () => {
  it('names what was written', () => {
    expect(exportSummary({ itemCount: 12, attachmentCount: 3, missingAttachments: 0 }, t)).toBe(
      '12 documents · 3 attachments',
    );
  });

  it('uses the singular where there is one of something', () => {
    expect(exportSummary({ itemCount: 1, attachmentCount: 1, missingAttachments: 0 }, t)).toBe(
      '1 document · 1 attachment',
    );
  });

  /**
   * A line reading "0 skipped" looks like a warning when it is the opposite,
   * so the clause is omitted rather than rendered as a zero.
   */
  it('says nothing about skipped files when none were skipped', () => {
    expect(exportSummary({ itemCount: 5, attachmentCount: 2, missingAttachments: 0 }, t)).not.toMatch(
      /skipped/,
    );
  });

  it('mentions skipped files when there are some', () => {
    expect(exportSummary({ itemCount: 5, attachmentCount: 2, missingAttachments: 1 }, t)).toMatch(
      /1 attachment skipped/,
    );
  });

  it('reads as real copy in Bengali too', () => {
    const summary = exportSummary({ itemCount: 2, attachmentCount: 1, missingAttachments: 0 }, bn);

    expect(summary).not.toContain('backup.summary');
    expect(summary).toContain('·');
  });
});
