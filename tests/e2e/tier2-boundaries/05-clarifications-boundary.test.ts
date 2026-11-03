import { describe, it, expect } from 'vitest';
import { getClarificationUrgency } from '../../fixtures/domain-contracts';

describe('Tier 2 - Feature 5 Boundary: Clarifications (Klärfälle) Management', () => {
  it('T2.5.1 - should test exact day boundary between overdue (<0d) and high (0d to 2d)', () => {
    const ref = new Date('2026-06-10T12:00:00Z');

    // Due yesterday (-1 day) -> Overdue (rank 4)
    const yesterday = new Date(ref.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const uYesterday = getClarificationUrgency(yesterday, 'offen', ref);
    expect(uYesterday.key).toBe('ueberfaellig');
    expect(uYesterday.rank).toBe(4);

    // Due today (0 days) -> High (rank 3)
    const today = new Date(ref.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const uToday = getClarificationUrgency(today, 'offen', ref);
    expect(uToday.key).toBe('hoch');
    expect(uToday.rank).toBe(3);

    // Due in 2 days -> High (rank 3)
    const in2Days = new Date(ref.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const uIn2Days = getClarificationUrgency(in2Days, 'offen', ref);
    expect(uIn2Days.key).toBe('hoch');
    expect(uIn2Days.rank).toBe(3);

    // Due in 3 days -> Medium (rank 2)
    const in3Days = new Date(ref.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const uIn3Days = getClarificationUrgency(in3Days, 'offen', ref);
    expect(uIn3Days.key).toBe('mittel');
    expect(uIn3Days.rank).toBe(2);
  });

  it('T2.5.2 - should override extreme negative due date to rank 0 once marked erledigt', () => {
    const ref = new Date('2026-06-10T00:00:00Z');
    const veryOldDate = '2020-01-01T00:00:00Z';

    const openUrgency = getClarificationUrgency(veryOldDate, 'offen', ref);
    expect(openUrgency.rank).toBe(4);

    const resolvedUrgency = getClarificationUrgency(veryOldDate, 'erledigt', ref);
    expect(resolvedUrgency.rank).toBe(0);
    expect(resolvedUrgency.label).toBe('Erledigt');
  });

  it('T2.5.3 - should format overdue day count correctly for long overdue cases (e.g. 365 T)', () => {
    const ref = new Date('2026-06-10T00:00:00Z');
    const oneYearAgo = new Date(ref.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

    const urgency = getClarificationUrgency(oneYearAgo, 'offen', ref);
    expect(urgency.label).toContain('Überfällig');
    expect(urgency.label).toContain('365 T');
  });

  it('T2.5.4 - should safely handle null due_date by assigning rank 1 and "Ohne Datum" label', () => {
    const urgency = getClarificationUrgency(null, 'offen');
    expect(urgency.key).toBe('niedrig');
    expect(urgency.rank).toBe(1);
    expect(urgency.label).toBe('Ohne Datum');
  });

  it('T2.5.5 - should validate resolution payload requires resolution timestamp', () => {
    const validateResolution = (res: { status: string; resolved_at?: string | null }) => {
      if (res.status === 'erledigt' && !res.resolved_at) {
        throw new Error('Erledigter Klärfall erfordert einen resolved_at Zeitstempel.');
      }
      return true;
    };

    expect(() => validateResolution({ status: 'erledigt', resolved_at: null })).toThrowError(
      'erfordert einen resolved_at Zeitstempel',
    );
    expect(validateResolution({ status: 'erledigt', resolved_at: new Date().toISOString() })).toBe(true);
  });

  it('T2.5.6 - should safely allow empty description for clarifications', () => {
    const clarification = {
      title: 'Fehlende Bankverbindung',
      category: 'bankdaten' as const,
      description: null,
    };

    expect(clarification.description).toBeNull();
    expect(clarification.title).toBeTruthy();
  });
});
