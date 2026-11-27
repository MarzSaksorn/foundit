import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const accountFetch = vi.hoisted(() => ({
  profile: vi.fn(),
  settings: vi.fn(),
  notifications: vi.fn(),
  reports: vi.fn(),
  claims: vi.fn(),
  requests: vi.fn(),
  liveReports: vi.fn(),
  ownLiveReports: vi.fn(),
  storageLocations: vi.fn(),
  liveClaims: vi.fn(),
  teacherClaims: vi.fn(),
  leadCounts: vi.fn(),
  leadMessages: vi.fn(),
}));

const liveTestRuntime = vi.hoisted(() => ({
  enabled: false,
  client: { auth: { refreshSession: vi.fn(), signOut: vi.fn() } },
}));

vi.mock('./lib/account-settings', () => ({
  fetchOwnAccountSettings: accountFetch.settings,
  fetchOwnNotifications: accountFetch.notifications,
  fetchOwnReports: accountFetch.reports,
  fetchOwnClaims: accountFetch.claims,
  fetchOwnAccountRequests: accountFetch.requests,
  fetchOwnDataExport: vi.fn(),
  updateOwnAccountSettings: vi.fn(),
  markNotificationRead: vi.fn(),
  submitDeletionRequest: vi.fn(),
  fetchSchoolMembers: vi.fn().mockResolvedValue([]),
  fetchApprovedDomains: vi.fn().mockResolvedValue([]),
  fetchStorageLocations: vi.fn().mockResolvedValue([]),
  fetchReviewSettings: vi.fn().mockResolvedValue({ missing_reports_need_review: false, found_reports_need_review: false }),
  fetchSchoolAccountRequests: vi.fn().mockResolvedValue([]),
  changeSchoolMemberRole: vi.fn(),
  addApprovedDomain: vi.fn(),
  removeApprovedDomain: vi.fn(),
  createStorageLocation: vi.fn(),
  updateStorageLocation: vi.fn(),
  removeStorageLocation: vi.fn(),
  updateReviewSettings: vi.fn(),
  updateAccountRequestStatus: vi.fn(),
  normalizeApprovedDomain: vi.fn(),
}));
vi.mock('./lib/supabase', () => ({
  get isSupabaseConfigured() { return liveTestRuntime.enabled; },
  get supabase() { return liveTestRuntime.enabled ? liveTestRuntime.client : null; },
}));
vi.mock('./lib/live-reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/live-reports')>();
  return {
    ...actual,
    fetchCurrentProfile: accountFetch.profile,
    fetchLiveReports: accountFetch.liveReports,
    fetchOwnLiveReports: accountFetch.ownLiveReports,
    fetchStorageLocations: accountFetch.storageLocations,
    fetchOwnClaims: accountFetch.liveClaims,
    fetchTeacherClaims: accountFetch.teacherClaims,
    fetchReportLeadCounts: accountFetch.leadCounts,
    fetchReportLeads: accountFetch.leadMessages,
  };
});

import { AppShell } from './App';
import { setLanguage } from './lib/i18n';
import type { Report } from './lib/reports';

const member = { id: 'member-1', email: 'niran@example.org', user_metadata: { full_name: 'Niran' } } as unknown as User;
const profile = { id: member.id, school_id: 'phichai-school', role: 'student' as const };

function configureSuccessfulLoad() {
  accountFetch.profile.mockResolvedValue(profile);
  accountFetch.settings.mockResolvedValue({ display_name: 'Niran', language: 'en', notify_report_updates: true, notify_claim_updates: true });
  accountFetch.notifications.mockResolvedValue([]);
  accountFetch.reports.mockResolvedValue([]);
  accountFetch.claims.mockResolvedValue([]);
  accountFetch.requests.mockResolvedValue([]);
}

function makeLiveReport(overrides: Partial<Report> & Pick<Report, 'id' | 'title'>): Report {
  return {
    type: 'missing',
    category: 'School supplies',
    description: 'A school report for integration testing.',
    dateLabel: 'Last seen today',
    location: 'Library',
    status: 'approved',
    ageDays: 0,
    createdLabel: 'Today',
    createdBy: 'Niran',
    createdById: member.id,
    initials: 'NI',
    ...overrides,
  };
}

function configureLiveReportLoad(reports: Report[], leadCounts: Record<string, number> = {}) {
  liveTestRuntime.enabled = true;
  accountFetch.profile.mockResolvedValue(profile);
  accountFetch.liveReports.mockResolvedValue(reports);
  accountFetch.ownLiveReports.mockResolvedValue(reports);
  accountFetch.storageLocations.mockResolvedValue([]);
  accountFetch.liveClaims.mockResolvedValue([]);
  accountFetch.teacherClaims.mockResolvedValue([]);
  accountFetch.leadCounts.mockResolvedValue(leadCounts);
  accountFetch.leadMessages.mockResolvedValue([]);
}

describe('member account navigation and initial load', () => {
  afterEach(() => {
    cleanup();
    setLanguage('en');
    liveTestRuntime.enabled = false;
    vi.clearAllMocks();
  });

  it('opens account settings from a keyboard-operable profile menu', async () => {
    configureSuccessfulLoad();
    render(<AppShell user={member} />);

    const user = userEvent.setup();
    const accountMenu = screen.getByRole('button', { name: /account menu/i });
    accountMenu.focus();
    expect(accountMenu).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('button', { name: 'Your account' })).toBeVisible();
    expect(screen.getByRole('heading', { name: /look for it/i })).toBeVisible();
    await user.keyboard('{Tab}');
    expect(screen.getByRole('button', { name: 'Your account' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Account settings' })).toBeInTheDocument();
    expect(screen.getByText('Google account')).toBeInTheDocument();
    expect(screen.queryByText(/admin settings/i)).not.toBeInTheDocument();
  });

  it('removes report shortcuts from the sidebar without removing board report actions', async () => {
    configureSuccessfulLoad();
    render(<AppShell user={member} />);

    const sidebar = screen.getByRole('complementary', { name: 'Main navigation' });
    const workspaceNavigation = within(sidebar).getByRole('navigation');
    expect(within(workspaceNavigation).queryByRole('button', { name: 'Your account' })).not.toBeInTheDocument();
    expect(within(workspaceNavigation).queryByRole('button', { name: 'School settings' })).not.toBeInTheDocument();
    expect(within(sidebar).queryByText('Shortcuts')).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole('button', { name: 'Report something missing' })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole('button', { name: 'Report something found' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report missing/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /report found/i })).toBeVisible();
  });

  it('shows an accessible error and retry action when the initial profile fetch fails', async () => {
    accountFetch.profile.mockRejectedValue(new Error('network unavailable'));
    accountFetch.settings.mockResolvedValue({ display_name: 'Niran', language: 'en', notify_report_updates: true, notify_claim_updates: true });
    accountFetch.notifications.mockResolvedValue([]);
    accountFetch.reports.mockResolvedValue([]);
    accountFetch.claims.mockResolvedValue([]);
    accountFetch.requests.mockResolvedValue([]);
    render(<AppShell user={member} />);
    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Your account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load account settings. Please try again.');
    const retry = screen.getByRole('button', { name: /refresh settings|try again/i });
    expect(retry).toBeVisible();
    accountFetch.profile.mockResolvedValue(profile);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Account settings' })).toBeInTheDocument());
    expect(accountFetch.profile).toHaveBeenCalledTimes(2);
  });

  it('opens account settings from the profile menu and can return to the board', async () => {
    configureSuccessfulLoad();
    render(<AppShell user={member} />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByRole('heading', { name: /look for it/i })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Your account' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Your account' }));
    expect(await screen.findByRole('heading', { name: 'Account settings' })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /board/i }));
    expect(screen.getByRole('heading', { name: /look for it/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report missing/i })).toBeVisible();
  });

  it('keeps school settings unavailable to a non-admin and retains the member board', async () => {
    configureSuccessfulLoad();
    render(<AppShell user={member} />);
    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByRole('button', { name: 'Your account' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /school settings/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /look for it/i })).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'School settings' })).not.toBeInTheDocument();
  });

  it('allows admins to open School settings from the profile menu', async () => {
    configureLiveReportLoad([]);
    accountFetch.profile.mockResolvedValue({ ...profile, role: 'admin' });
    render(<AppShell user={member} />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'School settings' }));

    expect(await screen.findByRole('heading', { name: 'School settings' })).toBeInTheDocument();
  });

  it('does not render a dead profile menu for signed-out visitors', () => {
    render(<AppShell />);

    expect(screen.queryByRole('button', { name: /account menu/i })).not.toBeInTheDocument();
  });

  it('closes the profile menu on Escape and returns focus to its trigger', async () => {
    configureSuccessfulLoad();
    render(<AppShell user={member} />);

    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: /account menu/i });
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Your account' })).toBeVisible();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('button', { name: 'Your account' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes the profile menu when the pointer moves outside it', async () => {
    configureSuccessfulLoad();
    render(<AppShell user={member} />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByRole('button', { name: 'Your account' })).toBeVisible();
    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('button', { name: 'Your account' })).not.toBeInTheDocument();
  });

  it('switches language in both directions and exposes a notification entry point', async () => {
    configureSuccessfulLoad();
    render(<AppShell user={member} />);
    await userEvent.click(screen.getByRole('button', { name: /ไทย/i }));
    expect(document.documentElement).toHaveAttribute('lang', 'th');
    expect(screen.getByRole('button', { name: /การแจ้งเตือน/i })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'EN' })[0]);
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  it('focuses the notifications heading after opening Notifications from the board and account data loads', async () => {
    let resolveProfile!: (value: typeof profile) => void;
    accountFetch.profile.mockImplementation(() => new Promise((resolve) => { resolveProfile = resolve; }));
    accountFetch.settings.mockResolvedValue({ display_name: 'Niran', language: 'en', notify_report_updates: true, notify_claim_updates: true });
    accountFetch.notifications.mockResolvedValue([]);
    accountFetch.reports.mockResolvedValue([]);
    accountFetch.claims.mockResolvedValue([]);
    accountFetch.requests.mockResolvedValue([]);
    render(<AppShell user={member} />);

    await userEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByRole('heading', { name: /loading account settings/i })).toBeInTheDocument();
    expect(document.activeElement).not.toHaveAttribute('id', 'notifications-heading');

    resolveProfile(profile);
    const heading = await screen.findByRole('heading', { name: 'Notifications' });
    await waitFor(() => expect(heading).toHaveFocus());
  });
});

describe('report composer accessibility', () => {
  afterEach(() => {
    cleanup();
    setLanguage('en');
  });

  it('uses the Thai found-report translation in the dialog title', async () => {
    setLanguage('th');
    render(<AppShell />);

    await userEvent.click(screen.getByRole('button', { name: 'แจ้งของที่พบ' }));

    await waitFor(() => expect(document.querySelector('.composer-modal h2')).toBeInTheDocument());
    expect(document.querySelector('.composer-modal h2')).toHaveTextContent('แจ้งของที่พบ');
  });

  it('keeps the photo file chooser reachable by keyboard', async () => {
    render(<AppShell />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /report found/i }));

    const fileChooser = screen.getByLabelText(/choose file/i);
    let reachedFileChooser = false;
    for (let tabCount = 0; tabCount < 20; tabCount += 1) {
      await user.tab();
      if (document.activeElement === fileChooser) {
        reachedFileChooser = true;
        break;
      }
    }

    expect(reachedFileChooser).toBe(true);
  });
});

describe('My Reports AppShell integration', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    setLanguage('en');
    liveTestRuntime.enabled = false;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('signed-in navigation opens My Reports and marks it current', async () => {
    configureLiveReportLoad([makeLiveReport({ id: 'mine-1', title: 'My red notebook' })]);
    render(<AppShell user={member} />);

    const navigation = within(screen.getByRole('navigation'));
    const myReports = navigation.getByRole('button', { name: /my reports/i });
    await userEvent.click(myReports);

    expect(await screen.findByRole('heading', { name: 'My Reports' })).toBeVisible();
    expect(myReports).toHaveAttribute('aria-current', 'page');
  });

  it('My Reports lists only reports whose createdById matches the signed-in user', async () => {
    const ownMissing = makeLiveReport({ id: 'mine-2', title: 'My red notebook' });
    const ownFound = makeLiveReport({ id: 'mine-3', title: 'My found umbrella', type: 'found', status: 'pending' });
    const otherMemberReport = makeLiveReport({ id: 'theirs-1', title: 'Someone else’s wallet', createdById: 'member-2' });
    configureLiveReportLoad([ownMissing, ownFound, otherMemberReport], { 'mine-2': 1 });
    render(<AppShell user={member} />);

    await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /my reports/i }));

    expect(await screen.findByRole('heading', { name: 'My Reports' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'My red notebook' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My found umbrella' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Someone else’s wallet' })).not.toBeInTheDocument();
    await waitFor(() => expect(accountFetch.leadCounts).toHaveBeenCalledWith(['mine-2']));
  });

  it('lists and opens an owned report that is outside the public board feed', async () => {
    const boardReport = makeLiveReport({ id: 'board-1', title: 'Recent board report' });
    const olderOwnedReport = makeLiveReport({ id: 'old-owned', title: 'My archived report', status: 'archived' });
    configureLiveReportLoad([boardReport], { 'old-owned': 1 });
    accountFetch.ownLiveReports.mockResolvedValue([olderOwnedReport]);
    render(<AppShell user={member} />);

    await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /my reports/i }));
    expect(await screen.findByRole('heading', { name: 'My archived report' })).toBeInTheDocument();
    await waitFor(() => expect(accountFetch.leadCounts).toHaveBeenCalledWith(['old-owned']));
    await userEvent.click(await screen.findByRole('button', { name: /view leads/i }));

    expect(await screen.findByRole('heading', { name: 'Private leads' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My archived report' })).toBeInTheDocument();
  });

  it('View leads opens the private inbox and focuses its heading', async () => {
    const ownReport = makeLiveReport({ id: 'mine-with-lead', title: 'My green backpack' });
    configureLiveReportLoad([ownReport], { 'mine-with-lead': 1 });
    render(<AppShell user={member} />);

    await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /my reports/i }));
    await userEvent.click(await screen.findByRole('button', { name: /view leads/i }));

    const inboxHeading = await screen.findByRole('heading', { name: 'Private leads' });
    await waitFor(() => expect(inboxHeading).toHaveFocus());
  });

  it('Back from a lead inbox returns to My Reports', async () => {
    const ownReport = makeLiveReport({ id: 'mine-return', title: 'My blue folder' });
    configureLiveReportLoad([ownReport], { 'mine-return': 1 });
    render(<AppShell user={member} />);

    await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /my reports/i }));
    await userEvent.click(await screen.findByRole('button', { name: /view leads/i }));
    expect(await screen.findByRole('heading', { name: 'Private leads' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back to my reports/i }));

    expect(await screen.findByRole('heading', { name: 'My Reports' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'My blue folder' })).toBeInTheDocument();
  });

  it('lead-count fetch failure leaves My Reports and report links available', async () => {
    const ownReport = makeLiveReport({ id: 'mine-error', title: 'My yellow pencil case' });
    configureLiveReportLoad([ownReport]);
    accountFetch.leadCounts.mockRejectedValue(new Error('lead count service unavailable'));
    render(<AppShell user={member} />);

    await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /my reports/i }));
    expect(await screen.findByRole('heading', { name: 'My Reports' })).toBeVisible();
    expect(await screen.findByText('Lead count unavailable')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open report' }));

    expect(await screen.findByRole('heading', { name: 'My yellow pencil case' })).toBeInTheDocument();
  });

  it('skips lead-count lookup when the member has no missing reports', async () => {
    configureLiveReportLoad([makeLiveReport({ id: 'mine-found-only', title: 'My found umbrella', type: 'found' })]);
    render(<AppShell user={member} />);

    await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /my reports/i }));

    expect(await screen.findByRole('heading', { name: 'My found umbrella' })).toBeInTheDocument();
    expect(accountFetch.leadCounts).not.toHaveBeenCalled();
  });

  it('signed-out visitors do not see the My Reports navigation entry', async () => {
    configureLiveReportLoad([makeLiveReport({ id: 'mine-signed-out', title: 'My signed-in report' })]);
    const { unmount } = render(<AppShell user={member} />);
    expect(within(screen.getByRole('navigation')).getByRole('button', { name: /my reports/i })).toBeInTheDocument();
    unmount();
    render(<AppShell />);

    expect(within(screen.getByRole('navigation')).queryByRole('button', { name: /my reports/i })).not.toBeInTheDocument();
  });
});

describe('report detail navigation', () => {
  afterEach(() => {
    cleanup();
    setLanguage('en');
    vi.restoreAllMocks();
  });

  it('scrolls to the top when a report detail opens', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<AppShell />);

    await userEvent.click(screen.getByRole('button', { name: /navy blue backpack/i }));

    expect(await screen.findByRole('heading', { name: 'Navy blue backpack' })).toBeInTheDocument();
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 0));
  });

  it('restores the list position when returning from report detail', async () => {
    const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 372 });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    try {
      render(<AppShell />);
      await userEvent.click(screen.getByRole('button', { name: /navy blue backpack/i }));
      expect(await screen.findByRole('heading', { name: 'Navy blue backpack' })).toBeInTheDocument();
      await waitFor(() => expect(scrollTo).toHaveBeenNthCalledWith(1, 0, 0));

      await userEvent.click(screen.getByRole('button', { name: /back to board/i }));
      expect(await screen.findByRole('heading', { name: /look for it/i })).toBeInTheDocument();
      await waitFor(() => expect(scrollTo).toHaveBeenNthCalledWith(2, 0, 372));
    } finally {
      if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
    }
  });
});
