import { dashOffsetFor, RING_CIRCUMFERENCE, RING_RADIUS } from '../CountdownRing';

/**
 * The arc maths, tested without rendering — react-native-svg draws a native
 * view, so what can be verified here is the geometry that decides how much of
 * the ring is painted.
 */

describe('ring geometry', () => {
  it('uses the radius the export draws', () => {
    expect(RING_RADIUS).toBe(66);
  });

  it('derives the circumference the export hardcodes as 414.69', () => {
    expect(RING_CIRCUMFERENCE).toBeCloseTo(414.69, 2);
  });
});

describe('dashOffsetFor', () => {
  it('leaves nothing unpainted at full', () => {
    expect(dashOffsetFor(1)).toBe(0);
  });

  it('leaves the whole circle unpainted at empty', () => {
    expect(dashOffsetFor(0)).toBeCloseTo(RING_CIRCUMFERENCE, 10);
  });

  it('halves the circle at one half', () => {
    expect(dashOffsetFor(0.5)).toBeCloseTo(RING_CIRCUMFERENCE / 2, 10);
  });

  it("reproduces the export's 4.8% arc", () => {
    // The mockup ships stroke-dashoffset="394.78" against dasharray 414.69.
    expect(dashOffsetFor(0.048)).toBeCloseTo(394.78, 1);
  });

  it.each([
    ['above one', 1.5, 0],
    ['well above one', 99, 0],
  ])('clamps a fraction %s', (_label, fraction, expected) => {
    expect(dashOffsetFor(fraction)).toBe(expected);
  });

  it.each([
    ['below zero', -0.5],
    ['well below zero', -99],
  ])('clamps a fraction %s to an empty ring', (_label, fraction) => {
    expect(dashOffsetFor(fraction)).toBeCloseTo(RING_CIRCUMFERENCE, 10);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('treats %s as empty rather than drawing a broken arc', (_label, fraction) => {
    expect(dashOffsetFor(fraction)).toBe(RING_CIRCUMFERENCE);
  });

  it('decreases monotonically as the fraction grows', () => {
    const offsets = [0, 0.25, 0.5, 0.75, 1].map((fraction) => dashOffsetFor(fraction));

    for (let index = 1; index < offsets.length; index += 1) {
      expect(offsets[index]).toBeLessThan(offsets[index - 1]);
    }
  });

  it('accepts a custom circumference', () => {
    expect(dashOffsetFor(0.5, 100)).toBe(50);
  });
});
