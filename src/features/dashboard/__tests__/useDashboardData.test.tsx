import { act, renderHook, waitFor } from '@testing-library/react-native';

import { itemsRepository } from '@/db';
import { createMigratedTestDatabase } from '@/db/testing/betterSqlite3';
import type { Database } from '@/db/types';
import type { NewItem } from '@/db/models';
import { addDays, todayLocal } from '@/features/expiry';

import { useDashboardData } from '../useDashboardData';

/**
 * These run against a real migrated SQLite database, so the queries, the CHECK
 * constraints and the status-band boundaries are all genuinely exercised.
 *
 * `today` comes from `todayLocal()` inside the hook, so fixtures are expressed
 * as offsets from it rather than as fixed dates — otherwise the suite would
 * start failing on a future date.
 */

let db: Database;
const today = todayLocal();

function at(days: number): string {
  return addDays(today, days);
}

async function seed(items: readonly NewItem[]): Promise<void> {
  for (const item of items) {
    await itemsRepository.createItem(db, item);
  }
}

beforeEach(async () => {
  db = await createMigratedTestDatabase();
});

afterEach(async () => {
  await db.closeAsync();
});

function render(category: Parameters<typeof useDashboardData>[1]['category'] = null, search = '') {
  return renderHook(() => useDashboardData(db, { category, search }));
}

async function renderReady(
  category: Parameters<typeof useDashboardData>[1]['category'] = null,
  search = '',
) {
  const view = render(category, search);
  await waitFor(() => {
    expect(view.result.current.status).toBe('ready');
  });

  return view;
}

describe('an empty vault', () => {
  it('reports zeroes and no chips', async () => {
    const { result } = await renderReady();

    expect(result.current.data).toMatchObject({
      total: 0,
      counts: { safe: 0, soon: 0, expired: 0 },
      categoryFilters: [],
      nextRenewal: null,
      urgent: [],
      records: [],
    });
  });
});

describe('a populated vault', () => {
  beforeEach(async () => {
    await seed([
      { title: 'US Passport', category: 'passport', expiryDate: at(1200) },
      { title: 'EU Blue Card', category: 'visa', expiryDate: at(389), issuer: 'Berlin LEA' },
      { title: 'Residence Permit', category: 'visa', expiryDate: at(18) },
      { title: 'Health Cover', category: 'health', expiryDate: at(40), issuer: 'Allianz' },
      { title: 'Driving Permit', category: 'license', expiryDate: at(-25) },
    ]);
  });

  it('counts each status band globally', async () => {
    const { result } = await renderReady();

    expect(result.current.data?.counts).toEqual({ safe: 2, soon: 2, expired: 1 });
    expect(result.current.data?.total).toBe(5);
  });

  it('builds chips for the categories present, All first', async () => {
    const { result } = await renderReady();

    expect(result.current.data?.categoryFilters).toEqual([
      { category: null, label: 'All', count: 5 },
      { category: 'passport', label: 'Passports', count: 1 },
      { category: 'visa', label: 'Visas', count: 2 },
      { category: 'health', label: 'Health', count: 1 },
      { category: 'license', label: 'Licenses', count: 1 },
    ]);
  });

  it('picks the soonest not-yet-expired item as the next renewal', async () => {
    const { result } = await renderReady();

    expect(result.current.data?.nextRenewal?.title).toBe('Residence Permit');
  });

  it('orders urgent items expired-first then soonest', async () => {
    const { result } = await renderReady();

    expect(result.current.data?.urgent.map((item) => item.title)).toEqual([
      'Driving Permit',
      'Residence Permit',
      'Health Cover',
    ]);
  });

  it('lists every record by expiry, soonest first', async () => {
    const { result } = await renderReady();

    expect(result.current.data?.records.map((item) => item.title)).toEqual([
      'Driving Permit',
      'Residence Permit',
      'Health Cover',
      'EU Blue Card',
      'US Passport',
    ]);
  });

  it('narrows the records by category but leaves the counters global', async () => {
    const { result } = await renderReady('visa');

    expect(result.current.data?.records.map((item) => item.title)).toEqual([
      'Residence Permit',
      'EU Blue Card',
    ]);
    // The tiles still describe the whole vault.
    expect(result.current.data?.counts).toEqual({ safe: 2, soon: 2, expired: 1 });
    expect(result.current.data?.total).toBe(5);
  });

  it('searches title and issuer', async () => {
    const byTitle = await renderReady(null, 'passport');
    expect(byTitle.result.current.data?.records.map((item) => item.title)).toEqual(['US Passport']);

    const byIssuer = await renderReady(null, 'allianz');
    expect(byIssuer.result.current.data?.records.map((item) => item.title)).toEqual([
      'Health Cover',
    ]);
  });

  it('treats a whitespace-only search as no search', async () => {
    const { result } = await renderReady(null, '   ');

    expect(result.current.data?.records).toHaveLength(5);
  });

  it('returns no records when the filters match nothing', async () => {
    const { result } = await renderReady('warranty');

    expect(result.current.data?.records).toEqual([]);
    // Still a populated vault — this is the "no matches" case, not "empty".
    expect(result.current.data?.total).toBe(5);
  });

  it('picks up a new item on reload', async () => {
    const { result } = await renderReady();
    expect(result.current.data?.total).toBe(5);

    await itemsRepository.createItem(db, {
      title: 'Car Warranty',
      category: 'warranty',
      expiryDate: at(500),
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.data?.total).toBe(6);
    });
  });
});

describe('archived items', () => {
  beforeEach(async () => {
    await seed([
      { title: 'US Passport', category: 'passport', expiryDate: at(1200) },
      { title: 'Old Permit', category: 'visa', expiryDate: at(18) },
    ]);
  });

  it('disappear from every counter and from the list', async () => {
    const before = await renderReady();
    expect(before.result.current.data?.total).toBe(2);

    const [permit] = await itemsRepository.listItems(db, { category: 'visa' });
    await itemsRepository.archiveItem(db, permit.id);

    const after = await renderReady();

    expect(after.result.current.data?.total).toBe(1);
    expect(after.result.current.data?.counts).toEqual({ safe: 1, soon: 0, expired: 0 });
    expect(after.result.current.data?.records.map((item) => item.title)).toEqual(['US Passport']);
    expect(after.result.current.data?.categoryFilters.map((filter) => filter.category)).toEqual([
      null,
      'passport',
    ]);
  });

  it('are not offered as the next renewal', async () => {
    const [permit] = await itemsRepository.listItems(db, { category: 'visa' });
    await itemsRepository.archiveItem(db, permit.id);

    const { result } = await renderReady();

    // The permit expires sooner, so it would otherwise win.
    expect(result.current.data?.nextRenewal?.title).toBe('US Passport');
  });

  it('are not shown as urgent', async () => {
    const [permit] = await itemsRepository.listItems(db, { category: 'visa' });
    await itemsRepository.archiveItem(db, permit.id);

    const { result } = await renderReady();

    expect(result.current.data?.urgent).toEqual([]);
  });
});

describe('failures', () => {
  it('reports an error when the query fails', async () => {
    await db.closeAsync();

    const { result } = render();

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error).toBeInstanceOf(Error);

    // Reopened so the shared afterEach close does not throw.
    db = await createMigratedTestDatabase();
  });
});

describe('before the database is open', () => {
  it('stays loading rather than rendering an empty vault', async () => {
    const { result } = renderHook(() => useDashboardData(null, { category: null, search: '' }));

    await waitFor(() => {
      expect(result.current.status).toBe('loading');
    });
    expect(result.current.data).toBeNull();
  });
});
