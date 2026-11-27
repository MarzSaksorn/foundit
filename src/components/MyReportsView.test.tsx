import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../lib/i18n';
import type { Report } from '../lib/reports';
import { MyReportsView, type MyReportsViewProps } from './MyReportsView';

function makeReport(id: string, overrides: Partial<Report> = {}): Report {
  return {
    id,
    type: 'missing',
    title: `Item ${id}`,
    category: 'Electronics',
    description: 'A blue item last seen near the library.',
    dateLabel: 'Last seen Nov 26, 2026',
    location: 'Library',
    status: 'approved',
    ageDays: 1,
    createdLabel: 'Nov 27, 2026',
    createdBy: 'You',
    createdById: 'member-1',
    initials: 'ME',
    ...overrides,
  };
}

function setup(overrides: Partial<MyReportsViewProps> = {}) {
  const props: MyReportsViewProps = {
    reports: [makeReport('report-1')],
    leadCounts: {},
    leadCountsState: 'ready',
    onOpenReport: vi.fn(),
    onCreateReport: vi.fn(),
    ...overrides,
  };
  render(<MyReportsView {...props} />);
  return props;
}

describe('MyReportsView', () => {
  beforeEach(() => setLanguage('en'));
  afterEach(() => cleanup());

  it('shows all owned reports with visible report status and type', () => {
    const reports = [
      makeReport('pending', { title: 'Pending report', status: 'pending' }),
      makeReport('approved', { title: 'Approved report', status: 'approved' }),
      makeReport('returned', { title: 'Returned report', type: 'found', status: 'returned' }),
      makeReport('rejected', { title: 'Rejected report', type: 'found', status: 'rejected' }),
      makeReport('archived', { title: 'Archived report', status: 'archived' }),
    ];
    setup({ reports });

    const expected = [
      ['Pending report', 'Missing', 'Pending review'],
      ['Approved report', 'Missing', 'Live on board'],
      ['Returned report', 'Found', 'Returned'],
      ['Rejected report', 'Found', 'Rejected'],
      ['Archived report', 'Missing', 'Archived'],
    ];
    for (const [title, type, status] of expected) {
      const row = screen.getByRole('article', { name: title });
      expect(within(row).getByText(type)).toBeInTheDocument();
      expect(within(row).getByText(status)).toBeInTheDocument();
    }
  });

  it('filters reports by missing and found types', async () => {
    const user = userEvent.setup();
    setup({ reports: [
      makeReport('missing-1', { title: 'Missing bottle' }),
      makeReport('found-1', { title: 'Found scarf', type: 'found' }),
    ] });

    await user.click(screen.getByRole('button', { name: /Missing/ }));
    expect(screen.getByRole('article', { name: 'Missing bottle' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Found scarf' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Found/ }));
    expect(screen.getByRole('article', { name: 'Found scarf' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Missing bottle' })).not.toBeInTheDocument();
  });

  it('searches titles and descriptions without changing the source list', () => {
    const reports = [
      makeReport('bottle', { title: 'Silver bottle', description: 'Green sticker near the gym.' }),
      makeReport('folder', { title: 'Blue folder', description: 'Math notes inside.' }),
    ];
    setup({ reports });
    const search = screen.getByRole('searchbox', { name: 'Search your reports' });

    fireEvent.change(search, { target: { value: 'green sticker' } });
    expect(screen.getByRole('article', { name: 'Silver bottle' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Blue folder' })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'blue folder' } });
    expect(screen.getByRole('article', { name: 'Blue folder' })).toBeInTheDocument();
    expect(reports).toHaveLength(2);

    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getByRole('article', { name: 'Silver bottle' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Blue folder' })).toBeInTheDocument();
  });

  it('shows the total lead count and opens the private inbox for a missing report with leads', async () => {
    const user = userEvent.setup();
    const report = makeReport('missing-with-leads', { title: 'Silver bottle' });
    const props = setup({ reports: [report], leadCounts: { [report.id]: 2 } });

    const summary = screen.getByRole('region', { name: 'Summary of your reports' });
    expect(within(summary).getByText('2')).toBeInTheDocument();
    const row = screen.getByRole('article', { name: 'Silver bottle' });
    expect(within(row).getByText('2 leads')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'View leads' }));
    expect(props.onOpenReport).toHaveBeenCalledWith(report.id, true);
  });

  it('shows no-leads state and opens an owned missing report normally', async () => {
    const user = userEvent.setup();
    const report = makeReport('missing-without-leads', { title: 'Blue bottle' });
    const props = setup({ reports: [report], leadCounts: { [report.id]: 0 } });
    const row = screen.getByRole('article', { name: 'Blue bottle' });

    expect(within(row).getByText('No leads yet.')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Open report' }));
    expect(props.onOpenReport).toHaveBeenCalledWith(report.id, false);
  });

  it('omits numeric lead counts and keeps report actions available when counts fail', async () => {
    const user = userEvent.setup();
    const report = makeReport('count-error', { title: 'Lost headphones' });
    const props = setup({ reports: [report], leadCounts: { [report.id]: 9 }, leadCountsState: 'error' });
    const row = screen.getByRole('article', { name: 'Lost headphones' });

    expect(within(row).getByText('Lead count unavailable')).toBeInTheDocument();
    expect(within(row).queryByText('9 leads')).not.toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Open report' }));
    expect(props.onOpenReport).toHaveBeenCalledWith(report.id, false);
  });

  it('shows an empty state with both report creation actions', async () => {
    const user = userEvent.setup();
    const props = setup({ reports: [] });

    expect(screen.getByText('No reports yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Report something missing' }));
    await user.click(screen.getByRole('button', { name: 'Report something found' }));
    expect(props.onCreateReport).toHaveBeenNthCalledWith(1, 'missing');
    expect(props.onCreateReport).toHaveBeenNthCalledWith(2, 'found');
  });

  it('keeps filters and report actions keyboard operable with accessible names', async () => {
    const user = userEvent.setup();
    const report = makeReport('keyboard-report', { title: 'Keyboard report' });
    const props = setup({ reports: [report], leadCounts: { [report.id]: 1 } });
    const search = screen.getByRole('searchbox', { name: 'Search your reports' });
    const missingFilter = screen.getByRole('button', { name: /Missing/ });
    const viewLeads = screen.getByRole('button', { name: 'View leads' });

    expect(search).toBeInTheDocument();
    missingFilter.focus();
    expect(missingFilter).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(missingFilter).toHaveAttribute('aria-pressed', 'true');
    viewLeads.focus();
    expect(viewLeads).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(props.onOpenReport).toHaveBeenCalledWith(report.id, true);
  });

  it('renders the page title and search label in Thai', () => {
    setLanguage('th');
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'รายงานของฉัน' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'ค้นหารายงานของคุณ' })).toBeInTheDocument();
  });
});
