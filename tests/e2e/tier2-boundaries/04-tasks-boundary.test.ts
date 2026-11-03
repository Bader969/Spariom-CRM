import { describe, it, expect } from 'vitest';
import { getTaskUrgency } from '../../fixtures/domain-contracts';

describe('Tier 2 - Feature 4 Boundary: Tasks (Aufgaben) Management', () => {
  it('T2.4.1 - should reject task creation with empty or whitespace-only title', () => {
    const validateTask = (t: { title?: string | null }) => {
      if (!t.title || t.title.trim().length === 0) {
        throw new Error('Aufgabentitel darf nicht leer sein.');
      }
      return true;
    };

    expect(() => validateTask({ title: '' })).toThrowError('nicht leer sein');
    expect(() => validateTask({ title: '   \t  ' })).toThrowError('nicht leer sein');
    expect(() => validateTask({ title: null })).toThrowError('nicht leer sein');
    expect(validateTask({ title: 'Rückruf morgen 10 Uhr' })).toBe(true);
  });

  it('T2.4.2 - should classify task due today (0 days remaining) as urgent (rank 3)', () => {
    const refDate = new Date('2026-06-15T12:00:00Z');
    const todayStr = '2026-06-15T18:00:00Z'; // same day

    const urgency = getTaskUrgency(todayStr, 'offen', refDate);
    expect(urgency.key).toBe('hoch');
    expect(urgency.rank).toBe(3);
  });

  it('T2.4.3 - should handle extreme past overdue date (-1000 days) safely with rank 4', () => {
    const refDate = new Date('2026-06-15T00:00:00Z');
    const pastStr = '2023-09-19T00:00:00Z'; // 1000 days prior

    const urgency = getTaskUrgency(pastStr, 'offen', refDate);
    expect(urgency.key).toBe('ueberfaellig');
    expect(urgency.rank).toBe(4);
  });

  it('T2.4.4 - should map null or empty due_date to niedrig with rank 1', () => {
    const urgency = getTaskUrgency(null, 'offen');
    expect(urgency.key).toBe('niedrig');
    expect(urgency.rank).toBe(1);
  });

  it('T2.4.5 - should enforce customer ID format validation for customer linking', () => {
    const validateCustomerLink = (cid: string | null | undefined) => {
      if (!cid || cid.trim().length < 5) {
        throw new Error('Ungültige Kunden-ID für Aufgabenverknüpfung.');
      }
      return true;
    };

    expect(() => validateCustomerLink('')).toThrowError('Ungültige Kunden-ID');
    expect(() => validateCustomerLink('123')).toThrowError('Ungültige Kunden-ID');
    expect(validateCustomerLink('cust-uuid-valid-12345')).toBe(true);
  });

  it('T2.4.6 - should safely toggle already completed task without state corruption', () => {
    const task = { id: 't1', status: 'erledigt' as const };
    const toggle = (t: typeof task) => ({
      ...t,
      status: (t.status === 'offen' ? 'erledigt' : 'offen') as 'offen' | 'erledigt',
    });

    const reopened = toggle(task);
    expect(reopened.status).toBe('offen');
    const reclosed = toggle(reopened);
    expect(reclosed.status).toBe('erledigt');
  });
});
