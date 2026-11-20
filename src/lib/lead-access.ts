import type { Report } from './reports';

type LeadAccessReport = Pick<Report, 'createdById' | 'type' | 'status'>;

export function canSubmitReportLead(report: LeadAccessReport, viewerId: string | undefined, demoMode: boolean): boolean {
  const isEligibleReport = report.type === 'missing' && report.status === 'approved';
  const viewerIsOwner = viewerId !== undefined && report.createdById === viewerId;
  return isEligibleReport && !viewerIsOwner && (demoMode || viewerId !== undefined);
}

export function canViewReportLeadInbox(
  report: LeadAccessReport,
  viewerId: string | undefined,
  canModerate: boolean,
  demoMode: boolean,
): boolean {
  if (demoMode) return canModerate;
  if (viewerId === undefined) return false;
  return canModerate || report.createdById === viewerId;
}
