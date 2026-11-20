import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportLeadInbox from './ReportLeadInbox';
import { fetchReportLeads, type ReportLead } from '../lib/live-reports';
import { setLanguage } from '../lib/i18n';

vi.mock('../lib/live-reports', () => ({ fetchReportLeads: vi.fn() }));
const mockedFetch = vi.mocked(fetchReportLeads);
const row: ReportLead = { id: 'lead-1', report_id: 'report-1', submitted_by: 'private-user-id', message: 'I noticed it near the library entrance.', sighting_location: 'Library entrance', created_at: '2026-11-19T08:30:00.000Z' };

afterEach(() => { cleanup(); vi.clearAllMocks(); setLanguage('en'); });

describe('ReportLeadInbox', () => {
  it('shows a loading state while fetching', async () => {
    let resolve!: (value: ReportLead[]) => void;
    mockedFetch.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<ReportLeadInbox reportId="report-1" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading private leads…');
    resolve([]);
    await screen.findByText('No private leads yet.');
  });

  it('shows an empty state', async () => {
    mockedFetch.mockResolvedValueOnce([]);
    render(<ReportLeadInbox reportId="report-1" />);
    expect(await screen.findByText('No private leads yet.')).toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledWith('report-1');
  });

  it('shows an error and retries the report-scoped fetch', async () => {
    const user = userEvent.setup();
    mockedFetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([row]);
    render(<ReportLeadInbox reportId="report-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load private leads.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(row.message)).toBeInTheDocument();
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('renders message, optional location, timestamp and generic attribution without identity leakage', async () => {
    mockedFetch.mockResolvedValueOnce([row]);
    render(<ReportLeadInbox reportId="report-1" />);
    expect(await screen.findByText(row.message)).toBeInTheDocument();
    expect(screen.getByText('School member')).toBeInTheDocument();
    expect(screen.getByText('Library entrance', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('time')).toHaveAttribute('dateTime', row.created_at);
    expect(document.body).not.toHaveTextContent('private-user-id');
  });

  it('does not fetch when even an empty volatile demo list is supplied', async () => {
    render(<ReportLeadInbox reportId="report-1" demoLeads={[]} />);
    expect(screen.getByText('No private leads yet.')).toBeInTheDocument();
    await waitFor(() => expect(mockedFetch).not.toHaveBeenCalled());
  });

  it('localizes inbox states in Thai', async () => {
    setLanguage('th');
    render(<ReportLeadInbox reportId="report-1" demoLeads={[]} />);
    expect(screen.getByRole('heading', { name: 'เบาะแสส่วนตัว' })).toBeInTheDocument();
    expect(screen.getByText('ยังไม่มีเบาะแสส่วนตัว')).toBeInTheDocument();
  });
});
