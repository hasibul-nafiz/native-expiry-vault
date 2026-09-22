import { documentCategories } from '@/db/models';

import { checklistFor } from '../checklistTemplates';

describe('checklist templates', () => {
  it.each(documentCategories)('gives %s a non-empty checklist', (category) => {
    expect(checklistFor(category).length).toBeGreaterThan(0);
  });

  it.each(documentCategories)('gives every %s step a title and a detail', (category) => {
    for (const step of checklistFor(category)) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.detail.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(documentCategories)('keeps %s step titles unique', (category) => {
    // Titles are the key used to match a step to its stored row, so a duplicate
    // would make two steps share one tick.
    const titles = checklistFor(category).map((step) => step.title);

    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(documentCategories)('orders %s steps from earliest to latest', (category) => {
    const offsets = checklistFor(category)
      .map((step) => step.dueOffsetDays)
      .filter((offset): offset is number => offset !== null);

    expect(offsets).toEqual([...offsets].sort((a, b) => b - a));
  });

  it.each(documentCategories)('uses non-negative whole-day offsets for %s', (category) => {
    for (const step of checklistFor(category)) {
      if (step.dueOffsetDays !== null) {
        expect(Number.isInteger(step.dueOffsetDays)).toBe(true);
        expect(step.dueOffsetDays).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('transcribes the four steps the export draws for a residence permit', () => {
    expect(checklistFor('visa')).toHaveLength(4);
  });

  it('leads a passport with the six-month rule the reminder preset also uses', () => {
    expect(checklistFor('passport')[0].dueOffsetDays).toBe(180);
  });

  it('leads a contract with its notice period', () => {
    expect(checklistFor('contract')[0].title).toMatch(/notice period/i);
  });
});
