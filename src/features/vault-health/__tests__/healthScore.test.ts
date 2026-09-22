import {
  HEALTH_WEIGHTS,
  healthBand,
  MAX_SCORE,
  vaultHealth,
  type VaultHealthInput,
} from '../healthScore';

const HEALTHY: VaultHealthInput = {
  totalItems: 12,
  expiredCount: 0,
  soonCount: 0,
  itemsWithoutReminders: 0,
  notificationsGranted: true,
  hasReminderRules: true,
};

function input(overrides: Partial<VaultHealthInput> = {}): VaultHealthInput {
  return { ...HEALTHY, ...overrides };
}

describe('vaultHealth', () => {
  it('scores a vault with nothing wrong at 100', () => {
    const health = vaultHealth(HEALTHY);

    expect(health.score).toBe(MAX_SCORE);
    expect(health.band).toBe('good');
    expect(health.deductions).toEqual([]);
  });

  it('returns no score for an empty vault rather than a perfect one', () => {
    expect(vaultHealth(input({ totalItems: 0 }))).toEqual({
      score: null,
      band: null,
      deductions: [],
    });
  });

  it('ignores the other counts once the vault is empty', () => {
    // Defensive: a caller cannot produce this, but a null score must not depend
    // on the rest of the input being zeroed.
    const health = vaultHealth(input({ totalItems: 0, expiredCount: 3, itemsWithoutReminders: 2 }));

    expect(health.score).toBeNull();
    expect(health.deductions).toEqual([]);
  });

  describe('per-item deductions', () => {
    it.each([
      ['expired', 'expiredCount', 12],
      ['soon', 'soonCount', 4],
      ['missingReminders', 'itemsWithoutReminders', 6],
    ] as const)('charges %s at %s points each', (reason, field, points) => {
      const health = vaultHealth(input({ [field]: 3 }));

      expect(health.score).toBe(MAX_SCORE - points * 3);
      expect(health.deductions).toEqual([
        { reason, count: 3, pointsLost: points * 3, capped: false },
      ]);
    });
  });

  describe('caps', () => {
    it.each([
      ['expired', 'expiredCount', 48],
      ['soon', 'soonCount', 20],
      ['missingReminders', 'itemsWithoutReminders', 24],
    ] as const)('stops %s growing past its cap', (reason, field, cap) => {
      const health = vaultHealth(input({ totalItems: 60, [field]: 50 }));
      const deduction = health.deductions.find((entry) => entry.reason === reason);

      expect(deduction).toEqual({ reason, count: 50, pointsLost: cap, capped: true });
      expect(HEALTH_WEIGHTS[reason].cap).toBe(cap);
    });

    it('marks a deduction capped only once it exceeds the cap', () => {
      // Exactly four expired items costs 48, which is the cap but not over it.
      const exact = vaultHealth(input({ expiredCount: 4 })).deductions[0];
      const over = vaultHealth(input({ expiredCount: 5 })).deductions[0];

      expect(exact).toMatchObject({ pointsLost: 48, capped: false });
      expect(over).toMatchObject({ pointsLost: 48, capped: true });
    });
  });

  describe('notification permission', () => {
    it('charges a flat penalty when permission is denied', () => {
      const health = vaultHealth(input({ notificationsGranted: false }));

      expect(health.score).toBe(MAX_SCORE - 15);
      expect(health.deductions).toEqual([
        { reason: 'notificationsDenied', count: 1, pointsLost: 15, capped: false },
      ]);
    });

    it('charges nothing when there are no rules to deliver', () => {
      const health = vaultHealth(input({ notificationsGranted: false, hasReminderRules: false }));

      expect(health.score).toBe(MAX_SCORE);
      expect(health.deductions).toEqual([]);
    });

    it('does not scale with vault size', () => {
      const small = vaultHealth(input({ totalItems: 1, notificationsGranted: false }));
      const large = vaultHealth(input({ totalItems: 99, notificationsGranted: false }));

      expect(small.score).toBe(large.score);
    });
  });

  it('accumulates every deduction', () => {
    const health = vaultHealth(
      input({
        totalItems: 10,
        expiredCount: 2,
        soonCount: 3,
        itemsWithoutReminders: 1,
        notificationsGranted: false,
      }),
    );

    // 24 expired + 12 soon + 6 missing + 15 denied = 57
    expect(health.score).toBe(MAX_SCORE - 57);
    expect(health.band).toBe('risk');
  });

  it('clamps at zero rather than going negative', () => {
    const health = vaultHealth(
      input({
        totalItems: 40,
        expiredCount: 40,
        soonCount: 40,
        itemsWithoutReminders: 40,
        notificationsGranted: false,
      }),
    );

    // The caps alone total 107, which is more than the score can lose.
    expect(health.score).toBe(0);
    expect(health.band).toBe('critical');
  });

  it('orders deductions heaviest first so the card leads with what matters', () => {
    const health = vaultHealth(input({ expiredCount: 1, soonCount: 1, itemsWithoutReminders: 1 }));

    expect(health.deductions.map((deduction) => deduction.reason)).toEqual([
      'expired',
      'missingReminders',
      'soon',
    ]);
  });

  it('reports deductions that account for exactly the points lost', () => {
    const health = vaultHealth(
      input({ totalItems: 20, expiredCount: 9, soonCount: 2, itemsWithoutReminders: 3 }),
    );
    const lost = health.deductions.reduce((total, entry) => total + entry.pointsLost, 0);

    expect(health.score).toBe(MAX_SCORE - lost);
  });
});

describe('healthBand', () => {
  it.each([
    [100, 'good'],
    [90, 'good'],
    [89, 'attention'],
    [70, 'attention'],
    [69, 'risk'],
    [40, 'risk'],
    [39, 'critical'],
    [0, 'critical'],
  ] as const)('puts %i in the %s band', (score, band) => {
    expect(healthBand(score)).toBe(band);
  });
});
