import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({
  fetchOwnAccountSettings: vi.fn(),
  updateOwnAccountSettings: vi.fn(),
}));
vi.mock('./account-settings', () => settings);
import { getLanguage, restoreLanguageForUser, saveLanguageForUser, setAuthenticatedUserId, setLanguage, t, translations } from './i18n';

describe('language preference persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setAuthenticatedUserId(null);
    settings.fetchOwnAccountSettings.mockReset();
    settings.updateOwnAccountSettings.mockReset();
    setLanguage('en');
  });
  it('restores a signed-in preference from account settings', async () => {
    settings.fetchOwnAccountSettings.mockResolvedValue({ display_name: 'Niran', language: 'th', notify_report_updates: true, notify_claim_updates: true });
    await restoreLanguageForUser('u1');
    expect(getLanguage()).toBe('th');
    expect(window.localStorage.getItem('foundit-language')).toBe('th');
  });
  it('saves a signed-in language choice without dropping other settings', async () => {
    settings.fetchOwnAccountSettings.mockResolvedValue({ display_name: 'Niran', language: 'en', notify_report_updates: false, notify_claim_updates: true });
    settings.updateOwnAccountSettings.mockResolvedValue({ display_name: 'Niran', language: 'th', notify_report_updates: false, notify_claim_updates: true });
    await saveLanguageForUser('u1', 'th');
    expect(settings.updateOwnAccountSettings).toHaveBeenCalledWith('u1', { display_name: 'Niran', language: 'th', notify_report_updates: false, notify_claim_updates: true });
    expect(getLanguage()).toBe('th');
  });
  it('keeps a signed-out locale choice in local storage', () => {
    setLanguage('th');
    expect(getLanguage()).toBe('th');
    expect(window.localStorage.getItem('foundit-language')).toBe('th');
    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(window.localStorage.getItem('foundit-language')).toBe('en');
  });
  it('translates School settings in English and Thai', () => {
    expect(translations.en['School settings']).toBe('School settings');
    expect(translations.th['School settings']).toBe('ตั้งค่าโรงเรียน');
    setLanguage('en');
    expect(t('School settings')).toBe('School settings');
    setLanguage('th');
    expect(t('School settings')).toBe('ตั้งค่าโรงเรียน');
  });
  it('saves locale changes made by a signed-in user', async () => {
    settings.fetchOwnAccountSettings.mockResolvedValue({ display_name: 'Niran', language: 'en', notify_report_updates: true, notify_claim_updates: false });
    settings.updateOwnAccountSettings.mockResolvedValue({ display_name: 'Niran', language: 'th', notify_report_updates: true, notify_claim_updates: false });
    setAuthenticatedUserId('u1');
    setLanguage('th');
    await vi.waitFor(() => expect(settings.updateOwnAccountSettings).toHaveBeenCalledWith('u1', {
      display_name: 'Niran', language: 'th', notify_report_updates: true, notify_claim_updates: false,
    }));
  });
});
