import {
  buildPinRecord,
  derivePinHash,
  parsePinRecord,
  PBKDF2_ITERATIONS,
  serializePinRecord,
  validatePin,
  verifyPin,
} from '../pin';

const SALT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const OTHER_SALT = '0f9e8d7c6b5a49382716f5e4d3c2b1a0';

describe('validatePin', () => {
  it('accepts a six-digit PIN with no obvious structure', () => {
    expect(validatePin('284091')).toEqual({ ok: true });
  });

  it.each(['12345', '1234567', ''])('rejects the wrong length: %s', (pin) => {
    expect(validatePin(pin)).toEqual({ ok: false, problem: 'length' });
  });

  it.each(['12345a', 'abcdef', '12 456'])('rejects a non-digit: %s', (pin) => {
    expect(validatePin(pin)).toEqual({ ok: false, problem: 'digits' });
  });

  it.each([
    ['every digit the same', '111111'],
    ['all zeroes', '000000'],
    ['an ascending run', '345678'],
    ['a descending run', '876543'],
    ['a denylisted pattern', '121212'],
  ])('rejects %s', (_label, pin) => {
    expect(validatePin(pin)).toEqual({ ok: false, problem: 'weak' });
  });

  it('accepts a PIN that merely contains a run', () => {
    expect(validatePin('123590')).toEqual({ ok: true });
  });
});

describe('derivePinHash', () => {
  it('is deterministic for the same PIN, salt and count', () => {
    expect(derivePinHash('284091', SALT, 1000)).toBe(derivePinHash('284091', SALT, 1000));
  });

  it('separates two users with the same PIN by salt alone', () => {
    expect(derivePinHash('284091', SALT, 1000)).not.toBe(derivePinHash('284091', OTHER_SALT, 1000));
  });

  it('changes with the iteration count', () => {
    expect(derivePinHash('284091', SALT, 1000)).not.toBe(derivePinHash('284091', SALT, 2000));
  });

  it('produces a 256-bit hash as hex', () => {
    expect(derivePinHash('284091', SALT, 1)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyPin', () => {
  const record = buildPinRecord('284091', SALT);

  it('accepts the enrolled PIN', () => {
    expect(verifyPin('284091', record)).toBe(true);
  });

  it('rejects a different PIN', () => {
    expect(verifyPin('284092', record)).toBe(false);
  });

  it('rejects a PIN that is a prefix of the right one', () => {
    expect(verifyPin('28409', record)).toBe(false);
  });

  it('stores the salt and the iteration count it used', () => {
    expect(record).toMatchObject({ salt: SALT, iterations: PBKDF2_ITERATIONS, version: 1 });
  });

  it('verifies against the count in the record, not the current constant', () => {
    // An enrolment made before PBKDF2_ITERATIONS was raised must keep working.
    const legacy = { version: 1, iterations: 1000, salt: SALT, hash: derivePinHash('284091', SALT, 1000) };

    expect(verifyPin('284091', legacy)).toBe(true);
    expect(verifyPin('999999', legacy)).toBe(false);
  });
});

describe('parsePinRecord', () => {
  const record = buildPinRecord('284091', SALT);

  it('round-trips a record', () => {
    expect(parsePinRecord(serializePinRecord(record))).toEqual(record);
  });

  it.each([
    ['malformed JSON', '{'],
    ['a JSON primitive', '"nope"'],
    ['null', 'null'],
    ['an unknown version', JSON.stringify({ ...record, version: 99 })],
    ['a missing salt', JSON.stringify({ ...record, salt: '' })],
    ['a truncated hash', JSON.stringify({ ...record, hash: 'abcd' })],
    ['a zero iteration count', JSON.stringify({ ...record, iterations: 0 })],
    ['a fractional iteration count', JSON.stringify({ ...record, iterations: 1.5 })],
  ])('returns null for %s', (_label, raw) => {
    expect(parsePinRecord(raw)).toBeNull();
  });
});
