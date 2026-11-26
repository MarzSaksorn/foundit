import { supabase } from './supabase';

export type AccountSettings = {
  display_name: string;
  language: 'en' | 'th';
  notify_report_updates: boolean;
  notify_claim_updates: boolean;
};
export type FoundItNotification = {
  id: string; category: 'report_review' | 'claim_lead'; event_type: 'report_status' | 'claim_status' | 'new_lead';
  report_id: string; created_at: string; read_at: string | null;
};
export type AccountRequest = { id: string; user_id: string; school_id: string; status: AccountRequestStatus; created_at: string; updated_at: string };
export type AccountRequestStatus = 'open' | 'received' | 'in_progress' | 'completed';
export type SchoolMember = { id: string; school_id: string; display_name: string; email: string; role: SchoolRole };
export type SchoolRole = 'student' | 'teacher' | 'moderator' | 'admin';
export type ApprovedDomain = { id: string; school_id: string; domain: string; created_at: string };
export type ReviewSettings = { missing_reports_need_review: boolean; found_reports_need_review: boolean };
export type StorageLocation = { id: string; school_id: string; label: string; responsible_name: string };
export type OwnReport = {
  id: string; report_type: 'missing' | 'found'; title: string; category: string; description: string;
  last_seen_at: string | null; found_at: string | null; location_text: string; photo_path: string | null;
  status: string; created_by: string; created_at: string;
};
export type OwnClaim = { id: string; report_id: string; claimant_id: string; private_details: string; status: string; created_at: string };
export type VisibleLead = { id: string; report_id: string; submitted_by: string; message: string; sighting_location: string | null; created_at: string };
export type OwnDataExport = {
  exported_at: string; profile: Record<string, unknown> | null; settings: AccountSettings | null;
  reports: OwnReport[]; claims: OwnClaim[]; leads: VisibleLead[]; notifications: FoundItNotification[]; account_requests: AccountRequest[];
};

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const invalid = (type: string): never => { throw new Error(`Invalid ${type} returned by Supabase.`); };
function row(value: unknown, type: string): JsonObject { if (!isObject(value)) return invalid(type); return value; }
function requiredString(r: JsonObject, key: string, type: string): string { const v = r[key]; if (!isString(v) || v.length === 0) return invalid(type); return v; }
function requiredBoolean(r: JsonObject, key: string, type: string): boolean { const v = r[key]; if (typeof v !== 'boolean') return invalid(type); return v; }
function nullableString(r: JsonObject, key: string, type: string): string | null { const v = r[key]; if (!isNullableString(v)) return invalid(type); return v; }
function isRole(value: unknown): value is SchoolRole { return value === 'student' || value === 'teacher' || value === 'moderator' || value === 'admin'; }
function isDateString(value: unknown): value is string { return isString(value) && Number.isFinite(Date.parse(value)); }
function requireClient() { if (!supabase) throw new Error('Supabase is not configured.'); return supabase; }
function parseRows<T>(value: unknown, parser: (row: unknown) => T, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label} returned by Supabase.`);
  return value.map(parser);
}

export function normalizeAccountSettingsInput(input: Omit<AccountSettings, 'display_name'> & { display_name: string }): {
  display_name: string; language: 'en' | 'th'; notify_report_updates: boolean; notify_claim_lead_updates: boolean;
} {
  if (!isObject(input) || !isString(input.display_name)) throw new Error('Invalid account settings input.');
  const displayName = input.display_name.trim();
  if (!displayName || displayName.length > 120 || /[\u0000-\u001f\u007f]/.test(displayName)) throw new Error('Display name must be between 1 and 120 characters.');
  if (input.language !== 'en' && input.language !== 'th') throw new Error('Invalid language.');
  if (typeof input.notify_report_updates !== 'boolean' || typeof input.notify_claim_updates !== 'boolean') throw new Error('Invalid notification preferences.');
  return { display_name: displayName, language: input.language, notify_report_updates: input.notify_report_updates, notify_claim_lead_updates: input.notify_claim_updates };
}

const DOMAIN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
export function normalizeApprovedDomain(value: string): string {
  if (!isString(value)) throw new Error('Invalid approved email domain.');
  const domain = value.trim().toLowerCase();
  if (domain.length > 253 || !DOMAIN.test(domain) || domain.split('.').some((label) => label.length > 63)) throw new Error('Invalid approved email domain.');
  return domain;
}

export function parseAccountSettings(value: unknown): AccountSettings {
  const r = row(value, 'account settings');
  if (!isString(r.display_name) && r.display_name !== undefined) return invalid('account settings');
  if ((r.language !== 'en' && r.language !== 'th') || typeof r.notify_report_updates !== 'boolean' || typeof r.notify_claim_lead_updates !== 'boolean') return invalid('account settings');
  return { display_name: isString(r.display_name) ? r.display_name : '', language: r.language, notify_report_updates: r.notify_report_updates, notify_claim_updates: r.notify_claim_lead_updates };
}
export function parseFoundItNotification(value: unknown): FoundItNotification {
  const r = row(value, 'notification');
  if ((r.category !== 'report_review' && r.category !== 'claim_lead') || !['report_status', 'claim_status', 'new_lead'].includes(String(r.event_type)) || !isDateString(r.created_at) || !isNullableString(r.read_at)) return invalid('notification');
  return { id: requiredString(r, 'id', 'notification'), category: r.category, event_type: r.event_type as FoundItNotification['event_type'], report_id: requiredString(r, 'report_id', 'notification'), created_at: r.created_at, read_at: r.read_at };
}
export function parseAccountRequest(value: unknown): AccountRequest {
  const r = row(value, 'account request');
  if (!['open', 'received', 'in_progress', 'completed'].includes(String(r.status)) || !isDateString(r.created_at) || !isDateString(r.updated_at)) return invalid('account request');
  return { id: requiredString(r, 'id', 'account request'), user_id: requiredString(r, 'user_id', 'account request'), school_id: requiredString(r, 'school_id', 'account request'), status: r.status as AccountRequestStatus, created_at: r.created_at, updated_at: r.updated_at };
}
export function parseSchoolMember(value: unknown): SchoolMember {
  const r = row(value, 'school member');
  if (!isRole(r.role)) return invalid('school member');
  return { id: requiredString(r, 'id', 'school member'), school_id: requiredString(r, 'school_id', 'school member'), display_name: requiredString(r, 'display_name', 'school member'), email: requiredString(r, 'email', 'school member'), role: r.role };
}
export function parseApprovedDomain(value: unknown): ApprovedDomain {
  const r = row(value, 'approved domain');
  const domain = requiredString(r, 'domain', 'approved domain');
  if (normalizeApprovedDomain(domain) !== domain || !isDateString(r.created_at)) return invalid('approved domain');
  return { id: requiredString(r, 'id', 'approved domain'), school_id: requiredString(r, 'school_id', 'approved domain'), domain, created_at: r.created_at };
}
export function parseReviewSettings(value: unknown): ReviewSettings {
  const r = row(value, 'review settings');
  if (typeof r.missing_requires_review !== 'boolean' || typeof r.found_requires_review !== 'boolean') return invalid('review settings');
  return { missing_reports_need_review: r.missing_requires_review, found_reports_need_review: r.found_requires_review };
}
export function parseStorageLocation(value: unknown): StorageLocation {
  const r = row(value, 'storage location');
  return { id: requiredString(r, 'id', 'storage location'), school_id: requiredString(r, 'school_id', 'storage location'), label: requiredString(r, 'label', 'storage location'), responsible_name: requiredString(r, 'responsible_name', 'storage location') };
}
export function parseOwnReport(value: unknown): OwnReport {
  const r = row(value, 'own report');
  if ((r.report_type !== 'missing' && r.report_type !== 'found') || !isNullableString(r.last_seen_at) || !isNullableString(r.found_at) || !isNullableString(r.photo_path) || !isDateString(r.created_at)) return invalid('own report');
  return { id: requiredString(r, 'id', 'own report'), report_type: r.report_type, title: requiredString(r, 'title', 'own report'), category: requiredString(r, 'category', 'own report'), description: requiredString(r, 'description', 'own report'), last_seen_at: r.last_seen_at, found_at: r.found_at, location_text: requiredString(r, 'location_text', 'own report'), photo_path: r.photo_path, status: requiredString(r, 'status', 'own report'), created_by: requiredString(r, 'created_by', 'own report'), created_at: r.created_at };
}
export function parseOwnClaim(value: unknown): OwnClaim {
  const r = row(value, 'own claim');
  if (!isDateString(r.created_at)) return invalid('own claim');
  return { id: requiredString(r, 'id', 'own claim'), report_id: requiredString(r, 'report_id', 'own claim'), claimant_id: requiredString(r, 'claimant_id', 'own claim'), private_details: requiredString(r, 'private_details', 'own claim'), status: requiredString(r, 'status', 'own claim'), created_at: r.created_at };
}
export function parseVisibleLead(value: unknown): VisibleLead {
  const r = row(value, 'lead');
  if (!isNullableString(r.sighting_location) || !isDateString(r.created_at)) return invalid('lead');
  return { id: requiredString(r, 'id', 'lead'), report_id: requiredString(r, 'report_id', 'lead'), submitted_by: requiredString(r, 'submitted_by', 'lead'), message: requiredString(r, 'message', 'lead'), sighting_location: r.sighting_location, created_at: r.created_at };
}
function parseProfile(value: unknown): Record<string, unknown> {
  const r = row(value, 'profile');
  for (const key of ['id', 'display_name', 'email', 'school_id', 'role']) if (!isString(r[key])) return invalid('profile');
  if (!isRole(r.role)) return invalid('profile');
  return { id: r.id, display_name: r.display_name, email: r.email, school_id: r.school_id, role: r.role };
}
function checked<T>(result: { data: T; error: unknown }): T { if (result.error) throw result.error; return result.data; }
const ACCOUNT_SETTINGS_COLUMNS = 'user_id, language, notify_report_updates, notify_claim_lead_updates, updated_at';
const NOTIFICATION_COLUMNS = 'id, category, event_type, report_id, created_at, read_at';
const REQUEST_COLUMNS = 'id, user_id, school_id, status, created_at, updated_at';
const REPORT_COLUMNS = 'id, report_type, title, category, description, last_seen_at, found_at, location_text, photo_path, status, created_by, created_at';
const CLAIM_COLUMNS = 'id, report_id, claimant_id, private_details, status, created_at';
const LEAD_COLUMNS = 'id, report_id, submitted_by, message, sighting_location, created_at';

export async function fetchOwnAccountSettings(userId: string): Promise<AccountSettings> {
  const client = requireClient();
  const [settingsResult, profileResult] = await Promise.all([
    client.from('user_settings').select(ACCOUNT_SETTINGS_COLUMNS).eq('user_id', userId).single(),
    client.from('profiles').select('id, display_name').eq('id', userId).single(),
  ]);
  const settingsValue: unknown = checked(settingsResult);
  const profileValue: unknown = checked(profileResult);
  const settings = parseAccountSettings(settingsValue);
  if (requiredString(row(settingsValue, 'account settings'), 'user_id', 'account settings') !== userId) return invalid('account settings');
  const profile = row(profileValue, 'profile');
  if (requiredString(profile, 'id', 'profile') !== userId) return invalid('profile');
  return { ...settings, display_name: requiredString(profile, 'display_name', 'profile') };
}
export async function updateOwnAccountSettings(userId: string, input: Omit<AccountSettings, 'display_name'> & { display_name: string }): Promise<AccountSettings> {
  const values = normalizeAccountSettingsInput(input);
  const client = requireClient();
  const { error: profileError } = await client.from('profiles').update({ display_name: values.display_name }).eq('id', userId);
  if (profileError) throw profileError;
  const { data, error } = await client.from('user_settings').update({ language: values.language, notify_report_updates: values.notify_report_updates, notify_claim_lead_updates: values.notify_claim_lead_updates }).eq('user_id', userId).select(ACCOUNT_SETTINGS_COLUMNS).single();
  const value: unknown = checked({ data, error });
  const parsed = parseAccountSettings(value);
  if (requiredString(row(value, 'account settings'), 'user_id', 'account settings') !== userId) return invalid('account settings');
  return { ...parsed, display_name: values.display_name };
}
export async function fetchOwnNotifications(userId: string): Promise<FoundItNotification[]> {
  const { data, error } = await requireClient().from('foundit_notifications').select(NOTIFICATION_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
  return parseRows(checked({ data, error }), parseFoundItNotification, 'notifications');
}
export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const { error } = await requireClient().from('foundit_notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId).eq('user_id', userId);
  if (error) throw error;
}
export async function fetchOwnReports(userId: string): Promise<OwnReport[]> {
  const { data, error } = await requireClient().from('reports').select(REPORT_COLUMNS).eq('created_by', userId).order('created_at', { ascending: false }).limit(200);
  const reports = parseRows(checked({ data, error }), parseOwnReport, 'own reports');
  if (reports.some((report) => report.created_by !== userId)) return invalid('own reports');
  return reports;
}
export async function fetchOwnClaims(userId: string): Promise<OwnClaim[]> {
  const { data, error } = await requireClient().from('claims').select(CLAIM_COLUMNS).eq('claimant_id', userId).order('created_at', { ascending: false }).limit(100);
  const claims = parseRows(checked({ data, error }), parseOwnClaim, 'own claims');
  if (claims.some((claim) => claim.claimant_id !== userId)) return invalid('own claims');
  return claims;
}
export async function fetchVisibleLeads(): Promise<VisibleLead[]> {
  const { data, error } = await requireClient().from('report_leads').select(LEAD_COLUMNS).order('created_at', { ascending: false }).limit(100);
  return parseRows(checked({ data, error }), parseVisibleLead, 'leads');
}
export function buildOwnDataExport(input: Omit<OwnDataExport, 'exported_at'>): OwnDataExport {
  return { exported_at: new Date().toISOString(), profile: input.profile, settings: input.settings, reports: input.reports, claims: input.claims, leads: input.leads, notifications: input.notifications, account_requests: input.account_requests };
}
export async function fetchOwnDataExport(userId: string): Promise<OwnDataExport> {
  const client = requireClient();
  const [profileResult, settingsResult, reportsResult, claimsResult, leadsResult, notificationsResult, requestsResult] = await Promise.all([
    client.from('profiles').select('id, display_name, email, school_id, role').eq('id', userId).maybeSingle(),
    client.from('user_settings').select(ACCOUNT_SETTINGS_COLUMNS).eq('user_id', userId).maybeSingle(),
    client.from('reports').select(REPORT_COLUMNS).eq('created_by', userId).order('created_at', { ascending: false }).limit(200),
    client.from('claims').select(CLAIM_COLUMNS).eq('claimant_id', userId).order('created_at', { ascending: false }).limit(100),
    client.from('report_leads').select(LEAD_COLUMNS).order('created_at', { ascending: false }).limit(100),
    client.from('foundit_notifications').select(NOTIFICATION_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    client.from('user_account_requests').select(REQUEST_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
  ]);
  const profileValue: unknown = checked(profileResult); const settingsValue: unknown = checked(settingsResult);
  const profile = profileValue === null ? null : parseProfile(profileValue);
  if (profile && profile.id !== userId) return invalid('profile');
  const parsedSettings = settingsValue === null ? null : parseAccountSettings(settingsValue);
  const settings = parsedSettings && profile ? { ...parsedSettings, display_name: String(profile.display_name) } : parsedSettings;
  const reports = parseRows(checked(reportsResult), parseOwnReport, 'own reports');
  const claims = parseRows(checked(claimsResult), parseOwnClaim, 'own claims');
  const account_requests = parseRows(checked(requestsResult), parseAccountRequest, 'account requests');
  if (reports.some((report) => report.created_by !== userId) || claims.some((claim) => claim.claimant_id !== userId) || account_requests.some((request) => request.user_id !== userId)) return invalid('own export');
  return buildOwnDataExport({ profile, settings, reports, claims, leads: parseRows(checked(leadsResult), parseVisibleLead, 'leads'), notifications: parseRows(checked(notificationsResult), parseFoundItNotification, 'notifications'), account_requests });
}
export async function fetchOwnAccountRequests(userId: string): Promise<AccountRequest[]> {
  const { data, error } = await requireClient().from('user_account_requests').select(REQUEST_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(100);
  const requests = parseRows(checked({ data, error }), parseAccountRequest, 'account requests');
  if (requests.some((request) => request.user_id !== userId)) return invalid('account requests');
  return requests;
}
export async function submitDeletionRequest(userId: string, schoolId: string): Promise<AccountRequest> {
  const { data, error } = await requireClient().from('user_account_requests').insert({ user_id: userId, school_id: schoolId, status: 'open' }).select(REQUEST_COLUMNS).single();
  const parsed = parseAccountRequest(checked({ data, error }));
  if (parsed.user_id !== userId || parsed.school_id !== schoolId || parsed.status !== 'open') throw new Error('Invalid account request returned by Supabase.');
  return parsed;
}
export async function fetchSchoolMembers(schoolId: string): Promise<SchoolMember[]> {
  const { data, error } = await requireClient().from('profiles').select('id, school_id, display_name, email, role').eq('school_id', schoolId).order('display_name').limit(200);
  const members = parseRows(checked({ data, error }), parseSchoolMember, 'school members');
  if (members.some((member) => member.school_id !== schoolId)) return invalid('school members');
  return members;
}
export async function changeSchoolMemberRole(targetUserId: string, role: SchoolRole): Promise<void> {
  if (!isRole(role)) throw new Error('Invalid school role.');
  const { error } = await requireClient().rpc('change_school_member_role', { p_target_user_id: targetUserId, p_new_role: role });
  if (error) throw error;
}
export async function fetchApprovedDomains(schoolId: string): Promise<ApprovedDomain[]> {
  const { data, error } = await requireClient().from('school_allowed_domains').select('id, school_id, domain, created_at').eq('school_id', schoolId).order('domain').limit(100);
  const domains = parseRows(checked({ data, error }), parseApprovedDomain, 'approved domains');
  if (domains.some((domain) => domain.school_id !== schoolId)) return invalid('approved domains');
  return domains;
}
export async function addApprovedDomain(schoolId: string, input: string): Promise<ApprovedDomain> {
  const domain = normalizeApprovedDomain(input);
  const { data, error } = await requireClient().from('school_allowed_domains').insert({ school_id: schoolId, domain }).select('id, school_id, domain, created_at').single();
  const parsed = parseApprovedDomain(checked({ data, error }));
  if (parsed.school_id !== schoolId || parsed.domain !== domain) throw new Error('Invalid approved domain returned by Supabase.');
  return parsed;
}
export async function removeApprovedDomain(schoolId: string, domainId: string): Promise<void> {
  const { error } = await requireClient().from('school_allowed_domains').delete().eq('school_id', schoolId).eq('id', domainId);
  if (error) throw error;
}
export async function fetchStorageLocations(schoolId: string): Promise<StorageLocation[]> {
  const { data, error } = await requireClient().from('storage_locations').select('id, school_id, label, responsible_name').eq('school_id', schoolId).order('label').limit(100);
  const locations = parseRows(checked({ data, error }), parseStorageLocation, 'storage locations');
  if (locations.some((location) => location.school_id !== schoolId)) return invalid('storage locations');
  return locations;
}
function normalizeLocation(input: { label: string; responsible_name: string }): { label: string; responsible_name: string } {
  const label = input.label.trim(); const responsible_name = input.responsible_name.trim();
  if (!label || label.length > 120 || !responsible_name || responsible_name.length > 120) throw new Error('Invalid storage location.');
  return { label, responsible_name };
}
export async function createStorageLocation(schoolId: string, input: { label: string; responsible_name: string }): Promise<StorageLocation> {
  const { data, error } = await requireClient().from('storage_locations').insert({ school_id: schoolId, ...normalizeLocation(input) }).select('id, school_id, label, responsible_name').single();
  const parsed = parseStorageLocation(checked({ data, error }));
  if (parsed.school_id !== schoolId) throw new Error('Invalid storage location returned by Supabase.');
  return parsed;
}
export async function updateStorageLocation(schoolId: string, locationId: string, input: { label: string; responsible_name: string }): Promise<StorageLocation> {
  const { data, error } = await requireClient().from('storage_locations').update(normalizeLocation(input)).eq('school_id', schoolId).eq('id', locationId).select('id, school_id, label, responsible_name').single();
  const parsed = parseStorageLocation(checked({ data, error }));
  if (parsed.school_id !== schoolId || parsed.id !== locationId) throw new Error('Invalid storage location returned by Supabase.');
  return parsed;
}
export async function removeStorageLocation(schoolId: string, locationId: string): Promise<void> {
  const { error } = await requireClient().from('storage_locations').delete().eq('school_id', schoolId).eq('id', locationId);
  if (error) throw error;
}
export async function fetchReviewSettings(schoolId: string): Promise<ReviewSettings> {
  const { data, error } = await requireClient().from('school_review_settings').select('school_id, missing_requires_review, found_requires_review').eq('school_id', schoolId).single();
  const value: unknown = checked({ data, error });
  const r = row(value, 'review settings');
  if (requiredString(r, 'school_id', 'review settings') !== schoolId) return invalid('review settings');
  return parseReviewSettings(value);
}
export async function updateReviewSettings(schoolId: string, settings: ReviewSettings): Promise<ReviewSettings> {
  if (typeof settings.missing_reports_need_review !== 'boolean' || typeof settings.found_reports_need_review !== 'boolean') throw new Error('Invalid review settings input.');
  const { data, error } = await requireClient().from('school_review_settings').update({ missing_requires_review: settings.missing_reports_need_review, found_requires_review: settings.found_reports_need_review }).eq('school_id', schoolId).select('school_id, missing_requires_review, found_requires_review').single();
  const value: unknown = checked({ data, error });
  const r = row(value, 'review settings');
  if (requiredString(r, 'school_id', 'review settings') !== schoolId) return invalid('review settings');
  return parseReviewSettings(value);
}
export async function updateAccountRequestStatus(schoolId: string, requestId: string, status: Exclude<AccountRequestStatus, 'open'>): Promise<AccountRequest> {
  if (status !== 'received' && status !== 'in_progress' && status !== 'completed') throw new Error('Invalid account request status.');
  const { data, error } = await requireClient().from('user_account_requests').update({ status, updated_at: new Date().toISOString() }).eq('school_id', schoolId).eq('id', requestId).select(REQUEST_COLUMNS).single();
  const parsed = parseAccountRequest(checked({ data, error }));
  if (parsed.school_id !== schoolId || parsed.id !== requestId || parsed.status !== status) throw new Error('Invalid account request returned by Supabase.');
  return parsed;
}
export async function fetchSchoolAccountRequests(schoolId: string): Promise<AccountRequest[]> {
  const { data, error } = await requireClient().from('user_account_requests').select(REQUEST_COLUMNS).eq('school_id', schoolId).order('created_at', { ascending: false }).limit(100);
  return parseRows(checked({ data, error }), parseAccountRequest, 'account requests');
}
