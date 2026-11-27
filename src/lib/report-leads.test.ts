import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClient = vi.hoisted(() => {
  const chain = {
    from: vi.fn(), insert: vi.fn(), select: vi.fn(), single: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(), limit: vi.fn(), range: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
});
vi.mock('./supabase', () => ({ supabase: mockClient }));

import { createReportLead, fetchOwnLiveReports, fetchReportLeadCounts, fetchReportLeads } from './live-reports';

const columns = 'id, report_id, submitted_by, message, sighting_location, created_at';
const row = {
  id: 'lead-1', report_id: 'report-1', submitted_by: 'user-1', message: 'Saw the item near the library',
  sighting_location: 'Library', created_at: '2026-11-19T10:00:00Z',
};
const ownReportRow = {
  id: 'report-1', report_type: 'missing' as const, title: 'Blue backpack', category: 'Accessories',
  description: 'A report created by the signed-in member.', last_seen_at: null, found_at: null,
  location_text: 'Library', photo_path: null, status: 'archived' as const, created_by: 'member-1',
  created_at: '2026-11-19T10:00:00Z', storage_locations: null,
};

describe('report lead service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts only normalized lead fields and selects only the declared columns', async () => {
    mockClient.single.mockResolvedValue({ data: row, error: null });
    await expect(createReportLead('user-1', 'report-1', {
      message: '  Saw the item near the library  ', sightingLocation: '  Library  ',
    })).resolves.toEqual(row);
    expect(mockClient.from).toHaveBeenCalledWith('report_leads');
    expect(mockClient.insert).toHaveBeenCalledWith({
      report_id: 'report-1', submitted_by: 'user-1', message: 'Saw the item near the library', sighting_location: 'Library',
    });
    expect(mockClient.select).toHaveBeenCalledWith(columns);
    expect(mockClient.single).toHaveBeenCalledOnce();
  });

  it('normalizes a blank optional location to null', async () => {
    mockClient.single.mockResolvedValue({ data: { ...row, sighting_location: null }, error: null });
    await createReportLead('user-1', 'report-1', { message: 'A sufficiently long note', sightingLocation: '  ' });
    expect(mockClient.insert).toHaveBeenCalledWith({
      report_id: 'report-1', submitted_by: 'user-1', message: 'A sufficiently long note', sighting_location: null,
    });
  });

  it('scopes fetch to the report, orders newest first, and limits to 100', async () => {
    mockClient.limit.mockResolvedValue({ data: [row], error: null });
    await expect(fetchReportLeads('report-1')).resolves.toEqual([row]);
    expect(mockClient.from).toHaveBeenCalledWith('report_leads');
    expect(mockClient.select).toHaveBeenCalledWith(columns);
    expect(mockClient.eq).toHaveBeenCalledWith('report_id', 'report-1');
    expect(mockClient.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockClient.limit).toHaveBeenCalledWith(100);
  });

  it('rejects malformed external rows rather than treating them as leads', async () => {
    mockClient.single.mockResolvedValue({ data: { ...row, submitted_by: 4 }, error: null });
    await expect(createReportLead('user-1', 'report-1', { message: 'A sufficiently long note' })).rejects.toThrow('Invalid report lead');
  });

  it('rejects a created row whose report or submitter differs from the request', async () => {
    mockClient.single.mockResolvedValueOnce({ data: { ...row, report_id: 'another-report' }, error: null });
    await expect(createReportLead('user-1', 'report-1', { message: 'A sufficiently long note' })).rejects.toThrow('Invalid report lead');

    mockClient.single.mockResolvedValueOnce({ data: { ...row, submitted_by: 'another-user' }, error: null });
    await expect(createReportLead('user-1', 'report-1', { message: 'A sufficiently long note' })).rejects.toThrow('Invalid report lead');
  });

  it('rejects a non-array fetch response and malformed or cross-report rows', async () => {
    mockClient.limit.mockResolvedValueOnce({ data: row, error: null });
    await expect(fetchReportLeads('report-1')).rejects.toThrow('Invalid report leads');

    mockClient.limit.mockResolvedValueOnce({ data: [{ ...row, submitted_by: 4 }], error: null });
    await expect(fetchReportLeads('report-1')).rejects.toThrow('Invalid report lead');

    mockClient.limit.mockResolvedValueOnce({ data: [{ ...row, report_id: 'another-report' }], error: null });
    await expect(fetchReportLeads('report-1')).rejects.toThrow('Invalid report leads');
  });

  it('propagates Supabase errors unchanged for both operations', async () => {
    const error = { code: '42501', message: 'denied' };
    mockClient.single.mockResolvedValue({ data: null, error });
    await expect(createReportLead('user-1', 'report-1', { message: 'A sufficiently long note' })).rejects.toBe(error);
    mockClient.limit.mockResolvedValue({ data: null, error });
    await expect(fetchReportLeads('report-1')).rejects.toBe(error);
  });

  it('returns an empty object without querying when no report IDs are provided', async () => {
    await expect(fetchReportLeadCounts([])).resolves.toEqual({});
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it('groups report IDs and includes requested reports with zero leads', async () => {
    mockClient.range.mockResolvedValue({
      data: [{ report_id: 'report-1' }, { report_id: 'report-1' }, { report_id: 'report-3' }],
      error: null,
    });

    await expect(fetchReportLeadCounts(['report-1', 'report-2', 'report-3'])).resolves.toEqual({
      'report-1': 2,
      'report-2': 0,
      'report-3': 1,
    });
  });

  it('paginates full pages and counts every returned lead', async () => {
    const firstPage = Array.from({ length: 500 }, () => ({ report_id: 'report-1' }));
    mockClient.range
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [{ report_id: 'report-2' }], error: null });

    await expect(fetchReportLeadCounts(['report-1', 'report-2'])).resolves.toEqual({
      'report-1': 500,
      'report-2': 1,
    });
    expect(mockClient.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(mockClient.range).toHaveBeenNthCalledWith(2, 500, 999);
  });

  it('selects only report_id, scopes to requested IDs, and orders pages by ID', async () => {
    mockClient.range.mockResolvedValue({ data: [{ report_id: 'report-2' }], error: null });

    await fetchReportLeadCounts(['report-1', 'report-2']);

    expect(mockClient.from).toHaveBeenCalledWith('report_leads');
    expect(mockClient.select).toHaveBeenCalledWith('report_id');
    expect(mockClient.in).toHaveBeenCalledWith('report_id', ['report-1', 'report-2']);
    expect(mockClient.order).toHaveBeenCalledWith('id', { ascending: true });
  });

  it('propagates lead-count Supabase errors unchanged', async () => {
    const error = { code: '42501', message: 'denied' };
    mockClient.range.mockResolvedValue({ data: null, error });

    await expect(fetchReportLeadCounts(['report-1'])).rejects.toBe(error);
  });
});

describe('owned live report service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('paginates owner-scoped reports beyond 200 rows', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => ({ ...ownReportRow, id: `report-${index}` }));
    mockClient.range
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [{ ...ownReportRow, id: 'report-200' }], error: null });

    const reports = await fetchOwnLiveReports('member-1');

    expect(reports).toHaveLength(201);
    expect(reports[200]?.id).toBe('report-200');
    expect(reports.every((report) => report.createdById === 'member-1')).toBe(true);
    expect(mockClient.from).toHaveBeenCalledWith('reports');
    expect(mockClient.eq).toHaveBeenCalledWith('created_by', 'member-1');
    expect(mockClient.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(mockClient.range).toHaveBeenNthCalledWith(1, 0, 199);
    expect(mockClient.range).toHaveBeenNthCalledWith(2, 200, 399);
  });
});
