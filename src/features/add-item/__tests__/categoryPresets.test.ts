import { documentCategories } from '@/db/models';

import { categoryPresets, defaultOffsetsFor, presetFor } from '../categoryPresets';

describe('category presets', () => {
  it('covers every category the schema allows', () => {
    const covered = categoryPresets.map((preset) => preset.category);

    expect([...covered].sort()).toEqual([...documentCategories].sort());
  });

  it('defines no category twice', () => {
    const covered = categoryPresets.map((preset) => preset.category);

    expect(new Set(covered).size).toBe(covered.length);
  });

  it.each(documentCategories)('gives %s a usable preset', (category) => {
    const preset = presetFor(category);

    expect(preset.title.length).toBeGreaterThan(0);
    expect(preset.subtitle.length).toBeGreaterThan(0);
    expect(preset.offsets.length).toBeGreaterThan(0);
  });

  it.each(documentCategories)('gives %s offsets the schema will accept', (category) => {
    for (const offset of defaultOffsetsFor(category)) {
      expect(Number.isInteger(offset)).toBe(true);
      expect(offset).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(documentCategories)('orders %s offsets furthest-out first', (category) => {
    const offsets = [...defaultOffsetsFor(category)];

    expect(offsets).toEqual([...offsets].sort((a, b) => b - a));
  });

  it.each(documentCategories)('has no duplicate offsets for %s', (category) => {
    // Duplicates would violate the UNIQUE (item_id, offset_days) constraint.
    const offsets = defaultOffsetsFor(category);

    expect(new Set(offsets).size).toBe(offsets.length);
  });

  it('keeps the export’s titles and subtitles verbatim', () => {
    expect(presetFor('passport')).toMatchObject({
      title: 'Passport / ID',
      subtitle: '6-mo airline rule',
    });
    expect(presetFor('visa')).toMatchObject({
      title: 'Visa & Permit',
      subtitle: 'Schengen / Status',
    });
    expect(presetFor('license')).toMatchObject({ title: "Driver's License" });
  });

  it('gives a passport the six-month lead the airline rule implies', () => {
    expect(defaultOffsetsFor('passport')).toContain(180);
  });

  it('throws rather than silently defaulting for an unknown category', () => {
    // @ts-expect-error deliberately outside the union
    expect(() => presetFor('spaceship')).toThrow(/No preset defined/);
  });
});
