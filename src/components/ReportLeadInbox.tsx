import { useCallback, useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { fetchReportLeads, type ReportLead } from '../lib/live-reports';
import { useI18n } from '../lib/i18n';

export type ReportLeadInboxProps = { reportId: string; demoLeads?: ReportLead[] };

export function ReportLeadInbox({ reportId, demoLeads }: ReportLeadInboxProps) {
  const { language, t } = useI18n();
  const isDemo = demoLeads !== undefined;
  const [leads, setLeads] = useState<ReportLead[]>(demoLeads ?? []);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    if (isDemo) {
      setLeads(demoLeads);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      setLeads(await fetchReportLeads(reportId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [attempt, demoLeads, isDemo, reportId]);

  useEffect(() => { void load(); }, [load]);
  return <section className="report-lead-inbox" aria-labelledby="report-lead-inbox-heading">
    <div className="report-lead-inbox-heading"><h2 id="report-lead-inbox-heading">{t('Private leads')}</h2>{!loading && !error && leads.length > 0 && <span className="report-lead-count">{leads.length}</span>}</div>
    {loading && <p role="status" className="report-lead-state">{t('Loading private leads…')}</p>}
    {error && <div className="report-lead-state" role="alert"><p>{t('Unable to load private leads.')}</p><Button className="button secondary" variant="secondary" size="sm" onPress={() => setAttempt((value) => value + 1)}>{t('Try again')}</Button></div>}
    {!loading && !error && leads.length === 0 && <p className="report-lead-state">{t('No private leads yet.')}</p>}
    {!loading && !error && leads.length > 0 && <ul className="report-lead-list">{leads.map((lead) => <li className="report-lead-item" key={lead.id}>
      <div className="report-lead-meta"><strong>{t('School member')}</strong><time dateTime={lead.created_at}>{new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lead.created_at))}</time></div>
      <p className="report-lead-message">{lead.message}</p>
      {lead.sighting_location && <p className="report-lead-location"><span>{t('Approximate location')}:</span> {lead.sighting_location}</p>}
    </li>)}</ul>}
  </section>;
}

export default ReportLeadInbox;
