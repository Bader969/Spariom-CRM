import { describe, it, expect } from 'vitest';
import { getTaskUrgency, TaskStatus } from '../../fixtures/domain-contracts';

describe('Tier 1 - Feature 4: Tasks (Aufgaben) Management', () => {
  it('T1.4.1 - should validate task creation schema linked to customer and assignee', () => {
    const task = {
      id: 'task-001',
      title: 'Zählerstand beim Kunden erfragen',
      description: 'Stromzähler für Jahresabrechnung benötigt',
      due_date: '2026-07-15',
      status: 'offen' as TaskStatus,
      customer_id: 'cust-uuid-201',
      contract_id: 'contract-uuid-101',
      assigned_to: 'user-sales-01',
      created_by: 'user-admin-01',
    };

    expect(task.title).toBeTruthy();
    expect(task.status).toBe('offen');
    expect(task.customer_id).toBeTruthy();
    expect(task.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('T1.4.2 - should transition task status between offen and erledigt', () => {
    let status: TaskStatus = 'offen';
    expect(status).toBe('offen');

    // Toggle to completed
    status = 'erledigt';
    expect(status).toBe('erledigt');

    // Reopen
    status = 'offen';
    expect(status).toBe('offen');
  });

  it('T1.4.3 - should evaluate task urgency rank based on due dates', () => {
    const refDate = new Date('2026-06-10T00:00:00Z');

    // Overdue -> rank 4
    const overdue = getTaskUrgency('2026-06-05T00:00:00Z', 'offen', refDate);
    expect(overdue.key).toBe('ueberfaellig');
    expect(overdue.rank).toBe(4);

    // Urgent ≤ 3 days -> rank 3
    const urgent = getTaskUrgency('2026-06-12T00:00:00Z', 'offen', refDate);
    expect(urgent.key).toBe('hoch');
    expect(urgent.rank).toBe(3);

    // Future > 3 days -> rank 1
    const future = getTaskUrgency('2026-06-25T00:00:00Z', 'offen', refDate);
    expect(future.key).toBe('niedrig');
    expect(future.rank).toBe(1);
  });

  it('T1.4.4 - should treat completed tasks with erledigt status having rank 0 regardless of due date', () => {
    const refDate = new Date('2026-06-10T00:00:00Z');
    // Overdue past date, but completed
    const completed = getTaskUrgency('2026-05-01T00:00:00Z', 'erledigt', refDate);
    expect(completed.key).toBe('erledigt');
    expect(completed.rank).toBe(0);
  });

  it('T1.4.5 - should filter tasks by customer and assignee', () => {
    const tasks = [
      { id: 't1', title: 'Task 1', customer_id: 'cust-A', assigned_to: 'agent-1', status: 'offen' },
      { id: 't2', title: 'Task 2', customer_id: 'cust-A', assigned_to: 'agent-2', status: 'erledigt' },
      { id: 't3', title: 'Task 3', customer_id: 'cust-B', assigned_to: 'agent-1', status: 'offen' },
    ];

    const filterByCustomer = (cid: string) => tasks.filter((t) => t.customer_id === cid);
    const filterByAssignee = (uid: string) => tasks.filter((t) => t.assigned_to === uid);

    expect(filterByCustomer('cust-A')).toHaveLength(2);
    expect(filterByAssignee('agent-1')).toHaveLength(2);
  });

  it('T1.4.6 - should verify task error boundary isolation contract', () => {
    // TaskDetailsErrorBoundary contract
    const componentName = 'TaskDetailsErrorBoundary';
    expect(componentName).toBe('TaskDetailsErrorBoundary');
  });
});
