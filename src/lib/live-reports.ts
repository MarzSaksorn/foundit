import type { User } from '@supabase/supabase-js';
import type { Report, ReportStatus, ReportType } from './reports';
import { supabase } from './supabase';

export type FoundItRole = 'student' | 'teacher' | 'moderator' | 'admin';

export type FoundItProfile = {
  id: string;
  school_id: string;
  role: FoundItRole;
};

export type StorageLocation = {
  id: string;
  label: string;
  responsible_name: string;
};

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'needs_more_information';

export type OwnClaim = {
  id: string;
  report_id: string;
  status: ClaimStatus;
  created_at: string;
};

export type TeacherClaim = OwnClaim & {
  claimant_id: string;
  private_details: string;
};

export type ModerationEvent = {
  id: string;
  actor_id: string;
  action: string;
  notes: string | null;
  created_at: string;
};

export type NewReportInput = {
  type: ReportType;
  title: string;
  category: string;
  description: string;
  date: string;
  location: string;
  storageLocationId?: string;
  photo?: File | null;
};

type SupabaseReportRow = {
  id: string;
  report_type: ReportType;
  title: string;
  category: string;
  description: string;
  last_seen_at: string | null;
  found_at: string | null;
  location_text: string;
  photo_path: string | null;
  status: ReportStatus;
  created_by: string;
  created_at: string;
  storage_locations: { label: string; responsible_name: string } | { label: string; responsible_name: string }[] | null;
};

const cardColors = ['#d8c7f1', '#bfe5d6', '#ffd5a7', '#c6d7ed', '#f3b6aa', '#f6d99b', '#c4e3aa'];
const SCHOOL_DOMAIN = 'phichai.ac.th';
const PHOTO_BUCKET = 'foundit-photos';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function ageInDays(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function initialsFromId(id: string) {
  return id.replace(/-/g, '').slice(0, 2).toUpperCase();
}

function colorFromId(id: string) {
  const checksum = id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return cardColors[checksum % cardColors.length];
}

export function mapSupabaseReport(row: SupabaseReportRow, userId?: string): Report {
  const date = row.report_type === 'found' ? row.found_at : row.last_seen_at;
  const ageDays = date ? ageInDays(date) : 0;
  const storageLocation = Array.isArray(row.storage_locations) ? row.storage_locations[0] : row.storage_locations;
  return {
    id: row.id,
    type: row.report_type,
    title: row.title,
    category: row.category,
    description: row.description,
    dateLabel: row.report_type === 'found' ? `Found ${formatDate(date || row.created_at)}` : `Last seen ${formatDate(date || row.created_at)}`,
    location: row.location_text,
    storageLocation: storageLocation?.label,
    responsiblePerson: storageLocation?.responsible_name,
    status: row.status,
    ageDays,
    createdLabel: formatDate(row.created_at),
    createdBy: userId && row.created_by === userId ? 'You' : 'Phichai School member',
    createdById: row.created_by,
    initials: initialsFromId(row.created_by),
    color: colorFromId(row.id),
    hasPhoto: Boolean(row.photo_path),
    photoPath: row.photo_path || undefined,
  };
}

export async function fetchCurrentProfile(userId: string): Promise<FoundItProfile | null> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('id, school_id, role')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as FoundItProfile | null;
}

export async function fetchStorageLocations(): Promise<StorageLocation[]> {
  const client = requireSupabase();
  const { data: school, error: schoolError } = await client
    .from('schools')
    .select('id')
    .eq('allowed_email_domain', SCHOOL_DOMAIN)
    .single();
  if (schoolError) throw schoolError;

  const { data, error } = await client
    .from('storage_locations')
    .select('id, label, responsible_name')
    .eq('school_id', school.id)
    .order('label')
    .limit(100);
  if (error) throw error;
  return (data || []) as StorageLocation[];
}

export async function fetchLiveReports(userId: string): Promise<Report[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('reports')
    .select('id, report_type, title, category, description, last_seen_at, found_at, location_text, photo_path, status, created_by, created_at, storage_locations(label, responsible_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;
  return (data || []).map((row) => mapSupabaseReport(row as unknown as SupabaseReportRow, userId));
}

export async function fetchOwnClaims(userId: string): Promise<OwnClaim[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('claims')
    .select('id, report_id, status, created_at')
    .eq('claimant_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as OwnClaim[];
}

export async function fetchTeacherClaims(): Promise<TeacherClaim[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('claims')
    .select('id, report_id, claimant_id, private_details, status, created_at')
    .in('status', ['pending', 'needs_more_information'])
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data || []) as TeacherClaim[];
}

export async function fetchModerationHistory(reportId: string): Promise<ModerationEvent[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('moderation_events')
    .select('id, actor_id, action, notes, created_at')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as ModerationEvent[];
}

export async function createReport(user: User, input: NewReportInput): Promise<Report> {
  const client = requireSupabase();
  const { data: school, error: schoolError } = await client
    .from('schools')
    .select('id')
    .eq('allowed_email_domain', SCHOOL_DOMAIN)
    .single();
  if (schoolError) throw schoolError;

  let photoPath: string | null = null;
  if (input.photo) {
    if (!['image/jpeg', 'image/png'].includes(input.photo.type) || input.photo.size > 5 * 1024 * 1024) {
      throw new Error('Choose a JPG or PNG image up to 5 MB.');
    }
    const extension = input.photo.type === 'image/png' ? 'png' : 'jpg';
    photoPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage
      .from(PHOTO_BUCKET)
      .upload(photoPath, input.photo, { contentType: input.photo.type, cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;
  }

  const date = new Date(`${input.date}T12:00:00+07:00`).toISOString();
  const row = {
    school_id: school.id,
    report_type: input.type,
    title: input.title.trim(),
    category: input.category,
    description: input.description.trim(),
    photo_path: photoPath,
    last_seen_at: input.type === 'missing' ? date : null,
    found_at: input.type === 'found' ? date : null,
    location_text: input.location,
    storage_location_id: input.type === 'found' ? input.storageLocationId || null : null,
    status: input.type === 'missing' ? 'approved' : 'pending',
    created_by: user.id,
  };

  const { data, error } = await client
    .from('reports')
    .insert(row)
    .select('id, report_type, title, category, description, last_seen_at, found_at, location_text, photo_path, status, created_by, created_at, storage_locations(label, responsible_name)')
    .single();
  if (error) {
    if (photoPath) await client.storage.from(PHOTO_BUCKET).remove([photoPath]);
    throw error;
  }
  return mapSupabaseReport(data as unknown as SupabaseReportRow, user.id);
}

export async function createClaim(userId: string, reportId: string, privateDetails: string): Promise<OwnClaim> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('claims')
    .insert({ report_id: reportId, claimant_id: userId, private_details: privateDetails.trim() })
    .select('id, report_id, status, created_at')
    .single();
  if (error) throw error;
  return data as OwnClaim;
}

export async function moderateReport(reportId: string, status: Extract<ReportStatus, 'approved' | 'rejected' | 'returned' | 'archived'>, notes?: string) {
  const client = requireSupabase();
  const { error } = await client.rpc('moderate_foundit_report', {
    p_report_id: reportId,
    p_status: status,
    p_notes: notes || null,
  });
  if (error) throw error;
}

export async function reviewClaim(claimId: string, status: Extract<ClaimStatus, 'approved' | 'rejected' | 'needs_more_information'>, notes?: string) {
  const client = requireSupabase();
  const { error } = await client.rpc('review_foundit_claim', {
    p_claim_id: claimId,
    p_status: status,
    p_notes: notes || null,
  });
  if (error) throw error;
}
