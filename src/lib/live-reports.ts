import type { Report } from './reports';
import { supabase } from './supabase';

type SupabaseReportRow = {
  id: string;
  report_type: Report['type'];
  title: string;
  category: string;
  description: string;
  last_seen_at: string | null;
  found_at: string | null;
  location_text: string;
  status: Report['status'];
  created_by: string;
  created_at: string;
  storage_locations: { label: string; responsible_name: string } | { label: string; responsible_name: string }[] | null;
};

const cardColors = ['#d8c7f1', '#bfe5d6', '#ffd5a7', '#c6d7ed', '#f3b6aa', '#f6d99b', '#c4e3aa'];

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

export function mapSupabaseReport(row: SupabaseReportRow): Report {
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
    createdBy: 'Phichai School member',
    initials: initialsFromId(row.created_by),
    color: colorFromId(row.id),
    hasPhoto: false,
  };
}

export async function fetchLiveReports() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reports')
    .select('id, report_type, title, category, description, last_seen_at, found_at, location_text, status, created_by, created_at, storage_locations(label, responsible_name)')
    .in('status', ['approved', 'claimed'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => mapSupabaseReport(row as unknown as SupabaseReportRow));
}
