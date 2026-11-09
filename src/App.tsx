import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
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
import { isSupabaseConfigured, supabase } from './lib/supabase';

type View = 'board' | 'moderation';

type IconName = 'search' | 'plus' | 'grid' | 'inbox' | 'settings' | 'chevron' | 'arrow' | 'pin' | 'clock' | 'lock' | 'check' | 'close' | 'filter' | 'spark';

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
    pin: <><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
    spark: <><path d="m12 3 1.3 4.7L18 9l-4.7 1.3L12 15l-1.3-4.7L6 9l4.7-1.3L12 3Z" /><path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z" /></>,
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

function App() {
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

function AuthLoading() {
  return <main className="auth-screen"><div className="auth-card"><div className="brand-mark">F<span>●</span></div><h1>Checking your school account</h1><p>FoundIt is confirming your Phichai School session.</p></div></main>;
}

function SignInScreen({ error }: { error: string }) {
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
  return <main className="auth-screen"><div className="auth-card"><div className="brand-lockup auth-brand"><div className="brand-mark">F<span>●</span></div><div><div className="brand-name">Found<span>It</span></div><div className="brand-school">{PHICHAI_SCHOOL}</div></div></div><div className="eyebrow"><span className="eyebrow-line" />School community</div><h1>Find it.<br /><em>Bring it home.</em></h1><p className="auth-copy">Sign in with your Phichai School Google account to browse reports, share a missing item, or send a private claim.</p><button className="button primary full auth-button" onClick={() => void handleSignIn()} disabled={signingIn}>{signingIn ? 'Opening Google…' : 'Continue with Google'}</button><p className="auth-domain">Only <strong>@{PHICHAI_DOMAIN}</strong> accounts can access FoundIt.</p>{signInError && <div className="form-error" role="alert">{signInError}</div>}</div></main>;
}

function AppShell({ user }: { user?: User }) {
  const [view, setView] = useState<View>('board');
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerType, setComposerType] = useState<ReportType>('missing');
  const [claimOpen, setClaimOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filters, setFilters] = useState({ query: '', type: 'all' as 'all' | ReportType, category: 'all', location: 'all', status: 'all' as 'all' | ReportStatus, date: 'all' as 'all' | 'week' | 'older' });

  const filteredReports = useMemo(() => filterReports(reports, filters).filter((report) => filters.status === 'all' ? report.status === 'approved' : report.status === filters.status), [reports, filters]);
  const selectedReport = selectedId ? getReportById(reports, selectedId) : undefined;
  const pendingCount = reports.filter((report) => report.status === 'pending').length;
  const claimCount = reports.reduce((count, report) => count + (report.claimCount || 0), 0);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/reports\/(.+)$/);
    if (match) setSelectedId(decodeURIComponent(match[1]));
  }, []);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };

  const updateReport = (id: string, patch: Partial<Report>) => {
    setReports((current) => current.map((report) => report.id === id ? { ...report, ...patch } : report));
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

        <div className="sidebar-section-label">Workspace</div>
        <nav className="nav-list">
          <button className={`nav-item ${view === 'board' ? 'active' : ''}`} onClick={() => { setView('board'); setSelectedId(null); }}>
            <Icon name="grid" /> <span>Board</span><span className="nav-count">{reports.filter((report) => report.status === 'approved').length}</span>
          </button>
          <button className={`nav-item ${view === 'moderation' ? 'active' : ''}`} onClick={() => { setView('moderation'); setSelectedId(null); }}>
            <Icon name="inbox" /> <span>Moderation</span><span className="nav-count accent">{pendingCount + claimCount}</span>
          </button>
        </nav>

        <div className="sidebar-section-label">Shortcuts</div>
        <div className="shortcut-list">
          <button onClick={() => openComposer('missing')}><span className="shortcut-dot coral" />Report something missing</button>
          <button onClick={() => openComposer('found')}><span className="shortcut-dot mint" />Report something found</button>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="sidebar-note-icon"><Icon name="spark" size={17} /></div>
            <div><strong>Small leads add up.</strong><span>Every report helps a classmate.</span></div>
          </div>
          <button className="nav-item muted"><Icon name="settings" /><span>School settings</span></button>
          <div className="account-row">
            <div className="avatar">{user ? (user.email?.slice(0, 2).toUpperCase() || 'PS') : 'MR'}</div><div className="account-copy"><strong>{user?.user_metadata?.full_name || user?.email || 'Ms. Rivera'}</strong><span>{user ? `Member · ${PHICHAI_SCHOOL}` : 'Teacher · Phichai'}</span></div><button className="more-button" aria-label="Account menu">•••</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Phichai School</span><span className="crumb-slash">/</span><strong>{view === 'board' ? 'Community board' : 'Teacher moderation'}</strong></div>
          <div className="topbar-actions"><span className="saved-note"><span className="online-dot" />Seeded demo data</span><button className="help-button">?</button><button className="avatar mini">MR</button></div>
        </header>

        {view === 'board' && !selectedReport && <BoardView reports={filteredReports} total={reports.length} filters={filters} updateFilter={updateFilter} onOpenReport={setSelectedId} onOpenComposer={openComposer} />}
        {view === 'moderation' && !selectedReport && <ModerationView reports={reports} onOpenReport={setSelectedId} onUpdateReport={updateReport} />}
        {selectedReport && <ReportDetail report={selectedReport} onBack={() => setSelectedId(null)} onClaim={() => setClaimOpen(true)} onUpdate={updateReport} showToast={showToast} />}
      </main>

      {composerOpen && <ReportComposer type={composerType} onClose={() => setComposerOpen(false)} onSubmitted={(report) => { setReports((current) => [report, ...current]); setComposerOpen(false); showToast(report.status === 'approved' ? 'Missing report published to the board.' : 'Found report saved. A teacher will review it shortly.'); }} />}
      {claimOpen && selectedReport && <ClaimModal report={selectedReport} onClose={() => setClaimOpen(false)} onSubmitted={() => { updateReport(selectedReport.id, { status: 'claimed', claimCount: (selectedReport.claimCount || 0) + 1 }); setClaimOpen(false); showToast('Claim sent privately to the teacher.'); }} />}
      {toast && <div className="toast" role="status"><span className="toast-check"><Icon name="check" size={14} /></span>{toast}</div>}
    </div>
  );
}

function BoardView({ reports, total, filters, updateFilter, onOpenReport, onOpenComposer }: { reports: Report[]; total: number; filters: { query: string; type: 'all' | ReportType; category: string; location: string; status: 'all' | ReportStatus; date: 'all' | 'week' | 'older' }; updateFilter: (key: 'query' | 'type' | 'category' | 'location' | 'status' | 'date', value: string) => void; onOpenReport: (id: string) => void; onOpenComposer: (type: ReportType) => void }) {
  return (
    <section className="board-page">
      <div className="board-heading-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" />Community board</div>
          <h1>Look for it.<br /><em>Leave a lead.</em></h1>
          <p className="lede">A shared place for Northbridge to reconnect lost things with their people.</p>
        </div>
        <div className="heading-actions"><button className="button secondary" onClick={() => onOpenComposer('missing')}><Icon name="plus" size={16} /> Report missing</button><button className="button primary" onClick={() => onOpenComposer('found')}><Icon name="plus" size={16} /> Report found</button></div>
      </div>

      <div className="board-stats"><div className="stat-block"><strong>{total}</strong><span>total reports</span></div><div className="stat-divider" /><div className="stat-block"><strong>{reports.filter((report) => report.type === 'found').length}</strong><span>found items</span></div><div className="stat-divider" /><div className="stat-block"><strong>{reports.filter((report) => report.type === 'missing').length}</strong><span>still missing</span></div><div className="stat-callout"><Icon name="spark" size={17} /><span><strong>3 items</strong> found their way home this week</span></div></div>

      <div className="board-toolbar">
        <div className="search-wrap"><Icon name="search" size={19} /><input aria-label="Search reports" placeholder="Search by item or description" value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} /></div>
        <div className="filter-group"><select aria-label="Filter by type" value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}><option value="all">All types</option><option value="missing">Missing</option><option value="found">Found</option></select><select aria-label="Filter by category" value={filters.category} onChange={(event) => updateFilter('category', event.target.value === 'All categories' ? 'all' : event.target.value)}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select><select aria-label="Filter by location" value={filters.location} onChange={(event) => updateFilter('location', event.target.value === 'All locations' ? 'all' : event.target.value)}>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</select><select aria-label="Filter by date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)}><option value="all">Any date</option><option value="week">Past week</option><option value="older">Older</option></select><select aria-label="Filter by status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="all">Live only</option><option value="pending">Pending</option><option value="claimed">Claimed</option><option value="returned">Returned</option></select><button className="filter-icon-button" aria-label="More filters"><Icon name="filter" size={17} /></button></div>
      </div>

      <div className="board-section-header"><div><h2>Active reports <span>{reports.length}</span></h2><p>Approved and unresolved items from your school community.</p></div><div className="legend"><span><i className="legend-dot found" />Found</span><span><i className="legend-dot missing" />Missing</span></div></div>
      {reports.length > 0 ? <div className="report-grid">{reports.map((report) => <ReportCard key={report.id} report={report} onOpen={() => onOpenReport(report.id)} />)}</div> : <EmptyState onClear={() => { updateFilter('query', ''); updateFilter('type', 'all'); updateFilter('category', 'all'); updateFilter('location', 'all'); updateFilter('status', 'all'); updateFilter('date', 'all'); }} />}
    </section>
  );
}

function ReportCard({ report, onOpen }: { report: Report; onOpen: () => void }) {
  return <article className="report-card" onClick={onOpen} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpen(); }}>
    <div className="card-visual" style={{ background: report.color }}><div className="visual-lines" /><span className={`type-pill ${report.type}`}>{typeCopy[report.type].label}</span>{report.hasPhoto && <span className="photo-label">Photo</span>}<span className="pin"><span /></span></div>
    <div className="card-body"><div className="card-topline"><span className="category-label">{report.category}</span><span className="card-date">{report.dateLabel}</span></div><h3>{report.title}</h3><p>{report.description}</p><div className="card-footer"><span className="location"><Icon name="pin" size={14} />{report.location}</span><span className="card-arrow"><Icon name="arrow" size={15} /></span></div></div>
  </article>;
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return <div className="empty-state"><div className="empty-pin"><Icon name="search" size={25} /></div><h3>No reports match that search.</h3><p>Try a wider search or clear your filters to see the full board.</p><button className="button secondary" onClick={onClear}>Clear filters</button></div>;
}

function ReportDetail({ report, onBack, onClaim, onUpdate, showToast }: { report: Report; onBack: () => void; onClaim: () => void; onUpdate: (id: string, patch: Partial<Report>) => void; showToast: (message: string) => void }) {
  const isFound = report.type === 'found';
  return <section className="detail-page"><button className="back-link" onClick={onBack}><span>←</span> Back to board</button><div className="detail-layout"><div className="detail-main"><div className="detail-visual" style={{ background: report.color }}><div className="visual-lines" /><span className={`type-pill ${report.type}`}>{typeCopy[report.type].label}</span><span className="detail-pin"><span /></span><div className="detail-visual-caption"><span>Report {report.id.replace('r-', '#')}</span><strong>{report.hasPhoto ? 'Photo attached' : 'No photo added'}</strong></div></div><div className="detail-header"><div><div className="eyebrow"><span className="eyebrow-line" />{report.category}</div><h1>{report.title}</h1></div><span className={`status-chip ${statusTone[report.status]}`}>{statusLabel[report.status]}</span></div><p className="detail-description">{report.description}</p><div className="detail-facts"><div><span>{isFound ? 'Found' : 'Last seen'}</span><strong>{report.dateLabel.replace('Found ', '').replace('Last seen ', '')}</strong></div><div><span>Location</span><strong>{report.location}</strong></div><div><span>{isFound ? 'Stored at' : 'Reported by'}</span><strong>{isFound ? report.storageLocation : report.createdBy}</strong></div></div><div className="privacy-box"><div className="privacy-icon"><Icon name="lock" size={17} /></div><div><strong>Keep identifying details private</strong><p>Claims are only shared with the teacher reviewing this report. Don’t add passwords, codes, or full card numbers.</p></div></div></div><aside className="detail-side"><div className="side-card next-step"><div className="side-card-label">Next step</div><h3>{isFound ? 'Could this be yours?' : 'Have you seen this item?'}</h3><p>{isFound ? 'Share one private detail only the owner would know. A teacher will review it.' : 'Let the reporter know if you found a lead or spotted this item around school.'}</p><button className="button primary full" onClick={isFound ? onClaim : () => showToast('A lead form will be available soon.')}>{isFound ? 'Claim this item' : 'Share a lead'} <Icon name="arrow" size={15} /></button></div><div className="side-card report-meta"><div className="side-card-label">Report details</div><div className="meta-row"><span>Added</span><strong>{report.createdLabel}</strong></div><div className="meta-row"><span>Reported by</span><strong>{report.createdBy}</strong></div>{report.responsiblePerson && <div className="meta-row"><span>Responsible</span><strong>{report.responsiblePerson}</strong></div>}<div className="meta-row"><span>Report ID</span><strong>{report.id.replace('r-', '#')}</strong></div></div>{report.status === 'approved' && <button className="quiet-action" onClick={() => { onUpdate(report.id, { status: 'returned' }); showToast('Report marked as returned.'); }}>I’m a teacher · mark returned</button>}</aside></div></section>;
}

function ModerationView({ reports, onOpenReport, onUpdateReport }: { reports: Report[]; onOpenReport: (id: string) => void; onUpdateReport: (id: string, patch: Partial<Report>) => void }) {
  const pending = reports.filter((report) => report.status === 'pending');
  const claims = reports.filter((report) => (report.claimCount || 0) > 0 && report.status !== 'returned');
  return <section className="moderation-page"><div className="moderation-heading"><div><div className="eyebrow"><span className="eyebrow-line purple" />Teacher workspace</div><h1>Keep the board<br /><em>trustworthy.</em></h1><p className="lede">Review new reports, protect private details, and help items get home.</p></div><div className="moderation-badge"><span className="online-dot purple-dot" />You’re viewing as <strong>teacher</strong></div></div><div className="moderation-summary"><div className="mod-summary-card"><span className="summary-icon pending"><Icon name="clock" size={18} /></span><div><strong>{pending.length}</strong><span>reports to review</span></div><span className="summary-arrow">→</span></div><div className="mod-summary-card"><span className="summary-icon claim"><Icon name="lock" size={18} /></span><div><strong>{claims.reduce((sum, report) => sum + (report.claimCount || 0), 0)}</strong><span>private claims</span></div><span className="summary-arrow">→</span></div><div className="mod-summary-card"><span className="summary-icon returned"><Icon name="check" size={18} /></span><div><strong>{reports.filter((report) => report.status === 'returned').length + 3}</strong><span>returned this month</span></div><span className="summary-arrow">→</span></div></div><div className="queue-heading"><div><h2>Needs your attention <span>{pending.length + claims.length}</span></h2><p>Take a look before these reports reach the wider school community.</p></div><button className="button secondary"><Icon name="filter" size={16} /> Filter queue</button></div><div className="moderation-list">{pending.map((report) => <ModerationRow key={report.id} report={report} onOpen={() => onOpenReport(report.id)} onApprove={() => onUpdateReport(report.id, { status: 'approved' })} />)}{claims.map((report) => <ModerationRow key={`${report.id}-claim`} report={report} claim onOpen={() => onOpenReport(report.id)} onApprove={() => onUpdateReport(report.id, { status: 'approved' })} />)}{pending.length === 0 && claims.length === 0 && <div className="empty-state compact"><div className="empty-pin"><Icon name="check" size={25} /></div><h3>Queue is clear.</h3><p>Nice work. New reports will show up here.</p></div>}</div></section>;
}

function ModerationRow({ report, claim = false, onOpen, onApprove }: { report: Report; claim?: boolean; onOpen: () => void; onApprove: () => void }) {
  return <div className="moderation-row"><div className="row-thumb" style={{ background: report.color }}><span className={`mini-type ${report.type}`} />{claim && <span className="row-lock"><Icon name="lock" size={12} /></span>}</div><div className="row-main"><div className="row-label"><span className={claim ? 'purple-label' : 'orange-label'}>{claim ? 'Private claim' : 'New report'}</span><span>{report.createdLabel}</span></div><h3>{report.title}</h3><p>{claim ? `${report.claimCount} private claim${report.claimCount === 1 ? '' : 's'} waiting for review` : `${typeCopy[report.type].label} · ${report.category} · ${report.location}`}</p></div><div className="row-actions"><button className="row-open" onClick={onOpen}>Review <Icon name="arrow" size={14} /></button>{!claim && <button className="approve-button" onClick={onApprove} aria-label={`Approve ${report.title}`}><Icon name="check" size={16} /></button>}</div></div>;
}

function ReportComposer({ type, onClose, onSubmitted }: { type: ReportType; onClose: () => void; onSubmitted: (report: Report) => void }) {
  const [draftType, setDraftType] = useState<ReportType>(type);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('School supplies');
  const [location, setLocation] = useState('Main hallway');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [storageLocation, setStorageLocation] = useState('Front office shelf A');
  const [responsiblePerson, setResponsiblePerson] = useState('School admin');
  const [photoName, setPhotoName] = useState('');
  const [error, setError] = useState('');
  const isFound = draftType === 'found';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim() || !date || (isFound && (!storageLocation.trim() || !responsiblePerson.trim()))) {
      setError('Add the required item, date, location, and description details before sending.');
      return;
    }
    onSubmitted({ id: `r-${Date.now()}`, type: draftType, title, category, description, dateLabel: isFound ? `Found ${date}` : `Last seen ${date}`, location, storageLocation: isFound ? storageLocation : undefined, responsiblePerson: isFound ? responsiblePerson : undefined, status: isFound ? 'pending' : 'approved', ageDays: 0, createdLabel: 'Today', createdBy: 'Signed-in student', initials: 'SS', color: isFound ? '#c4e3aa' : '#f3b6aa', hasPhoto: Boolean(photoName) });
  };
  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPG or PNG image up to 5 MB.');
      return;
    }
    setPhotoName(file.name);
    setError('');
  };
  return <div className="modal-backdrop" role="presentation"><div className="modal composer-modal" role="dialog" aria-modal="true" aria-labelledby="composer-title"><div className="modal-header"><div><div className="eyebrow"><span className="eyebrow-line" />New report</div><h2 id="composer-title">Report something {isFound ? 'found' : 'missing'}</h2></div><button className="close-button" onClick={onClose} aria-label="Close report form"><Icon name="close" /></button></div><form onSubmit={submit}><div className="type-toggle"><button type="button" onClick={() => setDraftType('missing')} className={draftType === 'missing' ? 'selected' : ''}>Missing item</button><button type="button" onClick={() => setDraftType('found')} className={draftType === 'found' ? 'selected found-toggle' : ''}>Found item</button></div><div className="form-grid"><label>Item name<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={isFound ? 'e.g. Navy blue backpack' : 'e.g. Silver water bottle'} /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>{isFound ? 'Date found' : 'Date last seen'}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>{isFound ? 'Location found' : 'Approximate location'}<select value={location} onChange={(event) => setLocation(event.target.value)}>{locations.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>{isFound && <label>Storage location<input value={storageLocation} onChange={(event) => setStorageLocation(event.target.value)} placeholder="e.g. Front office, shelf B" /></label>}{isFound && <label>Responsible teacher<input value={responsiblePerson} onChange={(event) => setResponsiblePerson(event.target.value)} placeholder="e.g. Ms. Rivera" /></label>}</div><label className="full-field">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Share details that help someone recognize it. Keep private identifiers out." rows={4} /></label>{isFound && <div className="safety-callout"><span className="safety-icon"><Icon name="lock" size={15} /></span><p><strong>Keep sensitive details private.</strong> Don’t include passwords, access codes, full payment-card numbers, or private contact details in the public description.</p></div>}<div className="photo-drop"><span className="photo-plus">+</span><div><strong>{photoName || 'Add a photo'} <span>Optional</span></strong><p>JPG or PNG · up to 5 MB</p></div><label className="file-button">Choose file<input type="file" accept="image/jpeg,image/png" onChange={choosePhoto} /></label></div>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-footer"><span className="private-note"><Icon name="lock" size={14} /> Visible to signed-in school members after review</span><button className="button primary" type="submit">Send for review <Icon name="arrow" size={15} /></button></div></form></div></div>;
}

function ClaimModal({ report, onClose, onSubmitted }: { report: Report; onClose: () => void; onSubmitted: () => void }) {
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (details.trim().length < 12) { setError('Add a little more detail so the teacher can verify your claim privately.'); return; } onSubmitted(); };
  return <div className="modal-backdrop"><div className="modal claim-modal" role="dialog" aria-modal="true" aria-labelledby="claim-title"><div className="modal-header"><div><div className="eyebrow"><span className="eyebrow-line purple" />Private claim</div><h2 id="claim-title">Is this your {report.title.toLowerCase()}?</h2></div><button className="close-button" onClick={onClose} aria-label="Close claim form"><Icon name="close" /></button></div><p className="claim-intro">Tell <strong>Ms. Rivera</strong> one detail that won’t be visible on the public board. It helps keep the process fair and protects your privacy.</p><label>Private identifying detail<textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Example: There’s a small blue thread repair on the inside pocket." rows={5} /></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="private-banner"><Icon name="lock" size={16} /><span>Your note goes only to the teacher reviewing this report.</span></div><div className="modal-footer"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={submit}>Send private claim <Icon name="arrow" size={15} /></button></div></div></div>;
}

export default App;
