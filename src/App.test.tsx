import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const accountFetch = vi.hoisted(() => ({
  profile: vi.fn(),
  settings: vi.fn(),
  notifications: vi.fn(),
  reports: vi.fn(),
  claims: vi.fn(),
  requests: vi.fn(),
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
}));
vi.mock('./lib/live-reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/live-reports')>();
  return { ...actual, fetchCurrentProfile: accountFetch.profile };
});

import { AppShell } from './App';
import { setLanguage } from './lib/i18n';

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

describe('member account navigation and initial load', () => {
  afterEach(() => {
    cleanup();
    setLanguage('en');
    vi.clearAllMocks();
  });

  it('opens Account Settings from a visible keyboard-operable navigation control', async () => {
    configureSuccessfulLoad();
    render(<AppShell user={member} />);

    const accountNavigation = within(screen.getByRole('navigation')).getByRole('button', { name: /your account/i });
    accountNavigation.focus();
    expect(accountNavigation).toHaveFocus();
    await userEvent.setup().keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Account settings' })).toBeInTheDocument();
    expect(screen.getByText('Google account')).toBeInTheDocument();
    expect(screen.queryByText(/admin settings/i)).not.toBeInTheDocument();
  });

  it('shows an accessible error and retry action when the initial profile fetch fails', async () => {
    accountFetch.profile.mockRejectedValue(new Error('network unavailable'));
    accountFetch.settings.mockResolvedValue({ display_name: 'Niran', language: 'en', notify_report_updates: true, notify_claim_updates: true });
    accountFetch.notifications.mockResolvedValue([]);
    accountFetch.reports.mockResolvedValue([]);
    accountFetch.claims.mockResolvedValue([]);
    accountFetch.requests.mockResolvedValue([]);
    render(<AppShell user={member} />);
    fireEvent.click(screen.getByRole('button', { name: /your account/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load account settings. Please try again.');
    const retry = screen.getByRole('button', { name: /refresh settings|try again/i });
    expect(retry).toBeVisible();
    accountFetch.profile.mockResolvedValue(profile);
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Account settings' })).toBeInTheDocument());
    expect(accountFetch.profile).toHaveBeenCalledTimes(2);
  });

  it('opens account settings from the account menu and can return to the board', async () => {
    configureSuccessfulLoad();
    render(<AppShell user={member} />);

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(await screen.findByRole('heading', { name: 'Account settings' })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /board/i }));
    expect(screen.getByRole('heading', { name: /look for it/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /report missing/i })).toBeVisible();
  });

  it('keeps school settings unavailable to a non-admin and retains the member board', async () => {
    configureSuccessfulLoad();
    render(<AppShell user={member} />);
    expect(screen.queryByRole('button', { name: /school settings/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /look for it/i })).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'School settings' })).not.toBeInTheDocument();
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

    await userEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'แจ้งของที่พบ' }));

    await waitFor(() => expect(document.querySelector('.composer-modal h2')).toBeInTheDocument());
    expect(document.querySelector('.composer-modal h2')).toHaveTextContent('แจ้งของที่พบ');
  });

  it('keeps the photo file chooser reachable by keyboard', async () => {
    render(<AppShell />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /report something found/i }));

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
