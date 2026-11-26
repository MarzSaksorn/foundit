import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const chain = { from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), signOut: vi.fn(), signInWithOAuth: vi.fn() };
  chain.from.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
});
vi.mock('./supabase', () => ({ supabase: { from: supabaseMock.from, auth: { signOut: supabaseMock.signOut, signInWithOAuth: supabaseMock.signInWithOAuth } } }));
import { signInWithGoogle, validateSchoolUser } from './auth';

const user = { id: 'u1', email: 'person@unrelated.example', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' };

describe('FoundIt school access', () => {
  beforeEach(() => vi.clearAllMocks());
  it('allows a user with an RLS-visible provisioned school profile regardless of email suffix', async () => {
    supabaseMock.maybeSingle.mockResolvedValue({ data: { id: 'u1', school_id: 'phichai-school-id' }, error: null });
    await expect(validateSchoolUser(user as never)).resolves.toMatchObject({ allowed: true, user });
    expect(supabaseMock.from).toHaveBeenCalledWith('profiles');
    expect(supabaseMock.eq).toHaveBeenCalledWith('id', 'u1');
  });
  it.each([null, { id: 'u1', school_id: null }])('rejects a missing or unprovisioned profile', async (profile) => {
    supabaseMock.maybeSingle.mockResolvedValue({ data: profile, error: null });
    await expect(validateSchoolUser(user as never)).resolves.toMatchObject({ allowed: false, user: null });
    expect(supabaseMock.signOut).toHaveBeenCalled();
  });
  it('starts Google sign-in without constraining the hosted domain', async () => {
    supabaseMock.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    await signInWithGoogle();
    const payload = supabaseMock.signInWithOAuth.mock.calls[0][0];
    expect(payload.options.queryParams).not.toHaveProperty('hd');
    expect(payload.options.queryParams.prompt).toBe('select_account');
  });
});
