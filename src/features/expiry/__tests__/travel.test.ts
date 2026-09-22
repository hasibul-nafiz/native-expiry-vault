import {
  daysUsedInWindow,
  SCHENGEN_ALLOWANCE_DAYS,
  SCHENGEN_WINDOW_DAYS,
  schengenUsage,
  type StayPeriod,
} from '../travel';

const TODAY = '2026-09-20';

describe('daysUsedInWindow', () => {
  it('counts nothing without stays', () => {
    expect(daysUsedInWindow([], TODAY)).toBe(0);
  });

  it('counts both the entry and the exit day', () => {
    expect(daysUsedInWindow([{ entryDate: '2026-09-01', exitDate: '2026-09-01' }], TODAY)).toBe(1);
    expect(daysUsedInWindow([{ entryDate: '2026-09-01', exitDate: '2026-09-10' }], TODAY)).toBe(10);
  });

  it('counts an open stay up to and including today', () => {
    expect(daysUsedInWindow([{ entryDate: '2026-09-18', exitDate: null }], TODAY)).toBe(3);
  });

  it('does not double-count overlapping stays', () => {
    const stays: StayPeriod[] = [
      { entryDate: '2026-09-01', exitDate: '2026-09-10' },
      { entryDate: '2026-09-05', exitDate: '2026-09-15' },
    ];

    // 1st to 15th inclusive, not 10 + 11.
    expect(daysUsedInWindow(stays, TODAY)).toBe(15);
  });

  it('ignores identical duplicate stays', () => {
    const stay: StayPeriod = {
      entryDate: '2026-09-01',
      exitDate: '2026-09-10',
    };

    expect(daysUsedInWindow([stay, stay], TODAY)).toBe(10);
  });

  it('clamps a stay that began before the window', () => {
    // The window is the 180 days ending today, so it starts on 2026-03-25.
    expect(daysUsedInWindow([{ entryDate: '2025-01-01', exitDate: '2026-03-26' }], TODAY)).toBe(2);
  });

  it('excludes a stay entirely outside the window', () => {
    expect(daysUsedInWindow([{ entryDate: '2024-01-01', exitDate: '2024-02-01' }], TODAY)).toBe(0);
  });

  it('ignores a stay that has not started yet', () => {
    expect(daysUsedInWindow([{ entryDate: '2026-12-01', exitDate: '2026-12-10' }], TODAY)).toBe(0);
  });

  it('clamps a stay that runs past today', () => {
    expect(daysUsedInWindow([{ entryDate: '2026-09-19', exitDate: '2026-10-30' }], TODAY)).toBe(2);
  });

  it('caps at the window length when presence is continuous', () => {
    expect(daysUsedInWindow([{ entryDate: '2020-01-01', exitDate: null }], TODAY)).toBe(
      SCHENGEN_WINDOW_DAYS,
    );
  });

  it.each([0, -1, 1.5])('rejects the invalid window %p', (windowDays) => {
    expect(() => daysUsedInWindow([], TODAY, windowDays)).toThrow(RangeError);
  });
});

describe('schengenUsage', () => {
  it('reports the window it measured', () => {
    expect(schengenUsage([], TODAY)).toEqual({
      used: 0,
      remaining: SCHENGEN_ALLOWANCE_DAYS,
      allowance: SCHENGEN_ALLOWANCE_DAYS,
      windowStart: '2026-03-25',
      windowEnd: TODAY,
    });
  });

  it('reproduces the figures the vault-health screen shows', () => {
    // "42 of 90 days used • 48 days safe"
    const stays: StayPeriod[] = [{ entryDate: '2026-08-10', exitDate: '2026-09-20' }];
    const usage = schengenUsage(stays, TODAY);

    expect(usage.used).toBe(42);
    expect(usage.remaining).toBe(48);
  });

  it('floors the remaining allowance at zero when overstayed', () => {
    const usage = schengenUsage([{ entryDate: '2026-01-01', exitDate: null }], TODAY);

    expect(usage.used).toBe(SCHENGEN_WINDOW_DAYS);
    expect(usage.remaining).toBe(0);
  });
});
