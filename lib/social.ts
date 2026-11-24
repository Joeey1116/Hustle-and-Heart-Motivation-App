import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRAND } from './brand';
import { supabase, isSupabaseConfigured } from './supabase';
import { getUserName } from './storage';

const P = BRAND.STORAGE_PREFIX;

/**
 * Social (3.0) — accountability partner, shared challenges, encouragement
 * inbox. Local-first: invite codes, link state, and inbox are cached
 * on-device, so the screens always render. The live connection goes
 * through Supabase (tables + RPC in supabase/social.sql) when the app
 * is configured AND the user is signed in. Every remote call is
 * defensive: on any failure it reports a typed reason and the UI falls
 * back to the local state with a plain-language note.
 *
 * Backend reality (Nov 24, 2026): the Supabase project is reachable
 * and the anon key is valid, but schema.sql was never applied to it
 * (public.quotes does not exist), so until Joey runs schema.sql +
 * social.sql in the Supabase SQL editor, remote calls fail with
 * reason 'migration' and the features stay local-only.
 */

export interface PartnerInfo {
  id: string;
  name: string | null;
  streak: number;
  lastOpen: string | null; // yyyy-mm-dd or null
  updatedAt: string;
}

export interface ChallengeInfo {
  id: string;
  packId: string;
  partnerId: string;
  startedOn: string;
  status: string;
  myDays: number[];
  partnerDays: number[];
}

export interface Encouragement {
  id: string;
  fromId: string;
  fromName: string;
  text: string;
  date: string; // ISO
  read: boolean;
  mine: boolean;
}

export type SocialStatus = 'off' | 'signed-out' | 'ready';
export type SocialError = 'not-configured' | 'not-signed-in' | 'migration' | 'unknown';

export interface SocialResult<T = void> {
  ok: boolean;
  data?: T;
  error?: SocialError;
  message?: string;
}

const CODE_KEY = `${P}/social_code`;
const LINK_KEY = `${P}/social_link`;
const INBOX_KEY = `${P}/social_inbox`;

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function classifyError(e: any): SocialError {
  const msg = String(e?.message ?? e ?? '');
  if (/relation .* does not exist|PGRST205|could not find the table|function .* does not exist/i.test(msg)) {
    return 'migration';
  }
  return 'unknown';
}

async function myUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** 'off' = Supabase not configured in this build; 'signed-out' = configured but no session. */
export async function socialStatus(): Promise<SocialStatus> {
  if (!isSupabaseConfigured()) return 'off';
  const uid = await myUserId();
  return uid ? 'ready' : 'signed-out';
}

/** My invite code — generated once on-device, stable across launches. */
export async function getMyInviteCode(): Promise<string> {
  const existing = await AsyncStorage.getItem(CODE_KEY);
  if (existing) return existing;
  let code = '';
  const bytes = new Uint8Array(6);
  for (let i = 0; i < 6; i++) {
    bytes[i] = Math.floor(Math.random() * CODE_CHARS.length);
    code += CODE_CHARS[bytes[i]];
  }
  await AsyncStorage.setItem(CODE_KEY, code);
  return code;
}

/** Publish my invite code so a partner can find it (no-op when offline). */
export async function createInvite(): Promise<SocialResult<string>> {
  const code = await getMyInviteCode();
  if (!isSupabaseConfigured() || !supabase) return { ok: false, error: 'not-configured' };
  const uid = await myUserId();
  if (!uid) return { ok: false, error: 'not-signed-in' };
  try {
    const name = await getUserName();
    const { error } = await supabase
      .from('social_invites')
      .upsert({ code, inviter_id: uid, inviter_name: name || null });
    if (error) throw error;
    return { ok: true, data: code };
  } catch (e: any) {
    return { ok: false, error: classifyError(e), message: e?.message };
  }
}

/** Accept a partner's invite code. Returns the partner's user id. */
export async function acceptInvite(rawCode: string): Promise<SocialResult<string>> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: 'unknown', message: 'empty code' };
  if (!isSupabaseConfigured() || !supabase) return { ok: false, error: 'not-configured' };
  const uid = await myUserId();
  if (!uid) return { ok: false, error: 'not-signed-in' };
  try {
    const { data, error } = await supabase.rpc('accept_partner_invite', { p_code: code });
    if (error) throw error;
    const partnerId = String(data);
    await saveLocalLink({ id: partnerId, name: null, streak: 0, lastOpen: null, updatedAt: new Date().toISOString() });
    return { ok: true, data: partnerId };
  } catch (e: any) {
    return { ok: false, error: classifyError(e), message: e?.message };
  }
}

export async function getLocalLink(): Promise<PartnerInfo | null> {
  const raw = await AsyncStorage.getItem(LINK_KEY);
  return raw ? (JSON.parse(raw) as PartnerInfo) : null;
}

export async function saveLocalLink(p: PartnerInfo | null): Promise<void> {
  if (p) await AsyncStorage.setItem(LINK_KEY, JSON.stringify(p));
  else await AsyncStorage.removeItem(LINK_KEY);
}

/** Refresh the linked partner's streak from Supabase; falls back to the cached link. */
export async function fetchPartner(): Promise<PartnerInfo | null> {
  const cached = await getLocalLink();
  if (!isSupabaseConfigured() || !supabase) return cached;
  const uid = await myUserId();
  if (!uid) return cached;
  try {
    const { data, error } = await supabase
      .from('social_partners')
      .select('user_a, user_b')
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const partnerId = data.user_a === uid ? data.user_b : data.user_a;
    const { data: streakRow } = await supabase
      .from('social_streaks')
      .select('streak, last_open, display_name, updated_at')
      .eq('user_id', partnerId)
      .maybeSingle();
    const info: PartnerInfo = {
      id: partnerId,
      name: streakRow?.display_name ?? cached?.name ?? null,
      streak: streakRow?.streak ?? cached?.streak ?? 0,
      lastOpen: streakRow?.last_open ?? cached?.lastOpen ?? null,
      updatedAt: streakRow?.updated_at ?? new Date().toISOString(),
    };
    await saveLocalLink(info);
    return info;
  } catch {
    return cached;
  }
}

/** Publish my current streak so my partner can see it. Best effort. */
export async function syncMyStreak(streak: number): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const uid = await myUserId();
  if (!uid) return;
  try {
    const name = await getUserName();
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from('social_streaks').upsert({
      user_id: uid,
      streak,
      last_open: today,
      display_name: name || null,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Offline or tables missing — streak stays local; partner sees the cache.
  }
}

/** True when the partner's last open day is before yesterday. */
export function partnerMissedDay(partner: PartnerInfo | null): boolean {
  if (!partner?.lastOpen) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return partner.lastOpen < yesterday.toISOString().slice(0, 10);
}

/** Unlink: removes the partnership row server-side and clears the local link. */
export async function unlinkPartner(): Promise<SocialResult> {
  const cached = await getLocalLink();
  await saveLocalLink(null);
  if (!isSupabaseConfigured() || !supabase) return { ok: true };
  const uid = await myUserId();
  if (!uid) return { ok: true };
  try {
    const { error } = await supabase
      .from('social_partners')
      .delete()
      .or(`user_a.eq.${uid},user_b.eq.${uid}`);
    if (error) throw error;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: classifyError(e), message: e?.message };
  }
}

export async function startSharedChallenge(packId: string): Promise<SocialResult<ChallengeInfo>> {
  const partner = await getLocalLink();
  if (!partner) return { ok: false, error: 'unknown', message: 'no partner linked' };
  if (!isSupabaseConfigured() || !supabase) return { ok: false, error: 'not-configured' };
  const uid = await myUserId();
  if (!uid) return { ok: false, error: 'not-signed-in' };
  try {
    const { data, error } = await supabase
      .from('social_challenges')
      .insert({ pack_id: packId, user_a: uid, user_b: partner.id })
      .select('id, pack_id, started_on, status')
      .single();
    if (error) throw error;
    return {
      ok: true,
      data: {
        id: data.id,
        packId: data.pack_id,
        partnerId: partner.id,
        startedOn: data.started_on,
        status: data.status,
        myDays: [],
        partnerDays: [],
      },
    };
  } catch (e: any) {
    return { ok: false, error: classifyError(e), message: e?.message };
  }
}

export async function getActiveChallenge(): Promise<ChallengeInfo | null> {
  const partner = await getLocalLink();
  if (!partner) return null;
  if (!isSupabaseConfigured() || !supabase) return null;
  const uid = await myUserId();
  if (!uid) return null;
  try {
    const { data, error } = await supabase
      .from('social_challenges')
      .select('id, pack_id, started_on, status')
      .eq('status', 'active')
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const { data: days } = await supabase
      .from('social_challenge_days')
      .select('user_id, day')
      .eq('challenge_id', data.id);
    return {
      id: data.id,
      packId: data.pack_id,
      partnerId: partner.id,
      startedOn: data.started_on,
      status: data.status,
      myDays: (days ?? []).filter((d) => d.user_id === uid).map((d) => d.day),
      partnerDays: (days ?? []).filter((d) => d.user_id === partner.id).map((d) => d.day),
    };
  } catch {
    return null;
  }
}

export async function markChallengeDay(challengeId: string, day: number): Promise<SocialResult> {
  if (!isSupabaseConfigured() || !supabase) return { ok: false, error: 'not-configured' };
  const uid = await myUserId();
  if (!uid) return { ok: false, error: 'not-signed-in' };
  try {
    const { error } = await supabase
      .from('social_challenge_days')
      .upsert({ challenge_id: challengeId, user_id: uid, day });
    if (error) throw error;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: classifyError(e), message: e?.message };
  }
}

/** Day number of the challenge for today (1-based, from started_on). */
export function challengeToday(challenge: ChallengeInfo): number {
  const start = new Date(`${challenge.startedOn}T12:00:00`);
  const now = new Date();
  const days = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  return Math.min(7, Math.max(1, days));
}

export async function sendEncouragement(toId: string, text: string): Promise<SocialResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'unknown', message: 'empty' };
  if (!isSupabaseConfigured() || !supabase) return { ok: false, error: 'not-configured' };
  const uid = await myUserId();
  if (!uid) return { ok: false, error: 'not-signed-in' };
  try {
    const { error } = await supabase
      .from('social_encouragements')
      .insert({ from_id: uid, to_id: toId, text: trimmed.slice(0, 280) });
    if (error) throw error;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: classifyError(e), message: e?.message };
  }
}

export async function fetchInbox(): Promise<Encouragement[]> {
  const cachedRaw = await AsyncStorage.getItem(INBOX_KEY);
  const cached: Encouragement[] = cachedRaw ? JSON.parse(cachedRaw) : [];
  if (!isSupabaseConfigured() || !supabase) return cached;
  const uid = await myUserId();
  if (!uid) return cached;
  try {
    const { data, error } = await supabase
      .from('social_encouragements')
      .select('id, from_id, text, created_at, read')
      .eq('to_id', uid)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    const partner = await getLocalLink();
    const inbox: Encouragement[] = (data ?? []).map((r) => ({
      id: r.id,
      fromId: r.from_id,
      fromName: partner && r.from_id === partner.id ? partner.name ?? 'Your partner' : 'Your partner',
      text: r.text,
      date: r.created_at,
      read: r.read,
      mine: false,
    }));
    await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(inbox));
    return inbox;
  } catch {
    return cached;
  }
}

export async function markEncouragementRead(id: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  try {
    await supabase.from('social_encouragements').update({ read: true }).eq('id', id);
  } catch {
    // Non-fatal.
  }
}
