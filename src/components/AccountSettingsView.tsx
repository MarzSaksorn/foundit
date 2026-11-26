import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useI18n } from '../lib/i18n';
import type { AccountRequest, AccountSettings, FoundItNotification, OwnClaim, OwnReport } from '../lib/account-settings';
import type { FoundItProfile } from '../lib/live-reports';

type SignOutScope = 'local' | 'global';
export type AccountSettingsViewProps = {
  user: User; profile: FoundItProfile; settings: AccountSettings | null; notifications: FoundItNotification[]; reports: OwnReport[]; claims: OwnClaim[]; requests: AccountRequest[];
  loading: boolean; error: string | null; onSaveSettings: (settings: AccountSettings) => Promise<void>; onMarkRead: (id: string) => Promise<void>;
  onExport: () => Promise<void>; onRequestDeletion: () => Promise<void>; onSignOut: (scope: SignOutScope) => Promise<void>; onRefresh: () => void;
};

export function AccountSettingsView(props: AccountSettingsViewProps) {
  const { language, t } = useI18n();
  const [name, setName] = useState(props.settings?.display_name ?? '');
  const [reportUpdates, setReportUpdates] = useState(props.settings?.notify_report_updates ?? true);
  const [claimUpdates, setClaimUpdates] = useState(props.settings?.notify_claim_updates ?? true);
  const [savedLanguage, setSavedLanguage] = useState(props.settings?.language ?? language);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [dialog, setDialog] = useState<'signout' | 'deletion' | null>(null);
  const [scope, setScope] = useState<SignOutScope>('local');
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openRequest = props.requests.some((request) => request.status === 'open');
  const act = async (action: () => Promise<void>, successKey: string) => {
    setBusy(true); setFeedback('');
    try { await action(); setFeedback(t(successKey)); }
    catch { setFeedback(t('We couldn’t save this setting. Please try again.')); }
    finally { setBusy(false); }
  };
  const save = () => act(() => props.onSaveSettings({ display_name: name, language: savedLanguage, notify_report_updates: reportUpdates, notify_claim_updates: claimUpdates }), 'Your settings were saved.');
  const requestDeletion = () => act(async () => { await props.onRequestDeletion(); setDialog(null); }, 'Your request was submitted.');
  const signOut = () => act(async () => { await props.onSignOut(scope); setDialog(null); }, 'You have been signed out.');
  useEffect(() => {
    if (!dialog) return;
    const dialogElement = dialogRef.current;
    const first = dialogElement?.querySelector<HTMLElement>('button');
    const last = dialogElement?.querySelectorAll<HTMLElement>('button');
    first?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setDialog(null); return; }
      if (event.key !== 'Tab' || !first || !last?.length) return;
      const finalButton = last[last.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); finalButton.focus(); }
      else if (!event.shiftKey && document.activeElement === finalButton) { event.preventDefault(); first.focus(); }
    };
    dialogElement?.addEventListener('keydown', handleKeyDown);
    return () => { dialogElement?.removeEventListener('keydown', handleKeyDown); returnFocusRef.current?.focus(); };
  }, [dialog]);
  const formatDate = (value: string) => new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium' }).format(new Date(value));
  return <section className="account-settings-page" aria-labelledby="account-settings-title">
    <div className="account-settings-heading"><div><div className="eyebrow"><span className="eyebrow-line purple" />{t('Your account')}</div><h1 id="account-settings-title">{t('Account settings')}</h1><p>{t('Manage your FoundIt profile and preferences for Phichai School.')}</p></div><button className="button secondary" type="button" onClick={props.onRefresh}>{t('Refresh settings')}</button></div>
    {props.loading && <p role="status" className="account-feedback">{t('Loading account settings…')}</p>}
    {props.error && <p role="alert" className="form-error">{props.error}</p>}
    {feedback && <p role="status" className="account-feedback">{feedback}</p>}
    {props.settings && <>
      <section className="account-card" aria-labelledby="profile-heading"><h2 id="profile-heading">{t('Profile')}</h2><p className="account-section-copy">{t('Your Google account manages your sign-in identity. Only your display name can be changed here.')}</p>
        <label className="account-field">{t('Display name')}<input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></label><button type="button" className="button primary" disabled={busy} onClick={() => void save()}>{t('Save changes')}</button>
        <div className="account-readonly-grid"><div><span>{t('Google account')}</span><strong>{props.user.email ?? t('Unavailable')}</strong><small>{t('Managed by Google')}</small></div><div><span>{t('School')}</span><strong>{t('Phichai School')}</strong></div><div><span>{t('Role')}</span><strong>{t(props.profile.role)}</strong></div></div>
      </section>
      <section className="account-card" aria-labelledby="privacy-heading"><h2 id="privacy-heading">{t('Privacy and delivery')}</h2><p>{t('Only you and authorized school staff can see your account details and private claim information. Export includes only information visible to your member account.')}</p><p>{t('Email delivery is unavailable. FoundIt does not send email notifications.')}</p></section>
      <section className="account-card" aria-labelledby="notifications-heading"><h2 id="notifications-heading">{t('Notifications')}</h2><label className="account-check"><input type="checkbox" checked={reportUpdates} onChange={(event) => setReportUpdates(event.target.checked)} />{t('Report updates')}</label><label className="account-check"><input type="checkbox" checked={claimUpdates} onChange={(event) => setClaimUpdates(event.target.checked)} />{t('Claim and lead updates')}</label>
        <h3>{t('In-app notifications')}</h3>{props.notifications.length === 0 ? <p>{t('No notifications yet.')}</p> : <ul className="account-list">{props.notifications.map((item) => <li key={item.id}><span><strong>{t(item.event_type)}</strong><small>{formatDate(item.created_at)}</small></span>{item.read_at ? <span className="account-status">{t('Read')}</span> : <button type="button" className="button secondary" disabled={busy} onClick={() => void act(() => props.onMarkRead(item.id), 'Notification marked as read.')}>{t('Mark as read')}</button>}</li>)}</ul>}
      </section>
      <section className="account-card" aria-labelledby="language-heading"><h2 id="language-heading">{t('Language')}</h2><div className="account-language"><label><input type="radio" name="account-language" value="en" checked={savedLanguage === 'en'} onChange={() => setSavedLanguage('en')} /> English</label><label><input type="radio" name="account-language" value="th" checked={savedLanguage === 'th'} onChange={() => setSavedLanguage('th')} /> ไทย</label></div></section>
      <section className="account-card" aria-labelledby="activity-heading"><h2 id="activity-heading">{t('Your activity')}</h2><h3>{t('Your reports')}</h3>{props.reports.length === 0 ? <p>{t('No reports yet.')}</p> : <ul className="account-list">{props.reports.map((item) => <li key={item.id}><span><strong>{item.title}</strong><small>{t(item.status)} · {formatDate(item.created_at)}</small></span></li>)}</ul>}<h3>{t('Your claims')}</h3>{props.claims.length === 0 ? <p>{t('No claims yet.')}</p> : <ul className="account-list">{props.claims.map((item) => <li key={item.id}><span><strong>{t('Claim')}</strong><small>{t(item.status)} · {formatDate(item.created_at)}</small></span></li>)}</ul>}</section>
      <section className="account-card" aria-labelledby="data-heading"><h2 id="data-heading">{t('Your data')}</h2><p>{t('Download a JSON copy of your own account data, reports, claims, notifications, and request history.')}</p><button type="button" className="button secondary" disabled={busy} onClick={() => void act(props.onExport, 'Your data export is ready.')}>{t('Download my data')}</button></section>
      <section className="account-card" aria-labelledby="requests-heading"><h2 id="requests-heading">{t('Account deletion request')}</h2><p>{t('A request is reviewed by your school. FoundIt does not automatically delete your account or existing reports.')}</p>{openRequest && <p className="account-status">{t('Request already open')}</p>}<button type="button" className="button secondary" disabled={busy || openRequest} onClick={(event) => { returnFocusRef.current = event.currentTarget; setDialog('deletion'); }}>{t('Request account deletion')}</button><h3>{t('Request history')}</h3>{props.requests.length === 0 ? <p>{t('No requests yet.')}</p> : <ul className="account-list">{props.requests.map((item) => <li key={item.id}><span><strong>{t(item.status)}</strong><small>{formatDate(item.created_at)}</small></span></li>)}</ul>}</section>
      <section className="account-card" aria-labelledby="security-heading"><h2 id="security-heading">{t('Sign out')}</h2><p>{t('Google security settings are managed by Google. Global sign-out ends this app session, but existing access tokens can remain valid until they expire.')}</p><button type="button" className="button secondary" onClick={(event) => { returnFocusRef.current = event.currentTarget; setScope('local'); setDialog('signout'); }}>{t('Sign out on this device')}</button><button type="button" className="button secondary" onClick={(event) => { returnFocusRef.current = event.currentTarget; setScope('global'); setDialog('signout'); }}>{t('Sign out globally')}</button></section>
    </>}
    {dialog && <div className="account-dialog-backdrop"><section ref={dialogRef} className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title" tabIndex={-1}><h2 id="account-dialog-title">{dialog === 'signout' ? t('Confirm sign out') : t('Confirm deletion request')}</h2><p>{dialog === 'signout' ? t(scope === 'global' ? 'Sign out of all devices?' : 'Sign out on this device?') : t('Submit a request for your school to review?')}</p>{dialog === 'signout' && <p>{t('Existing access tokens can remain valid until they expire.')}</p>}<div className="account-dialog-actions"><button type="button" className="button secondary" onClick={() => setDialog(null)}>{t('Cancel')}</button><button type="button" className="button primary" disabled={busy} onClick={() => dialog === 'signout' ? void signOut() : void requestDeletion()}>{t(dialog === 'signout' ? 'Confirm sign out' : 'Submit request')}</button></div></section></div>}
    {busy && <span className="visually-hidden" role="status">{t('Saving…')}</span>}
  </section>;
}

export default AccountSettingsView;
