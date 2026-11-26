import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchoolSettingsView } from './SchoolSettingsView';
import * as service from '../lib/account-settings';
import type { FoundItProfile } from '../lib/live-reports';

vi.mock('../lib/account-settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/account-settings')>();
  return {
    ...actual,
    fetchSchoolMembers: vi.fn(), changeSchoolMemberRole: vi.fn(), fetchApprovedDomains: vi.fn(), addApprovedDomain: vi.fn(), removeApprovedDomain: vi.fn(),
    fetchStorageLocations: vi.fn(), createStorageLocation: vi.fn(), updateStorageLocation: vi.fn(), removeStorageLocation: vi.fn(),
    fetchReviewSettings: vi.fn(), updateReviewSettings: vi.fn(), fetchSchoolAccountRequests: vi.fn(), updateAccountRequestStatus: vi.fn(),
  };
});

const adminProfile = { id: 'admin-1', school_id: 'phichai-1', role: 'admin' as const };
const member = { id: 'member-1', school_id: 'phichai-1', display_name: 'Mali', email: 'mali@phichai.ac.th', role: 'student' as const };
const otherAdmin = { ...member, id: 'admin-2', display_name: 'Niran', email: 'niran@phichai.ac.th', role: 'admin' as const };
const domain = { id: 'domain-1', school_id: 'phichai-1', domain: 'phichai.ac.th', created_at: '2026-11-01T00:00:00Z' };
const location = { id: 'location-1', school_id: 'phichai-1', label: 'Front office', responsible_name: 'Mali' };
const request = { id: 'request-1', user_id: 'member-1', school_id: 'phichai-1', status: 'received' as const, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' };

function setup(profile: FoundItProfile = adminProfile, schoolMembers: service.SchoolMember[] = [member, otherAdmin]) {
  vi.mocked(service.fetchSchoolMembers).mockResolvedValue(schoolMembers);
  vi.mocked(service.fetchApprovedDomains).mockResolvedValue([domain]);
  vi.mocked(service.fetchStorageLocations).mockResolvedValue([location]);
  vi.mocked(service.fetchReviewSettings).mockResolvedValue({ missing_reports_need_review: true, found_reports_need_review: false });
  vi.mocked(service.fetchSchoolAccountRequests).mockResolvedValue([request]);
  vi.mocked(service.changeSchoolMemberRole).mockResolvedValue(undefined);
  vi.mocked(service.addApprovedDomain).mockResolvedValue({ ...domain, id: 'domain-2', domain: 'example.org' });
  vi.mocked(service.removeApprovedDomain).mockResolvedValue(undefined);
  vi.mocked(service.removeStorageLocation).mockResolvedValue(undefined);
  vi.mocked(service.createStorageLocation).mockResolvedValue(location);
  vi.mocked(service.updateStorageLocation).mockResolvedValue(location);
  vi.mocked(service.updateReviewSettings).mockImplementation(async (_id, value) => value);
  vi.mocked(service.updateAccountRequestStatus).mockImplementation(async (_school, id, status) => ({ ...request, id, status }));
  render(<SchoolSettingsView profile={profile} />);
}

describe('SchoolSettingsView', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('does not mount administrator controls for a non-admin profile', () => {
    setup({ ...adminProfile, role: 'teacher' });
    expect(screen.queryByRole('heading', { name: /school settings/i })).not.toBeInTheDocument();
    expect(service.fetchSchoolMembers).not.toHaveBeenCalled();
  });

  it('changes a member role through the typed operation', async () => {
    setup();
    await screen.findByText('Mali');
    fireEvent.change(screen.getByRole('combobox', { name: /role for mali/i }), { target: { value: 'moderator' } });
    fireEvent.click(screen.getByRole('button', { name: /save role for mali/i }));
    await waitFor(() => expect(service.changeSchoolMemberRole).toHaveBeenCalledWith('member-1', 'moderator'));
  });

  it('prevents self-demotion in the role control', async () => {
    setup(adminProfile, [{ ...member, id: adminProfile.id, role: 'admin', display_name: 'Admin', email: 'admin@phichai.ac.th' }]);
    const control = await screen.findByRole('combobox', { name: /role for admin/i });
    expect(control).toBeDisabled();
    fireEvent.change(control, { target: { value: 'teacher' } });
    expect(service.changeSchoolMemberRole).not.toHaveBeenCalled();
  });

  it('shows safe server feedback when last-admin protection rejects a role change', async () => {
    setup();
    vi.mocked(service.changeSchoolMemberRole).mockRejectedValue(new Error('last school administrator'));
    await screen.findByText('Mali');
    fireEvent.change(screen.getByRole('combobox', { name: /role for niran/i }), { target: { value: 'teacher' } });
    fireEvent.click(screen.getByRole('button', { name: /save role for niran/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save.*administrator/i);
    expect(screen.getByRole('alert')).not.toHaveTextContent('last school administrator');
  });

  it('normalizes and adds valid email domains', async () => {
    setup();
    await screen.findByText('phichai.ac.th');
    fireEvent.change(screen.getByLabelText(/approved domain/i), { target: { value: ' Example.ORG ' } });
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
    await waitFor(() => expect(service.addApprovedDomain).toHaveBeenCalledWith('phichai-1', 'example.org'));
  });

  it('rejects duplicate and invalid domains before calling service', async () => {
    setup();
    await screen.findByText('phichai.ac.th');
    const input = screen.getByLabelText(/approved domain/i);
    fireEvent.change(input, { target: { value: ' PHICHAI.AC.TH ' } });
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already approved/i);
    fireEvent.change(input, { target: { value: 'bad domain' } });
    fireEvent.click(screen.getByRole('button', { name: /add domain/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email domain/i);
    expect(service.addApprovedDomain).not.toHaveBeenCalled();
  });

  it('prevents removal of the final approved domain', async () => {
    setup();
    await screen.findByText('phichai.ac.th');
    expect(screen.getByRole('button', { name: /remove phichai.ac.th/i })).toBeDisabled();
    expect(screen.getByText(/at least one approved domain/i)).toBeInTheDocument();
  });

  it('requires confirmation that domain removal blocks future access but preserves existing data', async () => {
    setup();
    vi.mocked(service.fetchApprovedDomains).mockResolvedValue([domain, { ...domain, id: 'domain-2', domain: 'example.org' }]);
    cleanup();
    render(<SchoolSettingsView profile={adminProfile} />);
    await screen.findByText('phichai.ac.th');
    fireEvent.click(screen.getByRole('button', { name: /remove phichai.ac.th/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/blocks future sign-in and provisioning/i);
    expect(dialog).toHaveTextContent(/does not delete existing profile or report data/i);
    expect(service.removeApprovedDomain).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: /confirm remove domain/i }));
    await waitFor(() => expect(service.removeApprovedDomain).toHaveBeenCalledWith('phichai-1', 'domain-1'));
  });

  it('focuses destructive confirmation and dismisses it with Escape, returning focus', async () => {
    setup();
    vi.mocked(service.fetchApprovedDomains).mockResolvedValue([domain, { ...domain, id: 'domain-2', domain: 'example.org' }]);
    cleanup();
    render(<SchoolSettingsView profile={adminProfile} />);
    await screen.findByText('phichai.ac.th');
    const opener = screen.getByRole('button', { name: /remove phichai.ac.th/i });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    const cancel = within(dialog).getByRole('button', { name: /cancel/i });
    const confirm = within(dialog).getByRole('button', { name: /confirm remove domain/i });
    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('does not claim a storage location was deleted when the server rejects a referenced location', async () => {
    setup();
    vi.mocked(service.removeStorageLocation).mockRejectedValue(new Error('foreign key violation'));
    await screen.findByText('Front office');
    fireEvent.click(screen.getByRole('button', { name: /remove front office/i }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /confirm remove location/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not remove.*may be used by reports/i);
    expect(screen.getByText('Front office')).toBeInTheDocument();
  });

  it('saves both review rules and explains that only new reports are affected', async () => {
    setup();
    await screen.findByLabelText(/missing reports need review/i);
    expect(screen.getByText(/only new reports/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/found reports need review/i));
    fireEvent.click(screen.getByRole('button', { name: /save review rules/i }));
    await waitFor(() => expect(service.updateReviewSettings).toHaveBeenCalledWith('phichai-1', { missing_reports_need_review: true, found_reports_need_review: true }));
  });

  it('transitions account requests only to received, in progress, or completed', async () => {
    setup();
    await screen.findByText('request-1');
    const select = screen.getByLabelText(/status for request-1/i);
    expect(within(select).queryByRole('option', { name: /open/i })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'in_progress' } });
    fireEvent.click(screen.getByRole('button', { name: /save request status/i }));
    await waitFor(() => expect(service.updateAccountRequestStatus).toHaveBeenCalledWith('phichai-1', 'request-1', 'in_progress'));
  });
});
