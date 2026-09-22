import { applicableOffsets, DEFAULT_REMINDER_OFFSETS, fireDateFor } from '../reminders';

describe('fireDateFor', () => {
  it.each([
    [180, '2030-11-15'],
    [90, '2031-02-13'],
    [30, '2031-04-14'],
    [7, '2031-05-07'],
    [0, '2031-05-14'],
  ])('places a %i-day reminder on %s', (offset, expected) => {
    expect(fireDateFor('2031-05-14', offset)).toBe(expected);
  });

  it('crosses a leap day correctly', () => {
    expect(fireDateFor('2024-03-01', 1)).toBe('2024-02-29');
  });

  it.each([-1, 1.5, Number.NaN])('rejects the invalid offset %p', (offset) => {
    expect(() => fireDateFor('2031-05-14', offset)).toThrow(RangeError);
  });
});

describe('applicableOffsets', () => {
  it('keeps every offset for a distant expiry', () => {
    expect(applicableOffsets('2031-05-14', '2026-09-20')).toEqual([180, 90, 30, 7]);
  });

  it('drops offsets whose fire date has already passed', () => {
    // 40 days out: the 180- and 90-day reminders would fire in the past.
    expect(applicableOffsets('2026-10-30', '2026-09-20')).toEqual([30, 7]);
  });

  it('keeps an offset firing exactly today', () => {
    expect(applicableOffsets('2026-10-20', '2026-09-20', [30])).toEqual([30]);
  });

  it('returns nothing for an already expired item', () => {
    expect(applicableOffsets('2026-09-01', '2026-09-20')).toEqual([]);
  });

  it('returns the offsets furthest out first', () => {
    expect(applicableOffsets('2031-05-14', '2026-09-20', [7, 180, 30])).toEqual([180, 30, 7]);
  });

  it('presets the offsets the add-item flow shows', () => {
    expect(DEFAULT_REMINDER_OFFSETS).toEqual([180, 90, 30, 7]);
  });
});
