import { describe, expect, it } from 'vitest';
import { canSubmitReportLead, canViewReportLeadInbox } from './lead-access';
import type { Report } from './reports';

const eligibleReport: Pick<Report, 'createdById' | 'type' | 'status'> = {
  createdById: 'owner-1',
  type: 'missing',
  status: 'approved',
};

describe('report lead access', () => {
  it('allows another signed-in member to submit for an approved missing report', () => {
    expect(canSubmitReportLead(eligibleReport, 'student-2', false)).toBe(true);
  });

  it('hides submission from the report owner and from signed-out production viewers', () => {
    expect(canSubmitReportLead(eligibleReport, 'owner-1', false)).toBe(false);
    expect(canSubmitReportLead(eligibleReport, undefined, false)).toBe(false);
  });

  it('allows in-memory demo submissions for eligible reports without fabricating an account', () => {
    expect(canSubmitReportLead(eligibleReport, undefined, true)).toBe(true);
  });

  it('rejects found, pending, and closed reports for lead submission', () => {
    expect(canSubmitReportLead({ ...eligibleReport, type: 'found' }, 'student-2', false)).toBe(false);
    expect(canSubmitReportLead({ ...eligibleReport, status: 'pending' }, 'student-2', false)).toBe(false);
    expect(canSubmitReportLead({ ...eligibleReport, status: 'returned' }, 'student-2', false)).toBe(false);
    expect(canSubmitReportLead({ ...eligibleReport, status: 'archived' }, 'student-2', false)).toBe(false);
  });

  it('allows the report owner or authorized staff to view the private inbox', () => {
    expect(canViewReportLeadInbox(eligibleReport, 'owner-1', false, false)).toBe(true);
    expect(canViewReportLeadInbox(eligibleReport, 'teacher-3', true, false)).toBe(true);
  });

  it('hides the private inbox from unrelated or signed-out production viewers', () => {
    expect(canViewReportLeadInbox(eligibleReport, 'student-2', false, false)).toBe(false);
    expect(canViewReportLeadInbox(eligibleReport, undefined, true, false)).toBe(false);
  });

  it('keeps the demo inbox limited to the demo staff view', () => {
    expect(canViewReportLeadInbox(eligibleReport, undefined, true, true)).toBe(true);
    expect(canViewReportLeadInbox(eligibleReport, undefined, false, true)).toBe(false);
  });
});
