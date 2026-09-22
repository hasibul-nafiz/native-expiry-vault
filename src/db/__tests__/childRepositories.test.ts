import {
  createAttachment,
  deleteAttachment,
  getAttachment,
  listAttachmentsForItem,
  sumAttachmentBytes,
} from '../repositories/attachments';
import { createItem } from '../repositories/items';
import {
  createItemNote,
  deleteItemNote,
  listItemNotes,
  updateItemNote,
} from '../repositories/itemNotes';
import {
  createReminderRule,
  createReminderRules,
  deleteReminderRule,
  listSchedulableRules,
  listReminderRulesForItem,
  markReminderDelivered,
  setReminderNotificationId,
  setReminderRuleEnabled,
} from '../repositories/reminderRules';
import {
  countRenewalTasks,
  createRenewalTask,
  deleteRenewalTask,
  listRenewalTasks,
  updateRenewalTask,
} from '../repositories/renewalTasks';
import {
  addTagToItem,
  createTag,
  deleteTag,
  listTags,
  listTagsForItem,
  removeTagFromItem,
} from '../repositories/tags';
import {
  closeTravelStay,
  createTravelStay,
  deleteTravelStay,
  listStayPeriods,
  listTravelStays,
} from '../repositories/travelStays';
import { createMigratedTestDatabase } from '../testing/betterSqlite3';
import type { Database } from '../types';

let db: Database;
let itemId: string;

beforeEach(async () => {
  db = await createMigratedTestDatabase();
  const item = await createItem(db, {
    title: 'Residence Permit',
    category: 'visa',
    expiryDate: '2026-10-28',
  });
  itemId = item.id;
});

afterEach(async () => {
  await db.closeAsync();
});

describe('attachments', () => {
  const file = {
    fileUri: 'file:///documents/front.raw',
    fileName: 'Front_eID.raw',
    mimeType: 'image/png',
    byteSize: 2_100_000,
  };

  it('round-trips an attachment', async () => {
    const created = await createAttachment(db, {
      itemId,
      ...file,
      role: 'front',
      sha256: 'ab12',
    });

    expect(created).toMatchObject({
      itemId,
      ...file,
      role: 'front',
      sortOrder: 0,
      sha256: 'ab12',
    });
    await expect(getAttachment(db, created.id)).resolves.toEqual(created);
  });

  it('defaults the role and sort order', async () => {
    const created = await createAttachment(db, { itemId, ...file });

    expect(created).toMatchObject({
      role: 'other',
      sortOrder: 0,
      sha256: null,
    });
  });

  it('lists by sort order', async () => {
    await createAttachment(db, {
      itemId,
      ...file,
      fileName: 'second',
      sortOrder: 1,
    });
    await createAttachment(db, {
      itemId,
      ...file,
      fileName: 'first',
      sortOrder: 0,
    });

    const names = (await listAttachmentsForItem(db, itemId)).map((a) => a.fileName);

    expect(names).toEqual(['first', 'second']);
  });

  it('sums stored bytes, and reports zero when there are none', async () => {
    await expect(sumAttachmentBytes(db, itemId)).resolves.toBe(0);

    await createAttachment(db, { itemId, ...file, byteSize: 100 });
    await createAttachment(db, { itemId, ...file, byteSize: 250 });

    await expect(sumAttachmentBytes(db, itemId)).resolves.toBe(350);
  });

  it('deletes and reports whether anything went', async () => {
    const created = await createAttachment(db, { itemId, ...file });

    await expect(deleteAttachment(db, created.id)).resolves.toBe(true);
    await expect(deleteAttachment(db, created.id)).resolves.toBe(false);
  });
});

describe('reminder rules', () => {
  it('derives the fire date from the expiry and offset', async () => {
    const rule = await createReminderRule(db, itemId, '2026-10-28', 30);

    expect(rule).toMatchObject({
      offsetDays: 30,
      fireDate: '2026-09-28',
      enabled: true,
      deliveredAt: null,
      notificationId: null,
    });
  });

  it('creates a batch in one transaction, furthest offset first', async () => {
    const rules = await createReminderRules(db, itemId, '2026-10-28', [7, 180, 30]);

    expect(rules.map((rule) => rule.offsetDays)).toEqual([180, 30, 7]);
  });

  it('rolls the whole batch back if one offset is rejected', async () => {
    await expect(createReminderRules(db, itemId, '2026-10-28', [30, 30])).rejects.toThrow(
      /UNIQUE constraint/,
    );
    await expect(listReminderRulesForItem(db, itemId)).resolves.toEqual([]);
  });

  it('toggles, stamps delivery and stores the notification handle', async () => {
    const rule = await createReminderRule(db, itemId, '2026-10-28', 30);

    await expect(setReminderRuleEnabled(db, rule.id, false)).resolves.toBe(true);
    await expect(setReminderNotificationId(db, rule.id, 'notif-1')).resolves.toBe(true);
    await expect(markReminderDelivered(db, rule.id, '2026-09-28T09:00:00.000Z')).resolves.toBe(
      true,
    );

    const [updated] = await listReminderRulesForItem(db, itemId);
    expect(updated).toMatchObject({
      enabled: false,
      notificationId: 'notif-1',
      deliveredAt: '2026-09-28T09:00:00.000Z',
    });
  });

  describe('listSchedulableRules', () => {
    it('returns only enabled, undelivered rules', async () => {
      const rules = await createReminderRules(db, itemId, '2026-10-28', [180, 90, 30, 7]);
      const byOffset = new Map(rules.map((rule) => [rule.offsetDays, rule]));

      await markReminderDelivered(db, byOffset.get(180)!.id);
      await setReminderRuleEnabled(db, byOffset.get(90)!.id, false);

      const schedulable = await listSchedulableRules(db);

      expect(schedulable.map((rule) => rule.offsetDays)).toEqual([30, 7]);
    });

    /**
     * No date filter, deliberately. Past-dated rules have to reach the engine
     * so it can close them off; filtering them out here would leave them
     * undelivered and reconsidered on every launch forever.
     */
    it('includes rules whose fire date has already passed', async () => {
      await createReminderRules(db, itemId, '2026-10-28', [180, 7]);

      const schedulable = await listSchedulableRules(db);

      expect(schedulable.map((rule) => rule.fireDate)).toEqual(['2026-05-01', '2026-10-21']);
    });

    it('orders by fire date, soonest first', async () => {
      await createReminderRules(db, itemId, '2026-10-28', [7, 180, 90]);

      const schedulable = await listSchedulableRules(db);

      expect(schedulable.map((rule) => rule.offsetDays)).toEqual([180, 90, 7]);
    });
  });

  it('deletes a rule', async () => {
    const rule = await createReminderRule(db, itemId, '2026-10-28', 30);

    await expect(deleteReminderRule(db, rule.id)).resolves.toBe(true);
    await expect(listReminderRulesForItem(db, itemId)).resolves.toEqual([]);
  });
});

describe('item notes', () => {
  it('round-trips a titled note', async () => {
    const note = await createItemNote(db, itemId, 'Appointment Reference', 'Ref #ABH-99201');

    expect(note).toMatchObject({
      itemId,
      title: 'Appointment Reference',
      body: 'Ref #ABH-99201',
    });
    expect(note.createdAt).toBe(note.updatedAt);
  });

  it('updates only what it is given and bumps updated_at', async () => {
    const note = await createItemNote(db, itemId, 'Title', 'Body');
    const updated = await updateItemNote(db, note.id, { body: 'New body' });

    expect(updated).toMatchObject({ title: 'Title', body: 'New body' });
  });

  it('is a no-op with no changes', async () => {
    const note = await createItemNote(db, itemId, 'Title', 'Body');

    await expect(updateItemNote(db, note.id, {})).resolves.toEqual(note);
  });

  it('lists and deletes', async () => {
    const note = await createItemNote(db, itemId, 'Title', 'Body');

    await expect(listItemNotes(db, itemId)).resolves.toHaveLength(1);
    await expect(deleteItemNote(db, note.id)).resolves.toBe(true);
    await expect(listItemNotes(db, itemId)).resolves.toEqual([]);
  });
});

describe('renewal tasks', () => {
  it('round-trips a task with its defaults', async () => {
    const task = await createRenewalTask(db, {
      itemId,
      title: 'Book appointment',
    });

    expect(task).toMatchObject({
      title: 'Book appointment',
      detail: null,
      dueDate: null,
      done: false,
      sortOrder: 0,
    });
  });

  it('marks a task done', async () => {
    const task = await createRenewalTask(db, {
      itemId,
      title: 'Book appointment',
    });

    await expect(updateRenewalTask(db, task.id, { done: true })).resolves.toMatchObject({
      done: true,
    });
  });

  it('lists in sort order and counts progress', async () => {
    await createRenewalTask(db, { itemId, title: 'Second', sortOrder: 1 });
    await createRenewalTask(db, {
      itemId,
      title: 'First',
      sortOrder: 0,
      done: true,
    });

    await expect(listRenewalTasks(db, itemId)).resolves.toMatchObject([
      { title: 'First' },
      { title: 'Second' },
    ]);
    await expect(countRenewalTasks(db, itemId)).resolves.toEqual({
      done: 1,
      total: 2,
    });
  });

  it('counts zero of zero for an item with no tasks', async () => {
    await expect(countRenewalTasks(db, itemId)).resolves.toEqual({
      done: 0,
      total: 0,
    });
  });

  it('deletes a task', async () => {
    const task = await createRenewalTask(db, {
      itemId,
      title: 'Book appointment',
    });

    await expect(deleteRenewalTask(db, task.id)).resolves.toBe(true);
  });
});

describe('tags', () => {
  it('creates, lists alphabetically and deletes', async () => {
    await createTag(db, 'Work');
    const travel = await createTag(db, 'Travel', 'violet');

    await expect(listTags(db)).resolves.toMatchObject([
      { label: 'Travel', color: 'violet' },
      { label: 'Work', color: null },
    ]);

    await expect(deleteTag(db, travel.id)).resolves.toBe(true);
    await expect(listTags(db)).resolves.toHaveLength(1);
  });

  it('associates a tag with an item without duplicating it', async () => {
    const tag = await createTag(db, 'Travel');

    await addTagToItem(db, itemId, tag.id);
    await addTagToItem(db, itemId, tag.id);

    await expect(listTagsForItem(db, itemId)).resolves.toMatchObject([{ label: 'Travel' }]);
  });

  it('removes an association without deleting the tag', async () => {
    const tag = await createTag(db, 'Travel');
    await addTagToItem(db, itemId, tag.id);

    await expect(removeTagFromItem(db, itemId, tag.id)).resolves.toBe(true);
    await expect(listTagsForItem(db, itemId)).resolves.toEqual([]);
    await expect(listTags(db)).resolves.toHaveLength(1);
  });

  it('drops associations when the tag is deleted', async () => {
    const tag = await createTag(db, 'Travel');
    await addTagToItem(db, itemId, tag.id);

    await deleteTag(db, tag.id);

    await expect(listTagsForItem(db, itemId)).resolves.toEqual([]);
  });
});

describe('travel stays', () => {
  it('defaults the area to schengen and allows an open stay', async () => {
    const stay = await createTravelStay(db, { entryDate: '2026-08-10' });

    expect(stay).toMatchObject({
      area: 'schengen',
      entryDate: '2026-08-10',
      exitDate: null,
    });
  });

  it('closes an open stay', async () => {
    const stay = await createTravelStay(db, { entryDate: '2026-08-10' });

    await expect(closeTravelStay(db, stay.id, '2026-09-20')).resolves.toMatchObject({
      exitDate: '2026-09-20',
    });
  });

  it('lists by entry date and filters by area', async () => {
    await createTravelStay(db, { entryDate: '2026-08-10' });
    await createTravelStay(db, { entryDate: '2026-01-05' });
    await createTravelStay(db, { entryDate: '2026-03-01', area: 'uk' });

    await expect(listTravelStays(db)).resolves.toHaveLength(3);
    await expect(listTravelStays(db, 'uk')).resolves.toMatchObject([{ entryDate: '2026-03-01' }]);
  });

  it('exposes the shape the 90/180 calculation expects', async () => {
    await createTravelStay(db, {
      entryDate: '2026-08-10',
      exitDate: '2026-08-20',
    });
    await createTravelStay(db, { entryDate: '2026-09-01' });

    await expect(listStayPeriods(db)).resolves.toEqual([
      { entryDate: '2026-08-10', exitDate: '2026-08-20' },
      { entryDate: '2026-09-01', exitDate: null },
    ]);
  });

  it('deletes a stay', async () => {
    const stay = await createTravelStay(db, { entryDate: '2026-08-10' });

    await expect(deleteTravelStay(db, stay.id)).resolves.toBe(true);
    await expect(listTravelStays(db)).resolves.toEqual([]);
  });
});
