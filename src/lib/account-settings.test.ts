import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => {
  const chain = {
    from: vi.fn(), select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(),
    upsert: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn(),
    single: vi.fn(), rpc: vi.fn(),
  };
  for (const method of ['from', 'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order', 'limit']) {
    chain[method as keyof typeof chain].mockReturnValue(chain);
  }
  return chain;
});
vi.mock('./supabase', () => ({ supabase: client }));

import {
  buildOwnDataExport,
  fetchOwnDataExport,
  fetchOwnNotifications,
  fetchOwnReports,
  fetchSchoolAccountRequests,
  normalizeAccountSettingsInput,
  normalizeApprovedDomain,
  parseAccountRequest,
  parseAccountSettings,
  parseApprovedDomain,
  parseFoundItNotification,
  parseOwnClaim,
  parseOwnReport,
  parseReviewSettings,
  parseSchoolMember,
  updateOwnAccountSettings,
} from './account-settings';

const settingsRow = {
  user_id: 'member-1', language: 'th', notify_report_updates: false,
  notify_claim_lead_updates: true, updated_at: '2026-11-20T12:00:00Z',
};
const notificationRow = {
  id: 'notice-1', category: 'claim_lead', event_type: 'new_lead',
  report_id: 'report-1', created_at: '2026-11-20T12:00:00Z', read_at: null,
} as const;

describe('account settings boundary validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('trims and bounds the display name and maps public claim preference explicitly', () => {
    expect(normalizeAccountSettingsInput({
      display_name: '  Niran  ', language: 'th', notify_report_updates: false, notify_claim_updates: true,
    })).toEqual({
      display_name: 'Niran', language: 'th', notify_report_updates: false, notify_claim_lead_updates: true,
    });
    expect(() => normalizeAccountSettingsInput({
      display_name: '  ', language: 'en', notify_report_updates: true, notify_claim_updates: true,
    })).toThrow();
    expect(() => normalizeAccountSettingsInput({
      display_name: 'x'.repeat(121), language: 'en', notify_report_updates: true, notify_claim_updates: true,
    })).toThrow();
  });

  it.each([
    ['phichai.ac.th', 'phichai.ac.th'], [' SCHOOL.PHICHAI.AC.TH ', 'school.phichai.ac.th'],
  ])('normalizes valid approved domain %s', (input, expected) => {
    expect(normalizeApprovedDomain(input)).toBe(expected);
  });

  it.each(['@phichai.ac.th', 'phichai..ac.th', '-bad.example', 'bad-.example', 'bad domain.com', 'bad_.example', '.example.com', 'example.com.'])('rejects malformed approved domain %s', (domain) => {
    expect(() => normalizeApprovedDomain(domain)).toThrow();
  });

  it('parses account settings and maps database claim preference into public contract', () => {
    expect(parseAccountSettings(settingsRow)).toEqual({
      display_name: '',
      language: 'th', notify_report_updates: false, notify_claim_updates: true,
    });
    expect(() => parseAccountSettings({ ...settingsRow, notify_claim_lead_updates: 'true' })).toThrow('Invalid account settings');
  });

  it('rejects malformed rows for each account and administration boundary', () => {
    expect(() => parseFoundItNotification({ ...notificationRow, body: 'secret' })).not.toThrow();
    expect(() => parseFoundItNotification({ ...notificationRow, category: 'other' })).toThrow();
    expect(() => parseAccountRequest({ id: 'r', user_id: 'u', school_id: 's', status: 'deleted', created_at: 'x', updated_at: 'x' })).toThrow();
    expect(() => parseSchoolMember({ id: 'u', school_id: 's', role: 'owner', display_name: 'A', email: 'a@b' })).toThrow();
    expect(() => parseApprovedDomain({ id: 'd', school_id: 's', domain: 'bad..domain', created_at: 'x' })).toThrow();
    expect(() => parseReviewSettings({ school_id: 's', missing_requires_review: 'yes', found_requires_review: true })).toThrow();
  });

  it('rejects report and claim statuses outside their domain enums', () => {
    const report = { id: 'report-1', report_type: 'missing', title: 'Keys', category: 'Keys', description: 'Blue tag', last_seen_at: null, found_at: null, location_text: 'Hall', photo_path: null, status: 'deleted', created_by: 'member-1', created_at: '2026-11-20T12:00:00Z' };
    const claim = { id: 'claim-1', report_id: 'report-1', claimant_id: 'member-1', private_details: 'scratch on back', status: 'deleted', created_at: '2026-11-20T12:00:00Z' };
    expect(() => parseOwnReport(report)).toThrow('Invalid own report');
    expect(() => parseOwnClaim(claim)).toThrow('Invalid own claim');
  });

  it('parses notification metadata without private claim or lead message fields', () => {
    const parsed = parseFoundItNotification({ ...notificationRow, private_details: 'secret', message: 'secret' });
    expect(parsed).toEqual(notificationRow);
    expect(parsed).not.toHaveProperty('private_details');
    expect(parsed).not.toHaveProperty('message');
  });
});

describe('account settings data access', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates only the selected member settings and returns the mapped public type', async () => {
    client.eq.mockReturnValue(client);
    client.select.mockReturnValue(client);
    client.single.mockResolvedValue({ data: settingsRow, error: null });
    const result = await updateOwnAccountSettings('member-1', {
      display_name: '  Niran ', language: 'th', notify_report_updates: false, notify_claim_updates: true,
    });
    expect(result).toEqual({ display_name: 'Niran', language: 'th', notify_report_updates: false, notify_claim_updates: true });
    expect(client.from).toHaveBeenCalledWith('user_settings');
    expect(client.eq).toHaveBeenCalledWith('user_id', 'member-1');
    expect(client.update).toHaveBeenNthCalledWith(1, { display_name: 'Niran' });
    expect(client.update).toHaveBeenNthCalledWith(2, { language: 'th', notify_report_updates: false, notify_claim_lead_updates: true });
    expect(client.select).toHaveBeenCalledWith('user_id, language, notify_report_updates, notify_claim_lead_updates, updated_at');
  });

  it('fetches own reports with explicit bounded columns and owner scope', async () => {
    const report = { id: 'report-1', report_type: 'missing', title: 'Keys', category: 'Keys', description: 'Blue tag', last_seen_at: null, found_at: null, location_text: 'Hall', photo_path: 'member-1/photo.jpg', status: 'approved', created_by: 'member-1', created_at: '2026-11-20T12:00:00Z' };
    client.limit.mockResolvedValue({ data: [report], error: null });
    const rows = await fetchOwnReports('member-1');
    expect(rows[0]).toEqual(report);
    expect(client.from).toHaveBeenCalledWith('reports');
    expect(client.eq).toHaveBeenCalledWith('created_by', 'member-1');
    expect(client.limit).toHaveBeenCalledWith(200);
    expect(client.select).toHaveBeenCalledWith('id, report_type, title, category, description, last_seen_at, found_at, location_text, photo_path, status, created_by, created_at');
  });

  it('rejects a report row returned for a different owner despite the query filter', async () => {
    client.limit.mockResolvedValue({ data: [{ id: 'r', report_type: 'missing', title: 'Keys', category: 'Keys', description: 'Blue tag', last_seen_at: null, found_at: null, location_text: 'Hall', photo_path: null, status: 'approved', created_by: 'other-user', created_at: '2026-11-20T12:00:00Z' }], error: null });
    await expect(fetchOwnReports('member-1')).rejects.toThrow('Invalid own reports');
  });

  it('scopes school member reads to school and rejects a returned foreign-school row', async () => {
    const member = { id: 'm', school_id: 'school-2', display_name: 'A', email: 'a@school.test', role: 'student' };
    client.limit.mockResolvedValue({ data: [member], error: null });
    const { fetchSchoolMembers } = await import('./account-settings');
    await expect(fetchSchoolMembers('school-1')).rejects.toThrow('Invalid school members');
    expect(client.eq).toHaveBeenCalledWith('school_id', 'school-1');
    expect(client.limit).toHaveBeenCalledWith(200);
  });

  it('rejects a school account request returned for a different school', async () => {
    client.limit.mockResolvedValue({ data: [{ id: 'request-1', user_id: 'member-1', school_id: 'school-2', status: 'open', created_at: '2026-11-20T12:00:00Z', updated_at: '2026-11-20T12:00:00Z' }], error: null });
    await expect(fetchSchoolAccountRequests('school-1')).rejects.toThrow('Invalid account requests');
    expect(client.eq).toHaveBeenCalledWith('school_id', 'school-1');
  });

  it('uses the reviewed role-change RPC without a client-side role update', async () => {
    client.rpc.mockResolvedValue({ error: null });
    const { changeSchoolMemberRole } = await import('./account-settings');
    await changeSchoolMemberRole('member-2', 'teacher');
    expect(client.rpc).toHaveBeenCalledWith('change_school_member_role', { p_target_user_id: 'member-2', p_new_role: 'teacher' });
    expect(client.update).not.toHaveBeenCalled();
  });

  it('scopes notification listing to recipient, bounded list, and metadata only', async () => {
    client.limit.mockResolvedValue({ data: [notificationRow], error: null });
    expect(await fetchOwnNotifications('member-1')).toEqual([notificationRow]);
    expect(client.eq).toHaveBeenCalledWith('user_id', 'member-1');
    expect(client.limit).toHaveBeenCalledWith(100);
    expect(client.select).toHaveBeenCalledWith('id, category, event_type, report_id, created_at, read_at');
  });

  it('builds an export without image binaries or image URLs and with private own claim details', () => {
    const payload = buildOwnDataExport({
      profile: { id: 'member-1', display_name: 'Niran', email: 'n@example.org', school_id: 'school-1', role: 'student' },
      settings: { display_name: 'Niran', language: 'en', notify_report_updates: true, notify_claim_updates: true },
      reports: [{ id: 'report-1', report_type: 'missing', title: 'Keys', category: 'Keys', description: 'Blue tag', last_seen_at: null, found_at: null, location_text: 'Hall', photo_path: 'member-1/photo.jpg', status: 'approved', created_by: 'member-1', created_at: '2026-11-20T12:00:00Z' }],
      claims: [{ id: 'claim-1', report_id: 'report-1', claimant_id: 'member-1', private_details: 'scratch on back', status: 'pending', created_at: '2026-11-20T12:00:00Z' }],
      leads: [{ id: 'lead-1', report_id: 'report-1', submitted_by: 'member-1', message: 'seen at gate', sighting_location: null, created_at: '2026-11-20T12:00:00Z' }], notifications: [notificationRow], account_requests: [],
    });
    expect(payload.claims[0].private_details).toBe('scratch on back');
    expect(payload.reports[0].photo_path).toBe('member-1/photo.jpg');
    expect(JSON.stringify(payload)).not.toMatch(/data:image|https?:\/\//i);
  });

  it('propagates database errors unchanged', async () => {
    const error = { code: '42501', message: 'denied' };
    client.limit.mockResolvedValue({ data: null, error });
    await expect(fetchOwnNotifications('member-1')).rejects.toBe(error);
  });
});
