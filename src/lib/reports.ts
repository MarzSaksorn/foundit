export type ReportType = 'missing' | 'found';
export type ReportStatus = 'pending' | 'approved' | 'claimed' | 'returned' | 'rejected' | 'archived';

export type Report = {
  id: string;
  type: ReportType;
  title: string;
  category: string;
  description: string;
  dateLabel: string;
  location: string;
  storageLocation?: string;
  responsiblePerson?: string;
  status: ReportStatus;
  ageDays: number;
  createdLabel: string;
  createdBy: string;
  createdById?: string;
  initials: string;
  color: string;
  hasPhoto?: boolean;
  photoPath?: string;
  claimCount?: number;
};

export type ReportFilters = {
  query: string;
  type: 'all' | ReportType;
  category: 'all' | string;
  location: 'all' | string;
  status: 'all' | ReportStatus;
  date: 'all' | 'week' | 'older';
};

export const categories = ['All categories', 'Clothing', 'Electronics', 'Keys & cards', 'School supplies', 'Sports', 'Other'];
export const locations = ['All locations', 'Main hallway', 'Library', 'Gym', 'Science wing', 'Cafeteria', 'Courtyard', 'Arts building'];

export const initialReports: Report[] = [
  {
    id: 'r-1042',
    type: 'found',
    title: 'Navy blue backpack',
    category: 'Clothing',
    description: 'Canvas backpack with a stitched yellow star on the front pocket. A math workbook is inside.',
    dateLabel: 'Found yesterday',
    location: 'Main hallway',
    storageLocation: 'Front office shelf A',
    responsiblePerson: 'School admin',
    status: 'approved',
    ageDays: 1,
    createdLabel: 'Nov 8, 2026',
    createdBy: 'A. Chen',
    initials: 'AC',
    color: '#d8c7f1',
    hasPhoto: true,
    claimCount: 1,
  },
  {
    id: 'r-1038',
    type: 'missing',
    title: 'Silver water bottle',
    category: 'Sports',
    description: 'Tall silver bottle with a green mountain sticker near the base. Name may be written underneath.',
    dateLabel: 'Last seen Nov 7',
    location: 'Gym',
    status: 'approved',
    ageDays: 2,
    createdLabel: 'Nov 7, 2026',
    createdBy: 'Jordan M.',
    initials: 'JM',
    color: '#bfe5d6',
  },
  {
    id: 'r-1035',
    type: 'found',
    title: 'Set of three keys',
    category: 'Keys & cards',
    description: 'Three keys on a red fabric loop. One key has a small round tag with the number 12.',
    dateLabel: 'Found Nov 6',
    location: 'Library',
    storageLocation: 'Library desk',
    responsiblePerson: 'Librarian',
    status: 'approved',
    ageDays: 3,
    createdLabel: 'Nov 6, 2026',
    createdBy: 'M. Okafor',
    initials: 'MO',
    color: '#ffd5a7',
    claimCount: 2,
  },
  {
    id: 'r-1031',
    type: 'missing',
    title: 'Black wired headphones',
    category: 'Electronics',
    description: 'Over-ear headphones with a short green cord wrap. Small scuff on the left ear cup.',
    dateLabel: 'Last seen Nov 5',
    location: 'Science wing',
    status: 'approved',
    ageDays: 4,
    createdLabel: 'Nov 5, 2026',
    createdBy: 'Priya S.',
    initials: 'PS',
    color: '#c6d7ed',
  },
  {
    id: 'r-1026',
    type: 'found',
    title: 'Red knitted scarf',
    category: 'Clothing',
    description: 'Soft red scarf with two thin white stripes at both ends.',
    dateLabel: 'Found Nov 4',
    location: 'Courtyard',
    storageLocation: 'Front office shelf A',
    responsiblePerson: 'School admin',
    status: 'approved',
    ageDays: 5,
    createdLabel: 'Nov 4, 2026',
    createdBy: 'E. Williams',
    initials: 'EW',
    color: '#f3b6aa',
  },
  {
    id: 'r-1021',
    type: 'missing',
    title: 'Blue sketchbook',
    category: 'School supplies',
    description: 'A5 sketchbook with a blue cover and a white label on the back. Pages contain pencil studies.',
    dateLabel: 'Last seen Nov 3',
    location: 'Arts building',
    status: 'approved',
    ageDays: 6,
    createdLabel: 'Nov 3, 2026',
    createdBy: 'Noah T.',
    initials: 'NT',
    color: '#f6d99b',
  },
  {
    id: 'r-1018',
    type: 'found',
    title: 'Green lunch container',
    category: 'Other',
    description: 'Rectangular green container with a small white leaf on the lid. Clean and closed.',
    dateLabel: 'Found Nov 2',
    location: 'Cafeteria',
    storageLocation: 'Gym office',
    responsiblePerson: 'PE teacher',
    status: 'claimed',
    ageDays: 7,
    createdLabel: 'Nov 2, 2026',
    createdBy: 'Staff desk',
    initials: 'SD',
    color: '#c4e3aa',
    claimCount: 1,
  },
  {
    id: 'r-1014',
    type: 'missing',
    title: 'Silver ring',
    category: 'Other',
    description: 'Small silver band with a smooth finish. Please share a private identifying detail when claiming.',
    dateLabel: 'Last seen Nov 1',
    location: 'Main hallway',
    status: 'pending',
    ageDays: 8,
    createdLabel: 'Nov 1, 2026',
    createdBy: 'Taylor K.',
    initials: 'TK',
    color: '#d4d4d4',
  },
];

export const statusLabel: Record<ReportStatus, string> = {
  pending: 'Pending review',
  approved: 'Live on board',
  claimed: 'Claim approved',
  returned: 'Returned',
  rejected: 'Rejected',
  archived: 'Archived',
};

export const getReportById = (reports: Report[], id: string) => reports.find((report) => report.id === id);

export function filterReports(reports: Report[], filters: ReportFilters) {
  const query = filters.query.trim().toLowerCase();
  return reports.filter((report) => {
    const matchesQuery = !query || `${report.title} ${report.description}`.toLowerCase().includes(query);
    const matchesType = filters.type === 'all' || report.type === filters.type;
    const matchesCategory = filters.category === 'all' || report.category === filters.category;
    const matchesLocation = filters.location === 'all' || report.location === filters.location;
    const matchesStatus = filters.status === 'all' || report.status === filters.status;
    const matchesDate = filters.date === 'all' || (filters.date === 'week' ? report.ageDays <= 7 : report.ageDays > 7);
    return matchesQuery && matchesType && matchesCategory && matchesLocation && matchesStatus && matchesDate;
  });
}

export type ReportRepository = {
  list(filters: ReportFilters): Promise<Report[]>;
  create(input: Partial<Report>): Promise<Report>;
  update(id: string, patch: Partial<Report>): Promise<Report>;
};

// Replace this adapter with Supabase queries once Auth, Postgres, Storage, and RLS are connected.
export const seededReportRepository: ReportRepository = {
  async list(filters) {
    return filterReports(initialReports, filters);
  },
  async create(input) {
    return { ...initialReports[0], ...input, id: `r-${Date.now()}` } as Report;
  },
  async update(id, patch) {
    return { ...(getReportById(initialReports, id) as Report), ...patch };
  },
};
