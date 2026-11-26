import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { AccountSettingsView, type AccountSettingsViewProps } from './AccountSettingsView';
import type { AccountSettings } from '../lib/account-settings';

const user = { id: 'member-1', email: 'niran@example.org', app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: 'Google Name' } } as unknown as User;
const settings: AccountSettings = { display_name: 'Niran', language: 'en', notify_report_updates: true, notify_claim_updates: false };
function setup(overrides: Partial<AccountSettingsViewProps> = {}) {
  const props: AccountSettingsViewProps = {
    user, profile: { id: user.id, school_id: 'phichai-school', role: 'student' }, settings, notifications: [], reports: [], claims: [], requests: [], loading: false, error: null,
    onSaveSettings: vi.fn().mockResolvedValue(undefined), onMarkRead: vi.fn().mockResolvedValue(undefined), onExport: vi.fn().mockResolvedValue(undefined), onRequestDeletion: vi.fn().mockResolvedValue(undefined), onSignOut: vi.fn().mockResolvedValue(undefined), onRefresh: vi.fn(), ...overrides,
  };
  render(<AccountSettingsView {...props} />);
  return props;
}

describe('AccountSettingsView', () => {
  afterEach(() => cleanup());
  it('keeps Google identity and school role read-only', () => {
    setup();
    expect(screen.getByText('niran@example.org')).toBeInTheDocument();
    expect(screen.getByText('Student')).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
  });
  it('saves an edited display name', async () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Niran S.' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(props.onSaveSettings).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Niran S.' })));
  });
  it('saves notification preferences', async () => {
    const props = setup();
    fireEvent.click(screen.getByLabelText(/report updates/i));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(props.onSaveSettings).toHaveBeenCalledWith(expect.objectContaining({ notify_report_updates: false })));
  });
  it('marks a notification read only after explicit activation', async () => {
    const props = setup({ notifications: [{ id: 'n1', category: 'report_review', event_type: 'report_status', report_id: 'r1', created_at: '2026-11-20T12:00:00Z', read_at: null }] });
    expect(props.onMarkRead).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /mark as read/i }));
    await waitFor(() => expect(props.onMarkRead).toHaveBeenCalledWith('n1'));
  });
  it('invokes the own-data JSON export callback', async () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /download my data/i }));
    await waitFor(() => expect(props.onExport).toHaveBeenCalled());
  });
  it('prevents opening a second deletion request while one is open', () => {
    const props = setup({ requests: [{ id: 'req1', user_id: user.id, school_id: 'phichai-school', status: 'open', created_at: '2026-11-20T12:00:00Z', updated_at: '2026-11-20T12:00:00Z' }] });
    expect(screen.getByText(/request already open/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request account deletion/i })).toBeDisabled();
    expect(props.onRequestDeletion).not.toHaveBeenCalled();
  });
  it('submits a deletion request only after confirmation', async () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /request account deletion/i }));
    expect(props.onRequestDeletion).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() => expect(props.onRequestDeletion).toHaveBeenCalledTimes(1));
  });
  it('requires explicit confirmation before local or global sign out', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /sign out on this device/i }));
    expect(props.onSignOut).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign out globally/i }));
    expect(props.onSignOut).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirm sign out/i }));
    return waitFor(() => expect(props.onSignOut).toHaveBeenCalledWith('global'));
  });
  it('explains data privacy and delayed token expiry accurately', () => {
    setup();
    expect(screen.getByText(/only you and authorized school staff/i)).toBeInTheDocument();
    expect(screen.getByText(/existing access tokens can remain valid until they expire/i)).toBeInTheDocument();
    expect(screen.getByText(/email delivery is unavailable/i)).toBeInTheDocument();
  });
  it('announces loading and error feedback', () => {
    setup({ loading: true, error: 'Load failed' });
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.getByRole('alert')).toHaveTextContent('Load failed');
  });
});
