import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  addApprovedDomain, changeSchoolMemberRole, createStorageLocation, fetchApprovedDomains, fetchSchoolAccountRequests,
  fetchSchoolMembers, fetchReviewSettings, fetchStorageLocations, normalizeApprovedDomain, removeApprovedDomain,
  removeStorageLocation, updateAccountRequestStatus, updateReviewSettings, updateStorageLocation,
  type AccountRequest, type AccountRequestStatus, type ApprovedDomain, type ReviewSettings, type SchoolMember, type SchoolRole, type StorageLocation,
} from '../lib/account-settings';
import type { FoundItProfile } from '../lib/live-reports';
import { t } from '../lib/i18n';

const withValue = (key: string, value: string) => t(key).replace('{value}', value);

export function SchoolSettingsView({ profile }: { profile: FoundItProfile }) {
  const [members, setMembers] = useState<SchoolMember[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, SchoolRole>>({});
  const [domains, setDomains] = useState<ApprovedDomain[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [rules, setRules] = useState<ReviewSettings>({ missing_reports_need_review: false, found_reports_need_review: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [domainError, setDomainError] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [locationResponsible, setLocationResponsible] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'domain' | 'location'; id: string; label: string } | null>(null);
  const confirmDialogRef = useRef<HTMLElement>(null);
  const confirmReturnFocusRef = useRef<HTMLElement | null>(null);
  const [requestStatuses, setRequestStatuses] = useState<Record<string, Exclude<AccountRequestStatus, 'open'>>>({});

  useEffect(() => {
    if (profile.role !== 'admin') return;
    let active = true;
    setLoading(true);
    void Promise.all([
      fetchSchoolMembers(profile.school_id), fetchApprovedDomains(profile.school_id), fetchStorageLocations(profile.school_id),
      fetchReviewSettings(profile.school_id), fetchSchoolAccountRequests(profile.school_id),
    ]).then(([nextMembers, nextDomains, nextLocations, nextRules, nextRequests]) => {
      if (!active) return;
      setMembers(nextMembers); setDomains(nextDomains); setLocations(nextLocations); setRules(nextRules); setRequests(nextRequests);
      setRequestStatuses(Object.fromEntries(nextRequests.map((item) => [item.id, item.status === 'open' ? 'received' : item.status])));
    }).catch(() => { if (active) setError(t('Unable to load school settings. Please try again.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profile.school_id]);

  useEffect(() => {
    if (!confirm) return;
    const element = confirmDialogRef.current;
    const buttons = element?.querySelectorAll<HTMLElement>('button');
    const first = buttons?.[0];
    const last = buttons?.[buttons.length - 1];
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setConfirm(null); return; }
      if (event.key !== 'Tab' || !first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    element?.addEventListener('keydown', onKeyDown);
    return () => { element?.removeEventListener('keydown', onKeyDown); confirmReturnFocusRef.current?.focus(); };
  }, [confirm]);

  if (profile.role !== 'admin') return null;
  const fail = (text: string) => { setMessage(''); setError(t(text)); };
  const succeed = (text: string) => { setError(''); setMessage(t(text)); };

  const saveRole = async (member: SchoolMember) => {
    const role = roleDrafts[member.id] ?? member.role;
    if (member.id === profile.id || role === member.role) return;
    setError(''); setMessage('');
    try {
      await changeSchoolMemberRole(member.id, role);
      setMembers((current) => current.map((item) => item.id === member.id ? { ...item, role } : item));
      succeed('Member role saved.');
    } catch { fail('Could not save this role. Another administrator may need to remain assigned.'); }
  };

  const addDomain = async (event: FormEvent) => {
    event.preventDefault(); setDomainError(''); setError(''); setMessage('');
    let normalized: string;
    try { normalized = normalizeApprovedDomain(domainInput); } catch { setDomainError(t('Enter a valid email domain.')); return; }
    if (domains.some((item) => item.domain === normalized)) { setDomainError(t('This domain is already approved.')); return; }
    try {
      const created = await addApprovedDomain(profile.school_id, normalized);
      setDomains((current) => [...current, created]); setDomainInput(''); succeed('Approved domain added.');
    } catch { fail('Could not add this domain. Please check it and try again.'); }
  };

  const removeDomain = async (id: string) => {
    try { await removeApprovedDomain(profile.school_id, id); setDomains((current) => current.filter((item) => item.id !== id)); setConfirm(null); succeed('Approved domain removed.'); }
    catch { setConfirm(null); fail('Could not remove this domain. Please try again.'); }
  };

  const saveLocation = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    const input = { label: locationLabel.trim(), responsible_name: locationResponsible.trim() };
    if (!input.label || !input.responsible_name || input.label.length > 120 || input.responsible_name.length > 120) { fail('Enter a location and responsible person (up to 120 characters each).'); return; }
    try {
      if (editId) {
        const updated = await updateStorageLocation(profile.school_id, editId, input); setLocations((current) => current.map((item) => item.id === editId ? updated : item));
      } else { const created = await createStorageLocation(profile.school_id, input); setLocations((current) => [...current, created]); }
      setEditId(null); setLocationLabel(''); setLocationResponsible(''); succeed('Storage location saved.');
    } catch { fail('Could not save this storage location. Please try again.'); }
  };

  const removeLocation = async (id: string) => {
    try { await removeStorageLocation(profile.school_id, id); setLocations((current) => current.filter((item) => item.id !== id)); setConfirm(null); succeed('Storage location removed.'); }
    catch { setConfirm(null); fail('Could not remove this location. It may be used by reports, so its history was kept.'); }
  };

  const saveRules = async () => {
    setError(''); setMessage('');
    try { const saved = await updateReviewSettings(profile.school_id, rules); setRules(saved); succeed('Review rules saved.'); }
    catch { fail('Could not save review rules. Please try again.'); }
  };

  const saveRequest = async (item: AccountRequest) => {
    const status = requestStatuses[item.id];
    if (!status) return;
    setError(''); setMessage('');
    try { const saved = await updateAccountRequestStatus(profile.school_id, item.id, status); setRequests((current) => current.map((request) => request.id === item.id ? saved : request)); succeed('Request status saved.'); }
    catch { fail('Could not update this request. Please try again.'); }
  };

  return <section className="board-page school-settings-page" aria-labelledby="school-settings-title">
    <div className="school-settings-heading"><div className="eyebrow"><span className="eyebrow-line purple" />{t('Administrator')}</div><h1 id="school-settings-title">{t('School settings')}</h1><p className="lede">{t('Manage members and access for Phichai School.')}</p></div>
    {loading && <p role="status">{t('Loading school settings…')}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="school-save-message" role="status">{message}</p>}
    {!loading && <div className="school-settings-grid">
      <section className="school-panel"><h2>{t('School members')}</h2><p>{t('Assign the appropriate school role to each member.')}</p>
        {members.length === 0 ? <p>{t('No school members found.')}</p> : <div className="school-member-list">{members.map((member) => <div className="school-setting-row" key={member.id}><div className="school-member-copy"><strong>{member.display_name}</strong><span>{member.email}</span></div><label>{withValue('Role for {value}', member.display_name)}<select aria-label={withValue('Role for {value}', member.display_name)} value={roleDrafts[member.id] ?? member.role} disabled={member.id === profile.id} onChange={(event) => setRoleDrafts((current) => ({ ...current, [member.id]: event.target.value as SchoolRole }))}>{(['student', 'teacher', 'moderator', 'admin'] as const).map((role) => <option value={role} key={role}>{t(role)}</option>)}</select></label><button className="button secondary" type="button" disabled={member.id === profile.id || (roleDrafts[member.id] ?? member.role) === member.role} aria-label={withValue('Save role for {value}', member.display_name)} onClick={() => void saveRole(member)}>{t('Save role')}</button></div>)}</div>}
      </section>
      <section className="school-panel"><h2>{t('Approved email domains')}</h2><p>{t('Only approved school domains can provision new school accounts.')}</p><p className="school-help">{t('Removing a domain blocks future sign-in and provisioning for it, but does not delete existing profile or report data.')}</p>
        {domains.length === 0 ? <p>{t('No approved domains yet.')}</p> : <ul className="school-setting-list">{domains.map((item) => <li key={item.id}><strong>{item.domain}</strong><button type="button" className="button secondary" aria-label={withValue('Remove {value}', item.domain)} disabled={domains.length <= 1} onClick={(event) => { confirmReturnFocusRef.current = event.currentTarget; setConfirm({ kind: 'domain', id: item.id, label: item.domain }); }}>{t('Remove')}</button></li>)}</ul>}
        {domains.length <= 1 && <p className="school-help">{t('At least one approved domain must remain.')}</p>}
        <form className="school-inline-form" onSubmit={(event) => void addDomain(event)}><label>{t('Approved domain')}<input value={domainInput} onChange={(event) => setDomainInput(event.target.value)} placeholder={t('example.org')} autoComplete="off" /></label><button className="button primary" type="submit">{t('Add domain')}</button></form>{domainError && <p className="form-error" role="alert">{domainError}</p>}
      </section>
      <section className="school-panel"><h2>{t('Storage locations')}</h2><p>{t('Locations may appear in report history.')}</p>
        {locations.length === 0 ? <p>{t('No storage locations yet.')}</p> : <ul className="school-setting-list">{locations.map((item) => <li key={item.id}><div><strong>{item.label}</strong><span>{t('Responsible')}: {item.responsible_name}</span></div><div className="school-row-actions"><button className="button secondary" type="button" onClick={() => { setEditId(item.id); setLocationLabel(item.label); setLocationResponsible(item.responsible_name); }}>{t('Edit')}</button><button className="button secondary" type="button" aria-label={withValue('Remove {value}', item.label)} onClick={(event) => { confirmReturnFocusRef.current = event.currentTarget; setConfirm({ kind: 'location', id: item.id, label: item.label }); }}>{t('Remove')}</button></div></li>)}</ul>}
        <form className="school-form" onSubmit={(event) => void saveLocation(event)}><label>{t('Location name')}<input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} maxLength={120} /></label><label>{t('Responsible person')}<input value={locationResponsible} onChange={(event) => setLocationResponsible(event.target.value)} maxLength={120} /></label><div className="school-row-actions"><button type="submit" className="button primary">{t(editId ? 'Save location' : 'Add location')}</button>{editId && <button type="button" className="button secondary" onClick={() => { setEditId(null); setLocationLabel(''); setLocationResponsible(''); }}>{t('Cancel')}</button>}</div></form>
      </section>
      <section className="school-panel"><h2>{t('Report review rules')}</h2><p>{t('These settings affect only new reports; existing reports keep their current review state.')}</p><label className="school-check"><input type="checkbox" checked={rules.missing_reports_need_review} onChange={(event) => setRules((value) => ({ ...value, missing_reports_need_review: event.target.checked }))} />{t('Missing reports need review')}</label><label className="school-check"><input type="checkbox" checked={rules.found_reports_need_review} onChange={(event) => setRules((value) => ({ ...value, found_reports_need_review: event.target.checked }))} />{t('Found reports need review')}</label><button className="button primary" type="button" onClick={() => void saveRules()}>{t('Save review rules')}</button></section>
      <section className="school-panel"><h2>{t('Account requests')}</h2><p>{t('Track requests for school review. Accounts and records are not automatically deleted.')}</p>
        {requests.length === 0 ? <p>{t('No account requests.')}</p> : <ul className="school-setting-list">{requests.map((item) => <li key={item.id}><div><strong>{item.id}</strong><span>{t('Request received')}</span></div><label>{withValue('Status for {value}', item.id)}<select aria-label={withValue('Status for {value}', item.id)} value={requestStatuses[item.id] ?? 'received'} onChange={(event) => setRequestStatuses((value) => ({ ...value, [item.id]: event.target.value as Exclude<AccountRequestStatus, 'open'> }))}><option value="received">{t('received')}</option><option value="in_progress">{t('in_progress')}</option><option value="completed">{t('completed')}</option></select></label><button className="button secondary" type="button" onClick={() => void saveRequest(item)}>{t('Save request status')}</button></li>)}</ul>}
      </section>
    </div>}
    {confirm && <div className="school-confirm-backdrop"><section ref={confirmDialogRef} className="school-confirm" role="alertdialog" aria-modal="true" aria-labelledby="school-confirm-title" aria-describedby="school-confirm-copy" tabIndex={-1}><h2 id="school-confirm-title">{confirm.kind === 'domain' ? t('Remove approved domain?') : t('Remove storage location?')}</h2><p id="school-confirm-copy">{confirm.kind === 'domain' ? t('Removing this domain blocks future sign-in and provisioning, but does not delete existing profile or report data.') : t('Removing this location may be blocked if reports refer to it. Existing report history must remain intact.')}</p><div className="school-row-actions"><button className="button secondary" type="button" onClick={() => setConfirm(null)}>{t('Cancel')}</button><button className="button primary" type="button" onClick={() => confirm.kind === 'domain' ? void removeDomain(confirm.id) : void removeLocation(confirm.id)}>{confirm.kind === 'domain' ? t('Confirm remove domain') : t('Confirm remove location')}</button></div></section></div>}
  </section>;
}

export default SchoolSettingsView;
