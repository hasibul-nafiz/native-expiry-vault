import { documentCategories, type DocumentCategory } from '@/db/models';

/**
 * Per-category renewal checklists.
 *
 * Static data, as specified. The export hardcodes four steps for one German
 * residence permit with no template, no array and no data binding of any kind,
 * so only the `visa` list below is transcribed — the rest are written here and
 * logged as invented, the same way F5's per-category reminder offsets were.
 *
 * `dueOffsetDays` is relative to the document's expiry: 60 means "due 60 days
 * before it expires". Null means there is no natural deadline for that step.
 */

export interface ChecklistStep {
  title: string;
  detail: string;
  dueOffsetDays: number | null;
}

const templates: Record<DocumentCategory, readonly ChecklistStep[]> = {
  visa: [
    // Transcribed from the export, minus its Berlin-specific detail lines.
    {
      title: 'Download the official application form',
      detail: 'Usually available from the issuing authority’s portal.',
      dueOffsetDays: 90,
    },
    {
      title: 'Get up-to-date biometric photos',
      detail: 'ICAO-compliant, 35x45mm. Bring a printed set.',
      dueOffsetDays: 75,
    },
    {
      title: 'Gather supporting documents',
      detail: 'Employment confirmation, recent payslips, proof of address.',
      dueOffsetDays: 60,
    },
    {
      title: 'Book the in-person appointment',
      detail: 'Slots are often booked weeks ahead.',
      dueOffsetDays: 45,
    },
  ],
  passport: [
    {
      title: 'Check the six-month validity rule',
      detail: 'Many countries refuse entry on a passport expiring within six months.',
      dueOffsetDays: 180,
    },
    {
      title: 'Get new passport photos',
      detail: 'Check the issuing country’s size and background requirements.',
      dueOffsetDays: 120,
    },
    {
      title: 'Complete the renewal application',
      detail: 'Online where available, otherwise by post.',
      dueOffsetDays: 90,
    },
    {
      title: 'Send or submit the old passport',
      detail: 'Plan around any travel while it is away.',
      dueOffsetDays: 60,
    },
  ],
  health: [
    {
      title: 'Review what the policy covers',
      detail: 'Check limits, exclusions and any change in your circumstances.',
      dueOffsetDays: 60,
    },
    {
      title: 'Compare renewal quotes',
      detail: 'Automatic renewal is rarely the best price.',
      dueOffsetDays: 45,
    },
    {
      title: 'Confirm the new policy starts on time',
      detail: 'Avoid a gap in cover.',
      dueOffsetDays: 14,
    },
  ],
  license: [
    {
      title: 'Check whether a medical certificate is required',
      detail: 'Often required above a certain age or for some vehicle classes.',
      dueOffsetDays: 90,
    },
    {
      title: 'Renew the licence itself',
      detail: 'Online where available.',
      dueOffsetDays: 45,
    },
    {
      title: 'Renew the international permit if you need one',
      detail: 'An IDP is only valid alongside a current licence.',
      dueOffsetDays: 30,
    },
  ],
  warranty: [
    {
      title: 'Find the proof of purchase',
      detail: 'Most claims need the original receipt or order number.',
      dueOffsetDays: 30,
    },
    {
      title: 'Raise any outstanding faults before it lapses',
      detail: 'Cover ends on the expiry date, not when the fault appeared.',
      dueOffsetDays: 14,
    },
    {
      title: 'Decide whether to extend',
      detail: 'Compare against the cost of repair.',
      dueOffsetDays: 7,
    },
  ],
  contract: [
    {
      title: 'Check the notice period',
      detail: 'Missing it often renews the contract automatically.',
      dueOffsetDays: 90,
    },
    {
      title: 'Decide whether to renew, renegotiate or leave',
      detail: 'Gather comparable terms first.',
      dueOffsetDays: 60,
    },
    {
      title: 'Give notice or sign the renewal',
      detail: 'In writing, and keep a copy.',
      dueOffsetDays: 30,
    },
  ],
  other: [
    {
      title: 'Find out how this document is renewed',
      detail: 'Check the issuer’s website or the document itself.',
      dueOffsetDays: 60,
    },
    { title: 'Start the renewal', detail: 'Leave time for processing.', dueOffsetDays: 30 },
  ],
};

export function checklistFor(category: DocumentCategory): readonly ChecklistStep[] {
  return templates[category];
}

/** Every category has a template; asserted in the tests. */
export const templatedCategories: readonly DocumentCategory[] = documentCategories;
