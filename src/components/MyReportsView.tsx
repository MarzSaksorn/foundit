import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { statusLabel, type Report, type ReportType } from '../lib/reports';

export type MyReportsViewProps = {
  reports: Report[];
  leadCounts: Record<string, number>;
  leadCountsState: 'loading' | 'ready' | 'error';
  onOpenReport: (reportId: string, focusLeadInbox: boolean) => void;
  onCreateReport: (type: ReportType) => void;
};

type ReportTypeFilter = 'all' | ReportType;

export function MyReportsView(props: MyReportsViewProps) {
  const { language, t } = useI18n();
  const [typeFilter, setTypeFilter] = useState<ReportTypeFilter>('all');
  const [search, setSearch] = useState('');
  const missingCount = props.reports.filter((report) => report.type === 'missing').length;
  const foundCount = props.reports.filter((report) => report.type === 'found').length;
  const totalLeadCount = props.reports.reduce((total, report) => {
    return report.type === 'missing' ? total + (props.leadCounts[report.id] ?? 0) : total;
  }, 0);
  const filters = [
    { value: 'all' as const, label: t('All reports'), count: props.reports.length },
    { value: 'missing' as const, label: t('Missing'), count: missingCount },
    { value: 'found' as const, label: t('Found'), count: foundCount },
  ];
  const normalizedSearch = search.trim().toLocaleLowerCase(language === 'th' ? 'th-TH' : 'en-US');
  // AppShell passes the created_at-descending query order; preserve that order without mutating the source list.
  const visibleReports = useMemo(() => props.reports.filter((report) => {
    const matchesType = typeFilter === 'all' || report.type === typeFilter;
    const matchesSearch = !normalizedSearch || `${report.title} ${report.description}`
      .toLocaleLowerCase(language === 'th' ? 'th-TH' : 'en-US')
      .includes(normalizedSearch);
    return matchesType && matchesSearch;
  }), [language, normalizedSearch, props.reports, typeFilter]);

  const leadsSummary = props.leadCountsState === 'ready'
    ? totalLeadCount.toLocaleString(language === 'th' ? 'th-TH' : 'en-US')
    : props.leadCountsState === 'loading' ? t('Loading…') : t('Unavailable');

  return <section className="my-reports-page" aria-labelledby="my-reports-title">
    <header className="my-reports-heading">
      <div>
        <div className="eyebrow"><span className="eyebrow-line purple" />{t('Your workspace')}</div>
        <h1 id="my-reports-title">{t('My Reports')}</h1>
        <p className="lede">{t('Track your reports and check progress or new leads on missing items.')}</p>
        <p className="my-reports-privacy">{t('Your reports and private leads are only visible to you and authorized school staff.')}</p>
      </div>
      {props.reports.length > 0 && <div className="my-reports-create-actions" role="group" aria-label={t('Create a report')}>
        <button type="button" className="button primary" onClick={() => props.onCreateReport('missing')}>{t('Report something missing')}</button>
        <button type="button" className="button secondary" onClick={() => props.onCreateReport('found')}>{t('Report something found')}</button>
      </div>}
    </header>

    <section className="my-reports-summary" aria-label={t('Summary of your reports')}>
      <div><strong>{props.reports.length.toLocaleString(language === 'th' ? 'th-TH' : 'en-US')}</strong><span>{t('Reports')}</span></div>
      <div><strong>{missingCount.toLocaleString(language === 'th' ? 'th-TH' : 'en-US')}</strong><span>{t('Missing items')}</span></div>
      <div><strong>{leadsSummary}</strong><span>{t('Total leads received')}</span></div>
    </section>

    <div className="my-reports-toolbar">
      <div className="my-reports-filters" role="group" aria-label={t('Filter your reports')}>
        {filters.map((filter) => <button
          key={filter.value}
          type="button"
          aria-pressed={typeFilter === filter.value}
          onClick={() => setTypeFilter(filter.value)}
        >{filter.label}<span aria-hidden="true">{filter.count}</span></button>)}
      </div>
      <label className="my-reports-search">
        <span className="visually-hidden">{t('Search your reports')}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('Search by title or description')}
        />
      </label>
    </div>

    <div className="my-reports-list-heading">
      <h2>{t('Your reports')}</h2>
      <span>{t('Newest first')}</span>
    </div>

    {visibleReports.length > 0 ? <div className="my-report-list">
      {visibleReports.map((report) => {
        const leadCount = props.leadCounts[report.id] ?? 0;
        const hasLeads = report.type === 'missing' && props.leadCountsState === 'ready' && leadCount > 0;
        const actionLabel = hasLeads ? t('View leads') : report.type === 'missing' ? t('Open report') : t('View report');
        const titleId = `my-report-title-${report.id}`;
        return <article className="my-report-row" key={report.id} aria-labelledby={titleId}>
          <div className="my-report-details">
            <div className="my-report-topline">
              <span className={`my-report-type ${report.type}`}>{t(report.type === 'missing' ? 'Missing' : 'Found')}</span>
              <span className={`status-chip status-${report.status}`}>{t(statusLabel[report.status])}</span>
            </div>
            <h3 id={titleId}>{report.title}</h3>
            <div className="my-report-facts">
              <span>{t(report.category)}</span>
              <span>{t('Report location')}: {t(report.location)}</span>
              <span>{t('Report date')}: {t(report.dateLabel)}</span>
            </div>
          </div>
          <div className="my-report-actions">
            {report.type === 'missing' && <p className="my-report-lead-state">
              {props.leadCountsState === 'loading' ? t('Loading lead counts…')
                : props.leadCountsState === 'error' ? t('Lead count unavailable')
                  : leadCount === 0 ? t('No leads yet.')
                    : <><strong>{leadCount.toLocaleString(language === 'th' ? 'th-TH' : 'en-US')} {t(leadCount === 1 ? 'lead' : 'leads')}</strong></>}
            </p>}
            <button
              type="button"
              className={`button ${hasLeads ? 'primary' : 'secondary'}`}
              onClick={() => props.onOpenReport(report.id, hasLeads)}
            >{actionLabel}</button>
          </div>
        </article>;
      })}
    </div> : props.reports.length === 0 ? <div className="my-reports-empty empty-state">
      <h3>{t('No reports yet.')}</h3>
      <p>{t('Your reports will appear here after you submit one.')}</p>
      <div className="my-reports-empty-actions" role="group" aria-label={t('Create a report')}>
        <button type="button" className="button primary" onClick={() => props.onCreateReport('missing')}>{t('Report something missing')}</button>
        <button type="button" className="button secondary" onClick={() => props.onCreateReport('found')}>{t('Report something found')}</button>
      </div>
    </div> : <div className="my-reports-no-results" role="status">
      <h3>{t('No reports match your search.')}</h3>
      <p>{t('Try a different search or clear the type filter.')}</p>
    </div>}
  </section>;
}

export default MyReportsView;
