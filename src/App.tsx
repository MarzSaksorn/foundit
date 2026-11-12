import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { Button, Card, Description, FieldError, Form, Input, Label, ListBox, Modal, Select, TextArea, TextField } from '@heroui/react';
import {
  categories,
  filterReports,
  getReportById,
  initialReports,
  locations,
  statusLabel,
  type Report,
  type ReportStatus,
  type ReportType,
} from './lib/reports';
import { PHICHAI_DOMAIN, PHICHAI_SCHOOL, signInWithGoogle, validateSchoolUser } from './lib/auth';
import {
  createClaim,
  createReport,
  fetchCurrentProfile,
  fetchLiveReports,
  fetchModerationHistory,
  fetchOwnClaims,
  fetchStorageLocations,
  fetchTeacherClaims,
  moderateReport,
  reviewClaim,
  type FoundItRole,
  type ModerationEvent,
  type NewReportInput,
  type OwnClaim,
  type StorageLocation,
  type TeacherClaim,
} from './lib/live-reports';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { setLanguage, t, useI18n } from './lib/i18n';

type View = 'board' | 'moderation';

function currentLocalDateForInput() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const FUTURE_FOUND_DATE_ERROR = 'Date found cannot be in the future.';

type IconName = 'search' | 'plus' | 'grid' | 'inbox' | 'settings' | 'chevron' | 'arrow' | 'clock' | 'lock' | 'check' | 'close' | 'filter' | 'photo' | 'label';

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  const paths: Record<IconName, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    inbox: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z" /><path d="M4 14h4l1.5 2h5L16 14h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.4 1.4-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L9 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H7v-2h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L8.4 9l1.4-1.4.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h2v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L20 9l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2h-.2a1.7 1.7 0 0 0-1.8 1Z" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
    photo: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m5 17 4-4 3 3 3-5 4 6" /></>,
    label: <><path d="M3.5 5.5h10l7 6.5-7 6.5h-10z" /><circle cx="8" cy="12" r="1" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const typeCopy: Record<ReportType, { label: string; verb: string }> = {
  missing: { label: 'Missing', verb: 'I lost this' },
  found: { label: 'Found', verb: 'I found this' },
};

const statusTone: Record<ReportStatus, string> = {
  pending: 'status-pending',
  approved: 'status-approved',
  claimed: 'status-claimed',
  returned: 'status-returned',
  rejected: 'status-rejected',
  archived: 'status-archived',
};

const demoStorageLocations: StorageLocation[] = [
  { id: 'demo-front-office', label: 'Front office shelf A', responsible_name: 'School admin' },
  { id: 'demo-library-desk', label: 'Library desk', responsible_name: 'Librarian' },
  { id: 'demo-gym-office', label: 'Gym office', responsible_name: 'PE teacher' },
];

function createDemoReport(input: NewReportInput, user: User | undefined, availableLocations: StorageLocation[]): Report {
  const storageLocation = availableLocations.find((item) => item.id === input.storageLocationId);
  return {
    id: `r-${Date.now()}`,
    type: input.type,
    title: input.title.trim(),
    category: input.category,
    description: input.description.trim(),
    dateLabel: `${input.type === 'found' ? 'Found' : 'Last seen'} ${input.date}`,
    location: input.location,
    storageLocation: input.type === 'found' ? storageLocation?.label : undefined,
    responsiblePerson: input.type === 'found' ? storageLocation?.responsible_name : undefined,
    status: input.type === 'missing' ? 'approved' : 'pending',
    ageDays: 0,
    createdLabel: 'Today',
    createdBy: user?.email || 'Signed-in student',
    createdById: user?.id,
    initials: (user?.email || 'PS').slice(0, 2).toUpperCase(),
  };
}

function App() {
  const { language } = useI18n();
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    const syncUser = async (candidate: User | null) => {
      const result = await validateSchoolUser(candidate);
      if (!active) return;
      setUser(result.user);
      setAuthLoading(false);
      if (!result.allowed && candidate) setAuthError(`Use a Google account ending in @${PHICHAI_DOMAIN}.`);
    };

    void supabase.auth.getSession().then(({ data }) => syncUser(data.session?.user ?? null));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { void syncUser(session?.user ?? null); }, 0);
    });
    return () => { active = false; authListener.subscription.unsubscribe(); };
  }, []);

  if (!isSupabaseConfigured) return <AppShell />;
  if (authLoading) return <AuthLoading />;
  if (!user) return <SignInScreen error={authError} />;
  return <AppShell user={user} />;
}

function LanguageToggle({ language }: { language: 'en' | 'th' }) {
  return <div className="language-switch" role="group" aria-label={t('Language')}><button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button><button type="button" aria-pressed={language === 'th'} onClick={() => setLanguage('th')}>ไทย</button></div>;
}

function AuthLoading() {
  const { language } = useI18n();
  return <main className="auth-screen"><div className="auth-card"><LanguageToggle language={language} /><div className="brand-mark">F<span>●</span></div><h1>{t('Checking your school account')}</h1><p>{t('FoundIt is confirming your Phichai School session.')}</p></div></main>;
}

function SignInScreen({ error }: { error: string }) {
  const { language } = useI18n();
  const [signInError, setSignInError] = useState(error);
  const [signingIn, setSigningIn] = useState(false);
  const handleSignIn = async () => {
    setSigningIn(true);
    setSignInError('');
    const { error: oauthError } = await signInWithGoogle();
    if (oauthError) {
      setSignInError(oauthError.message);
      setSigningIn(false);
    }
  };
  return <main className="auth-screen"><div className="auth-card"><LanguageToggle language={language} /><div className="brand-lockup auth-brand"><div className="brand-mark">F<span>●</span></div><div><div className="brand-name">Found<span>It</span></div><div className="brand-school">{PHICHAI_SCHOOL}</div></div></div><div className="eyebrow"><span className="eyebrow-line" />{t('School community')}</div><h1>{t('Find it.')}<br /><em>{t('Bring it home.')}</em></h1><p className="auth-copy">{t('Sign in with your Phichai School Google account to browse reports, share a missing item, or send a private claim.')}</p><button className="button primary full auth-button" onClick={() => void handleSignIn()} disabled={signingIn}>{t(signingIn ? 'Opening Google…' : 'Continue with Google')}</button><p className="auth-domain">{t('Only')} <strong>@{PHICHAI_DOMAIN}</strong> {t('accounts can access FoundIt.')}</p>{signInError && <div className="form-error" role="alert">{signInError}</div>}</div></main>;
}

function AppShell({ user }: { user?: User }) {
  const { language } = useI18n();
  const [view, setView] = useState<View>('board');
  const [reports, setReports] = useState<Report[]>(isSupabaseConfigured ? [] : initialReports);
  const [reportsLoading, setReportsLoading] = useState(isSupabaseConfigured);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileRole, setProfileRole] = useState<FoundItRole | null>(null);
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(isSupabaseConfigured ? [] : demoStorageLocations);
  const [ownClaims, setOwnClaims] = useState<OwnClaim[]>([]);
  const [teacherClaims, setTeacherClaims] = useState<TeacherClaim[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState<ReportType>('missing');
  const [claimOpen, setClaimOpen] = useState(false);
  const [returnConfirm, setReturnConfirm] = useState<Report | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filters, setFilters] = useState({ query: '', type: 'all' as 'all' | ReportType, category: 'all', location: 'all', status: 'all' as 'all' | ReportStatus, date: 'all' as 'all' | 'week' | 'older' });

  const canModerate = !isSupabaseConfigured || ['teacher', 'moderator', 'admin'].includes(profileRole || '');
  const filteredReports = useMemo(() => filterReports(reports, filters).filter((report) => filters.status === 'all' ? ['approved', 'claimed'].includes(report.status) : report.status === filters.status), [reports, filters]);
  const myReports = useMemo(() => reports.filter((report) => user && report.createdById === user.id), [reports, user?.id]);
  const selectedReport = selectedId ? getReportById(reports, selectedId) : undefined;
  const pendingCount = canModerate ? reports.filter((report) => report.status === 'pending').length : 0;
  const claimCount = canModerate ? teacherClaims.length : 0;

  useEffect(() => {
    const match = window.location.pathname.match(/^\/reports\/(.+)$/);
    if (match) setSelectedId(decodeURIComponent(match[1]));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    let active = true;
    setReportsLoading(true);
    setReportsError(null);
    void (async () => {
      const profile = await fetchCurrentProfile(user.id);
      const [nextReports, nextLocations, nextOwnClaims] = await Promise.all([
        fetchLiveReports(user.id),
        fetchStorageLocations(),
        fetchOwnClaims(user.id),
      ]);
      const teacher = Boolean(profile && ['teacher', 'moderator', 'admin'].includes(profile.role));
      const nextTeacherClaims = teacher ? await fetchTeacherClaims() : [];
      if (!active) return;
      setProfileRole(profile?.role || null);
      setReports(nextReports);
      setStorageLocations(nextLocations);
      setOwnClaims(nextOwnClaims);
      setTeacherClaims(nextTeacherClaims);
      if (!teacher) setView('board');
    })()
      .catch(() => { if (active) setReportsError('We couldn’t load the live board. Check your connection and try again.'); })
      .finally(() => { if (active) setReportsLoading(false); });
    return () => { active = false; };
  }, [user?.id, reloadKey]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const decideReport = async (id: string, status: Extract<ReportStatus, 'approved' | 'rejected' | 'returned' | 'archived'>) => {
    try {
      if (isSupabaseConfigured) {
        await moderateReport(id, status);
        setReloadKey((key) => key + 1);
      } else {
        setReports((current) => current.map((report) => report.id === id ? { ...report, status } : report));
      }
      if (status === 'approved') showToast(t('Report approved'));
      if (status === 'rejected') showToast(t('Report rejected'));
    } catch {
      showToast(t('Could not save this moderation decision. Please try again.'));
    }
  };

  const decideClaim = async (claimId: string, status: Extract<TeacherClaim['status'], 'approved' | 'rejected' | 'needs_more_information'>) => {
    try {
      if (!isSupabaseConfigured) return;
      await reviewClaim(claimId, status);
      setReloadKey((key) => key + 1);
      showToast(t(status === 'approved' ? 'Claim approved' : status === 'rejected' ? 'Claim rejected' : 'More information requested'));
    } catch {
      showToast(t('Could not save this moderation decision. Please try again.'));
    }
  };

  const openComposer = (type: ReportType) => {
    setComposerType(type);
    setComposerOpen(true);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand-lockup">
          <div className="brand-mark">F<span>●</span></div>
          <div>
            <div className="brand-name">Found<span>It</span></div>
            <div className="brand-school">Phichai School</div>
          </div>
        </div>

        <div className="sidebar-section-label">{t('Workspace')}</div>
        <nav className="nav-list">
          <button className={`nav-item ${view === 'board' ? 'active' : ''}`} onClick={() => { setView('board'); setSelectedId(null); }}>
            <Icon name="grid" /> <span>{t('Board')}</span><span className="nav-count">{reports.filter((report) => report.status === 'approved').length}</span>
          </button>
          {canModerate && <button className={`nav-item ${view === 'moderation' ? 'active' : ''}`} onClick={() => { setView('moderation'); setSelectedId(null); }}>
            <Icon name="inbox" /> <span>{t('Moderation')}</span><span className="nav-count accent">{pendingCount + claimCount}</span>
          </button>}
        </nav>

        <div className="sidebar-section-label">{t('Shortcuts')}</div>
        <div className="shortcut-list">
          <button onClick={() => openComposer('missing')}><span className="shortcut-dot coral" />{t('Report something missing')}</button>
          <button onClick={() => openComposer('found')}><span className="shortcut-dot mint" />{t('Report something found')}</button>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="sidebar-note-icon"><Icon name="search" size={17} /></div>
            <div><strong>{t('Small leads add up')}</strong><span>{t('Every report helps a classmate.')}</span></div>
          </div>
          <button className="nav-item muted"><Icon name="settings" /><span>{t('School settings')}</span></button>
          <div className="account-row">
            <div className="avatar">{user ? (user.email?.slice(0, 2).toUpperCase() || 'PS') : 'MR'}</div><div className="account-copy"><strong>{user?.user_metadata?.full_name || user?.email || 'Ms. Rivera'}</strong><span>{user ? `Member · ${PHICHAI_SCHOOL}` : 'Teacher · Phichai'}</span></div><button className="more-button" aria-label="Account menu">•••</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Phichai School</span><span className="crumb-slash">/</span><strong>{view === 'board' ? t('Community board') : t('Teacher moderation')}</strong></div>
          <div className="topbar-actions"><LanguageToggle language={language} /><span className="saved-note"><span className="online-dot" />{isSupabaseConfigured ? t('Live Supabase data') : t('Seeded demo data')}</span><button className="help-button">?</button><button className="avatar mini">{user ? (user.email?.slice(0, 2).toUpperCase() || 'PS') : 'MR'}</button></div>
        </header>

        {view === 'board' && !selectedReport && reportsLoading && <BoardLoading />}
        {view === 'board' && !selectedReport && !reportsLoading && reportsError && <BoardError onRetry={() => setReloadKey((key) => key + 1)} />}
        {view === 'board' && !selectedReport && !reportsLoading && !reportsError && <BoardView reports={filteredReports} myReports={myReports} total={reports.filter((report) => ['approved', 'claimed'].includes(report.status)).length} filters={filters} updateFilter={updateFilter} onOpenReport={setSelectedId} onOpenComposer={openComposer} />}
        {view === 'moderation' && canModerate && !selectedReport && <ModerationView reports={reports} claims={teacherClaims} viewerRole={profileRole || 'teacher'} onOpenReport={setSelectedId} onDecideReport={decideReport} onDecideClaim={decideClaim} />}
        {selectedReport && <ReportDetail report={selectedReport} claim={ownClaims.find((claim) => claim.report_id === selectedReport.id)} canModerate={canModerate} onBack={() => setSelectedId(null)} onClaim={() => setClaimOpen(true)} onRequestReturn={() => setReturnConfirm(selectedReport)} showToast={showToast} />}
      </main>

      {composerOpen && <ReportComposer type={composerType} storageLocations={storageLocations} onClose={() => setComposerOpen(false)} onSubmitted={async (input) => {
        const saved = isSupabaseConfigured && user ? await createReport(user, input) : createDemoReport(input, user, storageLocations);
        setReports((current) => [saved, ...current.filter((report) => report.id !== saved.id)]);
        setComposerOpen(false);
        if (isSupabaseConfigured) setReloadKey((key) => key + 1);
        showToast(t(saved.type === 'missing' ? 'Missing report published to the board.' : 'Found report saved. A teacher will review it shortly.'));
      }} />}
      {claimOpen && selectedReport && <ClaimModal report={selectedReport} onClose={() => setClaimOpen(false)} onSubmitted={async (details) => {
        if (isSupabaseConfigured && user) {
          const claim = await createClaim(user.id, selectedReport.id, details);
          setOwnClaims((current) => [claim, ...current.filter((item) => item.id !== claim.id)]);
          setReloadKey((key) => key + 1);
        } else {
          setReports((current) => current.map((report) => report.id === selectedReport.id ? { ...report, claimCount: (report.claimCount || 0) + 1 } : report));
        }
        setClaimOpen(false);
        showToast(t('Claim sent privately to the teacher.'));
      }} />}
      {returnConfirm && <ReturnConfirmModal report={returnConfirm} onClose={() => setReturnConfirm(null)} onConfirm={async () => {
        try {
          if (isSupabaseConfigured) {
            await moderateReport(returnConfirm.id, 'returned');
            setReloadKey((key) => key + 1);
          } else {
            setReports((current) => current.map((report) => report.id === returnConfirm.id ? { ...report, status: 'returned' } : report));
          }
          setReturnConfirm(null);
          showToast(t('Report marked as returned.'));
        } catch {
          showToast(t('Could not mark this report as returned. Please try again.'));
        }
      }} />}
      {toast && <div className="toast" role="status"><span className="toast-check"><Icon name="check" size={14} /></span>{toast}</div>}
    </div>
  );
}

function BoardLoading() {
  return <section className="board-page board-state"><div className="loading-pulse" /><div className="loading-pulse short" /><h2>{t('Loading the school board…')}</h2><p>{t('Finding the latest approved reports from Phichai School.')}</p></section>;
}

function BoardError({ onRetry }: { onRetry: () => void }) {
  return <section className="board-page board-state"><div className="empty-pin"><Icon name="close" size={25} /></div><h2>{t('We couldn’t load the board.')}</h2><p>{t('The live report service didn’t respond. Your account is still signed in.')}</p><Button className="button secondary" variant="secondary" size="sm" onPress={onRetry}>{t('Try again')}</Button></section>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void }) {
  return <Select aria-label={label} className="filter-select" value={value} onChange={(nextValue) => onChange(String(nextValue))}>
    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover><ListBox>{options.map((option) => <ListBox.Item key={option.id} id={option.id} textValue={t(option.label)}>{t(option.label)}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover>
  </Select>;
}

function BoardView({ reports, myReports, total, filters, updateFilter, onOpenReport, onOpenComposer }: { reports: Report[]; myReports: Report[]; total: number; filters: { query: string; type: 'all' | ReportType; category: string; location: string; status: 'all' | ReportStatus; date: 'all' | 'week' | 'older' }; updateFilter: (key: 'query' | 'type' | 'category' | 'location' | 'status' | 'date', value: string) => void; onOpenReport: (id: string) => void; onOpenComposer: (type: ReportType) => void }) {
  const nonPublicMine = filters.status === 'all' ? myReports.filter((report) => !['approved', 'claimed'].includes(report.status)) : [];
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  return (
    <section className="board-page">
      <div className="board-heading-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" />{t('Community board')}</div>
          <h1>{t('Look for it')}<br /><em>{t('Leave a lead')}</em></h1>
          <p className="lede">{t('A shared place for Phichai School to reconnect lost things with their people.')}</p>
        </div>
        <div className="heading-actions"><Button className="button secondary" variant="secondary" size="sm" onPress={() => onOpenComposer('missing')}><Icon name="plus" size={16} /> {t('Report missing')}</Button><Button className="button primary" variant="primary" size="sm" onPress={() => onOpenComposer('found')}><Icon name="plus" size={16} /> {t('Report found')}</Button></div>
      </div>

      <div className="board-stats"><div className="stat-block"><strong>{total}</strong><span>{t('Total reports')}</span></div><div className="stat-divider" /><div className="stat-block"><strong>{reports.filter((report) => report.type === 'found').length}</strong><span>{t('Found items')}</span></div><div className="stat-divider" /><div className="stat-block"><strong>{reports.filter((report) => report.type === 'missing').length}</strong><span>{t('Still missing')}</span></div><div className="stat-callout"><Icon name="photo" size={17} /><span>{t('A clear photo helps classmates recognize an item.')}</span></div></div>

      <div className="board-toolbar">
        <div className="search-wrap"><Icon name="search" size={19} /><input aria-label={t('Search reports')} placeholder={t('Search by item or description')} value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} /></div>
        <div className={`filter-group${showMoreFilters ? ' expanded' : ''}`}><FilterSelect label="Filter by type" value={filters.type} options={[{ id: 'all', label: 'All types' }, { id: 'missing', label: 'Missing' }, { id: 'found', label: 'Found' }]} onChange={(value) => updateFilter('type', value)} /><FilterSelect label="Filter by category" value={filters.category} options={categories.map((category) => ({ id: category === 'All categories' ? 'all' : category, label: category }))} onChange={(value) => updateFilter('category', value)} /><FilterSelect label="Filter by location" value={filters.location} options={locations.map((location) => ({ id: location === 'All locations' ? 'all' : location, label: location }))} onChange={(value) => updateFilter('location', value)} /><FilterSelect label="Filter by date" value={filters.date} options={[{ id: 'all', label: 'Any date' }, { id: 'week', label: 'Past week' }, { id: 'older', label: 'Older' }]} onChange={(value) => updateFilter('date', value)} /><FilterSelect label="Filter by status" value={filters.status} options={[{ id: 'all', label: 'Live only' }, { id: 'pending', label: 'Pending' }, { id: 'claimed', label: 'Claimed' }, { id: 'returned', label: 'Returned' }]} onChange={(value) => updateFilter('status', value)} /><button type="button" className="filter-icon-button" aria-label={t(showMoreFilters ? 'Fewer filters' : 'More filters')} aria-expanded={showMoreFilters} onClick={() => setShowMoreFilters((visible) => !visible)}><Icon name={showMoreFilters ? 'close' : 'filter'} size={17} /></button></div>
      </div>

      <div className="board-section-header"><div><h2>{t('Active reports')} <span>{reports.length}</span></h2><p>{t('Approved and unresolved items from your school community.')}</p></div><div className="legend"><span><i className="legend-dot found" />{t('Found')}</span><span><i className="legend-dot missing" />{t('Missing')}</span></div></div>
      {reports.length > 0 ? <div className="report-grid">{reports.map((report) => <ReportCard key={report.id} report={report} onOpen={() => onOpenReport(report.id)} />)}</div> : <EmptyState onClear={() => { updateFilter('query', ''); updateFilter('type', 'all'); updateFilter('category', 'all'); updateFilter('location', 'all'); updateFilter('status', 'all'); updateFilter('date', 'all'); }} />}
      {nonPublicMine.length > 0 && <section className="my-submissions"><div className="board-section-header"><div><h2>{t('Your submissions')} <span>{nonPublicMine.length}</span></h2><p>{t('Only you and authorized teachers can see reports awaiting review.')}</p></div></div><div className="report-grid">{nonPublicMine.map((report) => <ReportCard key={report.id} report={report} showStatus onOpen={() => onOpenReport(report.id)} />)}</div></section>}
    </section>
  );
}

function ReportCard({ report, onOpen, showStatus = false }: { report: Report; onOpen: () => void; showStatus?: boolean }) {
  return <Card className="report-card" variant="default" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }}>
    <ReportArtwork report={report} />
    <Card.Content className="card-body"><div className="card-topline"><span className="category-label">{t(report.category)}</span><span className="card-date">{showStatus ? t(statusLabel[report.status]) : t(report.dateLabel)}</span></div><h3>{report.title}</h3><p>{report.description}</p><div className="card-footer"><span className="location"><Icon name="label" size={14} />{t(report.location)}</span><span className="card-arrow"><Icon name="arrow" size={15} /></span></div></Card.Content>
  </Card>;
}

function ReportArtwork({ report, detail = false }: { report: Report; detail?: boolean }) {
  return <div className={`${detail ? 'detail-visual' : 'card-visual'} report-artwork${report.photoPath ? ' has-photo' : ''}`}>
    <div className="photo-placeholder"><Icon name="photo" size={detail ? 30 : 22} /><span>{t('No photo attached')}</span></div>
    {report.photoPath && <PrivatePhoto path={report.photoPath} alt={report.title} />}
    <span className={`type-pill ${report.type}`}>{t(typeCopy[report.type].label)}</span>
    {detail && <div className="detail-visual-caption"><span>{t('Report')} {report.id.replace('r-', '#')}</span><strong>{report.photoPath ? t('Photo attached') : t('No photo added')}</strong></div>}
  </div>;
}

function PrivatePhoto({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!supabase) return;
    void supabase.storage.from('foundit-photos').download(path).then(({ data, error }) => {
      if (error || !data) return;
      objectUrl = URL.createObjectURL(data);
      if (active) setUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return url ? <img src={url} alt={alt} className="private-report-photo" /> : null;
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return <div className="empty-state"><div className="empty-pin"><Icon name="search" size={25} /></div><h3>{t('No reports match that search.')}</h3><p>{t('Try a wider search or clear your filters to see the full board.')}</p><Button className="button secondary" variant="secondary" size="sm" onPress={onClear}>{t('Clear filters')}</Button></div>;
}

function ReportDetail({ report, claim, canModerate, onBack, onClaim, onRequestReturn, showToast }: { report: Report; claim?: OwnClaim; canModerate: boolean; onBack: () => void; onClaim: () => void; onRequestReturn: () => void; showToast: (message: string) => void }) {
  const isFound = report.type === 'found';
  const claimPending = claim && ['pending', 'approved'].includes(claim.status);
  const canClaim = isFound && report.status === 'approved' && !claimPending;
  const claimLabel = claim?.status === 'approved' ? 'Claim approved' : claim?.status === 'rejected' ? 'Claim declined' : claim?.status === 'needs_more_information' ? 'More information requested' : 'Claim submitted';
  return <section className="detail-page">
    <button className="back-link" onClick={onBack}><span>←</span> {t('Back to board')}</button>
    <div className="detail-layout">
      <div className="detail-main">
        <ReportArtwork report={report} detail />
        <div className="detail-header"><div><div className="eyebrow"><span className="eyebrow-line" />{t(report.category)}</div><h1>{report.title}</h1></div><span className={`status-chip ${statusTone[report.status]}`}>{t(statusLabel[report.status])}</span></div>
        <p className="detail-description">{report.description}</p>
        <div className="detail-facts"><div><span>{t(isFound ? 'Found' : 'Last seen')}</span><strong>{report.dateLabel.replace('Found ', '').replace('Last seen ', '')}</strong></div><div><span>{t('Location')}</span><strong>{t(report.location)}</strong></div><div><span>{isFound ? t('Stored at') : t('Reported by')}</span><strong>{isFound ? (report.storageLocation ? t(report.storageLocation) : '') : report.createdBy}</strong></div></div>
        <div className="privacy-box"><div className="privacy-icon"><Icon name="lock" size={17} /></div><div><strong>{t('Keep identifying details private')}</strong><p>{t('Claims are only shared with the teacher reviewing this report. Don’t add passwords, codes, or full card numbers.')}</p></div></div>
        {canModerate && <ModerationHistory key={`${report.id}-${report.status}`} reportId={report.id} />}
      </div>
      <aside className="detail-side">
        <div className="side-card next-step"><div className="side-card-label">{t('Next step')}</div><h3>{t(isFound ? 'Could this be yours?' : 'Have you seen this item?')}</h3><p>{t(isFound ? 'Share one private detail only the owner would know. A teacher will review it.' : 'Let the reporter know if you found a lead or spotted this item around school.')}</p>{isFound ? <Button className="button primary full" variant="primary" isDisabled={!canClaim} onPress={canClaim ? onClaim : undefined}>{claim ? t(claimLabel) : report.status === 'claimed' ? t('Claim already approved') : t('Claim this item')} <Icon name="arrow" size={15} /></Button> : <Button className="button primary full" variant="primary" onPress={() => showToast(t('A lead form will be available soon.'))}>{t('Share a lead')} <Icon name="arrow" size={15} /></Button>}{claim && <p className="claim-status-note">{t('Claim status')}: {t(claim.status)}</p>}</div>
        <div className="side-card report-meta"><div className="side-card-label">{t('Report details')}</div><div className="meta-row"><span>{t('Added')}</span><strong>{report.createdLabel}</strong></div><div className="meta-row"><span>{t('Reported by')}</span><strong>{report.createdBy}</strong></div>{report.responsiblePerson && <div className="meta-row"><span>{t('Responsible')}</span><strong>{t(report.responsiblePerson)}</strong></div>}<div className="meta-row"><span>{t('Report ID')}</span><strong>{report.id.replace('r-', '#')}</strong></div></div>
        {canModerate && ['approved', 'claimed'].includes(report.status) && <Button className="quiet-action" variant="ghost" size="sm" onPress={onRequestReturn}>{t('I’m a teacher · mark returned')}</Button>}
      </aside>
    </div>
  </section>;
}

function ModerationView({ reports, claims, viewerRole, onOpenReport, onDecideReport, onDecideClaim }: { reports: Report[]; claims: TeacherClaim[]; viewerRole: FoundItRole; onOpenReport: (id: string) => void; onDecideReport: (id: string, status: Extract<ReportStatus, 'approved' | 'rejected' | 'returned' | 'archived'>) => void | Promise<void>; onDecideClaim: (id: string, status: Extract<TeacherClaim['status'], 'approved' | 'rejected' | 'needs_more_information'>) => void | Promise<void> }) {
  const pending = reports.filter((report) => report.status === 'pending');
  const reportById = new Map(reports.map((report) => [report.id, report]));
  return <section className="moderation-page"><div className="moderation-heading"><div><div className="eyebrow"><span className="eyebrow-line purple" />{t('Teacher workspace')}</div><h1>{t('Keep the board')}<br /><em>{t('trustworthy.')}</em></h1><p className="lede">{t('Review new reports, protect private details, and help items get home.')}</p></div><div className="moderation-badge"><span className="online-dot purple-dot" />{t('You’re viewing as')} <strong>{t(viewerRole)}</strong></div></div>
    <div className="moderation-summary"><div className="mod-summary-card"><span className="summary-icon pending"><Icon name="clock" size={18} /></span><div><strong>{pending.length}</strong><span>{t('reports to review')}</span></div><span className="summary-arrow"><Icon name="arrow" size={16} /></span></div><div className="mod-summary-card"><span className="summary-icon claim"><Icon name="lock" size={18} /></span><div><strong>{claims.length}</strong><span>{t('private claims')}</span></div><span className="summary-arrow"><Icon name="arrow" size={16} /></span></div><div className="mod-summary-card"><span className="summary-icon returned"><Icon name="check" size={18} /></span><div><strong>{reports.filter((report) => report.status === 'returned').length}</strong><span>{t('Items returned')}</span></div><span className="summary-arrow"><Icon name="arrow" size={16} /></span></div></div>
    <div className="queue-heading"><div><h2>{t('Needs your attention')} <span>{pending.length + claims.length}</span></h2><p>{t('Take a look before these reports reach the wider school community.')}</p></div></div>
    <div className="moderation-list">{pending.map((report) => <ModerationRow key={report.id} report={report} onOpen={() => onOpenReport(report.id)} onApprove={() => onDecideReport(report.id, 'approved')} onReject={() => onDecideReport(report.id, 'rejected')} />)}{claims.map((claim) => {
      const report = reportById.get(claim.report_id);
      return report ? <ClaimModerationRow key={claim.id} claim={claim} report={report} onOpen={() => onOpenReport(report.id)} onDecision={(status) => onDecideClaim(claim.id, status)} /> : null;
    })}{pending.length === 0 && claims.length === 0 && <div className="empty-state compact"><div className="empty-pin"><Icon name="check" size={25} /></div><h3>{t('Queue is clear.')}</h3><p>{t('Nice work. New reports will show up here.')}</p></div>}</div>
  </section>;
}

function ModerationRow({ report, onOpen, onApprove, onReject }: { report: Report; onOpen: () => void; onApprove: () => void | Promise<void>; onReject: () => void | Promise<void> }) {
  return <div className="moderation-row"><div className="row-thumb">{report.photoPath ? <PrivatePhoto path={report.photoPath} alt={report.title} /> : <Icon name="photo" size={18} />}</div><div className="row-main"><div className="row-label"><span className="orange-label">{t('New report')}</span><span>{report.createdLabel}</span></div><h3>{report.title}</h3><p>{t(typeCopy[report.type].label)} · {t(report.category)} · {t(report.location)}</p></div><div className="row-actions"><Button className="row-open" variant="ghost" size="sm" onPress={onOpen}>{t('Review')} <Icon name="arrow" size={14} /></Button><Button className="approve-button" variant="ghost" size="sm" onPress={() => void onReject()} aria-label={`${t('Reject')} ${report.title}`}>{t('Reject')}</Button><Button className="approve-button" variant="ghost" size="sm" isIconOnly onPress={() => void onApprove()} aria-label={`${t('Approve')} ${report.title}`}><Icon name="check" size={16} /></Button></div></div>;
}

function ClaimModerationRow({ claim, report, onOpen, onDecision }: { claim: TeacherClaim; report: Report; onOpen: () => void; onDecision: (status: Extract<TeacherClaim['status'], 'approved' | 'rejected' | 'needs_more_information'>) => void | Promise<void> }) {
  return <div className="moderation-row claim-review-row"><div className="row-thumb">{report.photoPath ? <PrivatePhoto path={report.photoPath} alt={report.title} /> : <Icon name="photo" size={18} />}<span className="row-lock"><Icon name="lock" size={12} /></span></div><div className="row-main"><div className="row-label"><span className="purple-label">{t('Private claim')} · {report.title}</span><span>{formatClaimDate(claim.created_at)}</span></div><p className="private-claim-detail">{claim.private_details}</p><div className="row-actions"><Button className="row-open" variant="ghost" size="sm" onPress={onOpen}>{t('Review report')}</Button><Button className="approve-button" variant="ghost" size="sm" onPress={() => void onDecision('needs_more_information')}>{t('Ask for more information')}</Button><Button className="approve-button" variant="ghost" size="sm" onPress={() => void onDecision('rejected')}>{t('Reject claim')}</Button><Button className="approve-button" variant="ghost" size="sm" onPress={() => void onDecision('approved')}>{t('Approve claim')}</Button></div></div></div>;
}

function formatClaimDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function ModerationHistory({ reportId }: { reportId: string }) {
  const [events, setEvents] = useState<ModerationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void fetchModerationHistory(reportId)
      .then((items) => { if (active) setEvents(items); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reportId]);
  const actionLabels: Record<string, string> = {
    report_approved: 'Report approved', report_rejected: 'Report rejected', report_returned: 'Report marked returned', report_archived: 'Report archived',
    claim_approved: 'Claim approved', claim_rejected: 'Claim rejected', claim_needs_more_information: 'More information requested',
  };
  return <section className="moderation-history"><h3>{t('Moderation history')}</h3>{loading ? <p>{t('Loading moderation history…')}</p> : failed ? <p>{t('Unable to load moderation history.')}</p> : events.length === 0 ? <p>{t('No moderation actions yet.')}</p> : <ol>{events.map((event) => <li key={event.id}><strong>{t(actionLabels[event.action] || event.action)}</strong><span>{formatClaimDate(event.created_at)} · {t('Teacher')}</span>{event.notes && <p>{event.notes}</p>}</li>)}</ol>}</section>;
}

function ComposerSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <Select className="composer-select" value={value} onChange={(nextValue) => onChange(String(nextValue))}>
    <Label>{label}</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger><Select.Popover><ListBox>{options.map((option) => <ListBox.Item key={option} id={option} textValue={t(option)}>{t(option)}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover>
  </Select>;
}

function StorageLocationSelect({ value, options, onChange }: { value: string; options: StorageLocation[]; onChange: (value: string) => void }) {
  return <Select className="composer-select" value={value} onChange={(nextValue) => onChange(String(nextValue || ''))}>
    <Label>{t('Storage location')}</Label><Select.Trigger><Select.Value /></Select.Trigger><Select.Popover><ListBox>{options.map((option) => <ListBox.Item key={option.id} id={option.id} textValue={t(option.label)}>{t(option.label)}<ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover>
  </Select>;
}

function ReturnConfirmModal({ report, onClose, onConfirm }: { report: Report; onClose: () => void; onConfirm: () => void | Promise<void> }) {
  return <Modal.Backdrop isOpen onOpenChange={(open) => { if (!open) onClose(); }}><Modal.Container><Modal.Dialog className="modal confirm-modal"><Modal.CloseTrigger className="close-button" aria-label={t('Close return confirmation')}><Icon name="close" /></Modal.CloseTrigger><Modal.Header className="modal-header"><div><div className="eyebrow"><span className="eyebrow-line purple" />{t('Teacher action')}</div><Modal.Heading>{t('Mark this report returned?')}</Modal.Heading></div></Modal.Header><Modal.Body><p className="claim-intro">{t('This will move')} <strong>{report.title}</strong> {t('out of the active board and record it as returned. You can still review its history later.')}</p></Modal.Body><Modal.Footer className="modal-footer"><Button variant="secondary" onPress={onClose}>{t('Cancel')}</Button><Button variant="primary" onPress={() => void onConfirm()}>{t('Mark returned')} <Icon name="check" size={15} /></Button></Modal.Footer></Modal.Dialog></Modal.Container></Modal.Backdrop>;
}

function ReportComposer({ type, storageLocations, onClose, onSubmitted }: { type: ReportType; storageLocations: StorageLocation[]; onClose: () => void; onSubmitted: (input: NewReportInput) => Promise<void> }) {
  const [draftType, setDraftType] = useState<ReportType>(type);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('School supplies');
  const [location, setLocation] = useState('Main hallway');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => type === 'found' ? currentLocalDateForInput() : '');
  const [storageLocationId, setStorageLocationId] = useState(storageLocations[0]?.id || '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isFound = draftType === 'found';
  const selectedStorage = storageLocations.find((item) => item.id === storageLocationId);
  useEffect(() => {
    if (!storageLocationId && storageLocations[0]) setStorageLocationId(storageLocations[0].id);
  }, [storageLocationId, storageLocations]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isFound && date > currentLocalDateForInput()) {
      setError(FUTURE_FOUND_DATE_ERROR);
      return;
    }
    if (title.trim().length < 2 || description.trim().length < 2 || !date || (isFound && !storageLocationId)) {
      setError('Add the required item, date, location, and description details before sending.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmitted({ type: draftType, title, category, description, date, location, storageLocationId: isFound ? storageLocationId : undefined, photo });
    } catch {
      setError('We couldn’t save your report. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPG or PNG image up to 5 MB.');
      event.target.value = '';
      return;
    }
    setPhoto(file);
    setError('');
  };
  return <Modal.Backdrop isOpen onOpenChange={(open) => { if (!open) onClose(); }}><Modal.Container><Modal.Dialog className="modal composer-modal"><Modal.CloseTrigger className="close-button" aria-label={t('Close report form')}><Icon name="close" /></Modal.CloseTrigger><Modal.Header className="modal-header"><div><div className="eyebrow"><span className="eyebrow-line" />{t('New report')}</div><Modal.Heading>{t('Report something')} {t(isFound ? 'found' : 'missing')}</Modal.Heading></div></Modal.Header><Modal.Body><Form onSubmit={submit}>
    <div className="type-toggle"><Button type="button" variant="tertiary" className={draftType === 'missing' ? 'selected' : ''} onPress={() => { setDraftType('missing'); if (error === FUTURE_FOUND_DATE_ERROR) setError(''); }}>{t('Missing item')}</Button><Button type="button" variant="tertiary" className={draftType === 'found' ? 'selected found-toggle' : ''} onPress={() => { setDraftType('found'); setDate((currentDate) => currentDate || currentLocalDateForInput()); }}>{t('Found item')}</Button></div>
    <div className="form-grid"><TextField isRequired fullWidth name="title" value={title} onChange={setTitle}><Label>{t('Item name')}</Label><Input placeholder={t(isFound ? 'e.g. Navy blue backpack' : 'e.g. Silver water bottle')} /></TextField><ComposerSelect label={t('Category')} value={category} options={categories.slice(1)} onChange={setCategory} /><TextField isRequired fullWidth name="date" type="date" value={date} onChange={(nextDate) => { setDate(nextDate); if (error === FUTURE_FOUND_DATE_ERROR) setError(''); }} isInvalid={error === FUTURE_FOUND_DATE_ERROR}><Label>{t(isFound ? 'Date found' : 'Date last seen')}</Label><Input max={isFound ? currentLocalDateForInput() : undefined} onInvalid={(event) => { if (isFound && event.currentTarget.validity.rangeOverflow) setError(FUTURE_FOUND_DATE_ERROR); }} />{error === FUTURE_FOUND_DATE_ERROR && <FieldError className="form-error">{t(error)}</FieldError>}</TextField><ComposerSelect label={t(isFound ? 'Location found' : 'Approximate location')} value={location} options={locations.slice(1)} onChange={setLocation} />{isFound && <><StorageLocationSelect value={storageLocationId} options={storageLocations} onChange={setStorageLocationId} />{selectedStorage && <div className="field-note">{t('Responsible')}: {t(selectedStorage.responsible_name)}</div>}</>}</div>
    <TextField isRequired fullWidth className="full-field" name="description" value={description} onChange={setDescription}><Label>{t('Description')}</Label><TextArea placeholder={t('Share details that help someone recognize it. Keep private identifiers out.')} rows={4} /><Description>{t('Keep private identifiers out of the public description.')}</Description></TextField>
    {isFound && <div className="safety-callout"><span className="safety-icon"><Icon name="lock" size={15} /></span><p><strong>{t('Keep sensitive details private.')}</strong> {t('Don’t include passwords, access codes, full payment-card numbers, or private contact details in the public description.')}</p></div>}
    <div className="photo-drop"><span className="photo-plus">+</span><div><strong>{photo?.name || t('Add a photo')} <span>{t('Optional')}</span></strong><p>{t('JPG or PNG · up to 5 MB')}</p></div><label className="file-button">{t('Choose file')}<input type="file" accept="image/jpeg,image/png" onChange={choosePhoto} /></label></div>
    {error && error !== FUTURE_FOUND_DATE_ERROR && <FieldError className="form-error">{t(error)}</FieldError>}
    <Modal.Footer className="modal-footer"><span className="private-note"><Icon name="lock" size={14} /> {t('Visible to signed-in school members after review')}</span><Button className="button primary" variant="primary" type="submit" isDisabled={saving}>{t(saving ? 'Saving…' : isFound ? 'Send for review' : 'Publish missing report')} <Icon name="arrow" size={15} /></Button></Modal.Footer>
  </Form></Modal.Body></Modal.Dialog></Modal.Container></Modal.Backdrop>;
}

function ClaimModal({ report, onClose, onSubmitted }: { report: Report; onClose: () => void; onSubmitted: (details: string) => Promise<void> }) {
  const { language } = useI18n();
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (details.trim().length < 12) { setError('Add a little more detail so the teacher can verify your claim privately.'); return; }
    setSaving(true);
    setError('');
    try { await onSubmitted(details); }
    catch { setError('We couldn’t send your claim. Please try again.'); }
    finally { setSaving(false); }
  };
  return <Modal.Backdrop isOpen onOpenChange={(open) => { if (!open) onClose(); }}><Modal.Container><Modal.Dialog className="modal claim-modal"><Modal.CloseTrigger className="close-button" aria-label={t('Close claim form')}><Icon name="close" /></Modal.CloseTrigger><Modal.Header className="modal-header"><div><div className="eyebrow"><span className="eyebrow-line purple" />{t('Private claim')}</div><Modal.Heading>{language === 'th' ? `สิ่งนี้คือ ${report.title} ของคุณหรือไม่?` : `Is this your ${report.title.toLowerCase()}?`}</Modal.Heading></div></Modal.Header><Modal.Body><Form onSubmit={submit}><p className="claim-intro">{t('Tell')} <strong>{t('your teacher')}</strong> {t('one detail that won’t be visible on the public board. It helps keep the process fair and protects your privacy.')}</p><TextField isRequired minLength={12} fullWidth name="privateDetails" value={details} onChange={setDetails} isInvalid={Boolean(error)}><Label>{t('Private identifying detail')}</Label><TextArea placeholder={t('Example: There’s a small blue thread repair on the inside pocket.')} rows={5} />{error ? <FieldError className="form-error">{t(error)}</FieldError> : <Description>{t('Share one detail only the owner would know.')}</Description>}</TextField><div className="private-banner"><Icon name="lock" size={16} /><span>{t('Your note goes only to the teacher reviewing this report.')}</span></div><Modal.Footer className="modal-footer"><Button variant="secondary" type="button" onPress={onClose}>{t('Cancel')}</Button><Button className="button primary" variant="primary" type="submit" isDisabled={saving}>{t(saving ? 'Saving…' : 'Send private claim')} <Icon name="arrow" size={15} /></Button></Modal.Footer></Form></Modal.Body></Modal.Dialog></Modal.Container></Modal.Backdrop>;
}

export default App;
