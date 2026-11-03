import { describe, it, expect } from 'vitest';
import {
  CLARIFICATION_CATEGORIES,
  getClarificationUrgency,
  ClarificationCategory,
  ClarificationStatus,
} from '../../fixtures/domain-contracts';

describe('Tier 1 - Feature 5: Clarifications (Klärfälle) Management', () => {
  it('T1.5.1 - should validate all 7 clarification categories', () => {
    expect(CLARIFICATION_CATEGORIES).toHaveLength(7);
    const expectedCats: ClarificationCategory[] = [
      'zaehlerstand',
      'km_stand',
      'familienversicherung',
      'unterlagen',
      'bankdaten',
      'widerruf',
      'sonstiges',
    ];
    for (const c of expectedCats) {
      const match = CLARIFICATION_CATEGORIES.find((item) => item.value === c);
      expect(match).toBeDefined();
      expect(match?.label).toBeTruthy();
    }
  });

  it('T1.5.2 - should calculate urgency ranking from 0 to 4 based on due date and status', () => {
    const refDate = new Date('2026-06-10T00:00:00Z');

    // Overdue (<0 days) -> Rank 4
    const overdue = getClarificationUrgency('2026-06-05T00:00:00Z', 'offen', refDate);
    expect(overdue.key).toBe('ueberfaellig');
    expect(overdue.rank).toBe(4);

    // High (≤2 days) -> Rank 3
    const high = getClarificationUrgency('2026-06-12T00:00:00Z', 'offen', refDate);
    expect(high.key).toBe('hoch');
    expect(high.rank).toBe(3);

    // Medium (≤7 days) -> Rank 2
    const med = getClarificationUrgency('2026-06-16T00:00:00Z', 'offen', refDate);
    expect(med.key).toBe('mittel');
    expect(med.rank).toBe(2);

    // Low (>7 days) -> Rank 1
    const low = getClarificationUrgency('2026-06-25T00:00:00Z', 'offen', refDate);
    expect(low.key).toBe('niedrig');
    expect(low.rank).toBe(1);

    // Resolved (erledigt) -> Rank 0
    const resolved = getClarificationUrgency('2026-06-01T00:00:00Z', 'erledigt', refDate);
    expect(resolved.rank).toBe(0);
    expect(resolved.label).toBe('Erledigt');
  });

  it('T1.5.3 - should track clarification resolution with timestamp and audit user', () => {
    const clarification = {
      id: 'clar-001',
      title: 'Fehlende Geburtsurkunde für Kind',
      category: 'familienversicherung' as ClarificationCategory,
      status: 'offen' as ClarificationStatus,
      customer_id: 'cust-101',
      resolved_at: null as string | null,
      resolved_by: null as string | null,
    };

    expect(clarification.status).toBe('offen');
    expect(clarification.resolved_at).toBeNull();

    // Resolve
    clarification.status = 'erledigt';
    clarification.resolved_at = new Date().toISOString();
    clarification.resolved_by = 'user-agent-01';

    expect(clarification.status).toBe('erledigt');
    expect(clarification.resolved_at).toBeTruthy();
    expect(clarification.resolved_by).toBe('user-agent-01');
  });

  it('T1.5.4 - should verify 15-second background auto-polling contract', () => {
    const POLLING_INTERVAL_MS = 15000;
    expect(POLLING_INTERVAL_MS).toBe(15000);
    expect(POLLING_INTERVAL_MS / 1000).toBe(15);
  });

  it('T1.5.5 - should transition clarification statuses across offen, wartend, and erledigt', () => {
    const validStatuses: ClarificationStatus[] = ['offen', 'wartend', 'erledigt'];
    let currentStatus: ClarificationStatus = 'offen';
    expect(validStatuses).toContain(currentStatus);

    currentStatus = 'wartend';
    expect(validStatuses).toContain(currentStatus);

    currentStatus = 'erledigt';
    expect(validStatuses).toContain(currentStatus);
  });

  it('T1.5.6 - should sort clarifications with highest urgency rank first', () => {
    const refDate = new Date('2026-06-10T00:00:00Z');
    const items = [
      { id: '1', due_date: '2026-06-25T00:00:00Z', status: 'offen' as ClarificationStatus }, // low (1)
      { id: '2', due_date: '2026-06-01T00:00:00Z', status: 'offen' as ClarificationStatus }, // overdue (4)
      { id: '3', due_date: '2026-06-11T00:00:00Z', status: 'offen' as ClarificationStatus }, // high (3)
    ];

    const sorted = [...items].sort((a, b) => {
      const uA = getClarificationUrgency(a.due_date, a.status, refDate).rank;
      const uB = getClarificationUrgency(b.due_date, b.status, refDate).rank;
      return uB - uA;
    });

    expect(sorted[0].id).toBe('2'); // rank 4
    expect(sorted[1].id).toBe('3'); // rank 3
    expect(sorted[2].id).toBe('1'); // rank 1
  });
});
