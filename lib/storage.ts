import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRAND, TRACKS, type TrackId } from './brand';

const P = BRAND.STORAGE_PREFIX;
const KEYS = {
  FAVORITES: `${P}/favorites`,
  LAST_OPEN: `${P}/last_open_date`,
  STREAK: `${P}/streak`,
  GRATITUDE_PREFIX: `${P}/gratitude/`,
  ONBOARDED: `${P}/onboarded`,
  NOTIF_SCHEDULED_THROUGH: `${P}/notif_scheduled_through`,
  TRACKS: `${P}/tracks`,
  NOTIF_ENABLED: `${P}/notif_enabled`,
  GOALS: `${P}/goals`,
  REMINDER_TIME: `${P}/reminder_time`,
  PLAN: `${P}/plan`,
  LIFETIME: `${P}/lifetime_owned`,
  FREEZES: `${P}/streak_freezes`,
  THEME: `${P}/theme`,
  COMPANION: `${P}/companion_enabled`,
  BUDDY: `${P}/buddy_enabled`,
  RITUALS: `${P}/rituals_enabled`,
  MOOD_HISTORY: `${P}/mood_history`,
  VENT_ENTRIES: `${P}/vent_entries`,
  BREATHE_SESSIONS: `${P}/breathe_sessions`,
  USER_NAME: `${P}/user_name`,
} as const;

function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local calendar-day key (YYYY-MM-DD) — the one true "today" for storage. */
export function todayKey(): string {
  return dayKey();
}

// ---------- Favorites ----------
export async function getFavorites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.FAVORITES);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const favs = await getFavorites();
  const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
  await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(next));
  return next.includes(id);
}

// ---------- Tracks ----------
const DEFAULT_TRACKS: TrackId[] = ['motivation', 'gratitude', 'resilience'];

export async function getChosenTracks(): Promise<TrackId[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.TRACKS);
    if (!raw) return DEFAULT_TRACKS;
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((t): t is TrackId => (TRACKS as readonly string[]).includes(t));
    return valid.length > 0 ? valid : DEFAULT_TRACKS;
  } catch {
    return DEFAULT_TRACKS;
  }
}

export async function setChosenTracks(tracks: TrackId[]): Promise<void> {
  const valid = tracks.filter((t) => (TRACKS as readonly string[]).includes(t));
  await AsyncStorage.setItem(KEYS.TRACKS, JSON.stringify(valid.length > 0 ? valid : DEFAULT_TRACKS));
}

// ---------- Streak ----------
/**
 * Call on every app foreground. Returns the current streak and whether a
 * Streak Freeze stepped in to save it (only ever true on the first open
 * after a missed day, so callers can celebrate it exactly once).
 */
export async function recordOpen(): Promise<{ streak: number; freezeUsed: boolean }> {
  const today = dayKey();
  try {
    const last = await AsyncStorage.getItem(KEYS.LAST_OPEN);
    let streak = parseInt((await AsyncStorage.getItem(KEYS.STREAK)) ?? '0', 10) || 0;
    if (last === today) return { streak, freezeUsed: false };
    const yesterday = dayKey(new Date(Date.now() - 86_400_000));
    const dayBefore = dayKey(new Date(Date.now() - 2 * 86_400_000));
    let freezeUsed = false;
    if (last === yesterday) {
      streak += 1;
    } else if (last === dayBefore && (await useFreeze())) {
      // Exactly one day missed and a freeze was banked: the freeze bridges
      // the gap, so the streak continues instead of resetting to 1.
      streak += 1;
      freezeUsed = true;
    } else {
      streak = 1;
    }
    await AsyncStorage.multiSet([
      [KEYS.LAST_OPEN, today],
      [KEYS.STREAK, String(streak)],
    ]);
    return { streak, freezeUsed };
  } catch {
    return { streak: 0, freezeUsed: false };
  }
}

export async function getStreak(): Promise<number> {
  try {
    return parseInt((await AsyncStorage.getItem(KEYS.STREAK)) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

// ---------- Streak freezes (2.0 consumable) ----------
/** How many Streak Freezes are banked. Each one saves the streak once. */
export async function getFreezeCount(): Promise<number> {
  try {
    return parseInt((await AsyncStorage.getItem(KEYS.FREEZES)) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

/** Bank n freezes (after a consumable purchase). Returns the new count. */
export async function addFreezes(n: number): Promise<number> {
  const next = (await getFreezeCount()) + n;
  await AsyncStorage.setItem(KEYS.FREEZES, String(next));
  return next;
}

/** Spend one banked freeze if any are available. True when one was used. */
export async function useFreeze(): Promise<boolean> {
  const count = await getFreezeCount();
  if (count <= 0) return false;
  await AsyncStorage.setItem(KEYS.FREEZES, String(count - 1));
  return true;
}

// ---------- Lifetime Haven Plus (2.0 non-consumable) ----------
/** True when this device owns Lifetime Haven Plus (one-time purchase). */
export async function isLifetimeOwned(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.LIFETIME)) === '1';
}

export async function setLifetimeOwned(owned: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.LIFETIME, owned ? '1' : '0');
}

// ---------- Gratitude journal ----------
export async function getGratitude(date = new Date()): Promise<string> {
  try {
    return (await AsyncStorage.getItem(KEYS.GRATITUDE_PREFIX + dayKey(date))) ?? '';
  } catch {
    return '';
  }
}

export async function setGratitude(text: string, date = new Date()): Promise<void> {
  await AsyncStorage.setItem(KEYS.GRATITUDE_PREFIX + dayKey(date), text);
}

// ---------- Onboarding ----------
export async function hasOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.ONBOARDED)) === '1';
}

export async function setOnboarded(): Promise<void> {
  await AsyncStorage.setItem(KEYS.ONBOARDED, '1');
}

// ---------- Notifications ----------
export async function getNotifScheduledThrough(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.NOTIF_SCHEDULED_THROUGH);
}

export async function setNotifScheduledThrough(dateKey: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIF_SCHEDULED_THROUGH, dateKey);
}

export async function isNotifEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.NOTIF_ENABLED)) === '1';
}

export async function setNotifEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.NOTIF_ENABLED, on ? '1' : '0');
}

// ---------- Goals ----------
export async function getGoals(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.GOALS);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function setGoals(goals: string[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
}

// ---------- Reminder time ----------
export async function getReminderTime(): Promise<string> {
  return (await AsyncStorage.getItem(KEYS.REMINDER_TIME)) ?? '8am';
}

export async function setReminderTime(time: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.REMINDER_TIME, time);
}

// ---------- User name ----------
export async function getUserName(): Promise<string> {
  return (await AsyncStorage.getItem(KEYS.USER_NAME)) ?? '';
}

export async function setUserName(name: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER_NAME, name);
}

// ---------- Plan (free / premium) ----------
export type PlanId = 'haven' | 'haven-plus';
export async function getPlan(): Promise<PlanId> {
  const raw = await AsyncStorage.getItem(KEYS.PLAN);
  return raw === 'haven-plus' ? 'haven-plus' : 'haven';
}

export async function setPlan(plan: PlanId): Promise<void> {
  await AsyncStorage.setItem(KEYS.PLAN, plan);
}

// ---------- Theme ----------
export async function getThemeId(): Promise<string> {
  return (await AsyncStorage.getItem(KEYS.THEME)) ?? 'midnight';
}

export async function setThemeId(id: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.THEME, id);
}

// ---------- Personalization (virtual home features) ----------
// NOTE (2.0): the Haven AI companion + streak buddy were removed, so
// isCompanionEnabled / setCompanionEnabled / isStreakBuddyEnabled /
// setStreakBuddyEnabled were deleted with them. The stored flags
// (KEYS.COMPANION / KEYS.BUDDY) are left in AsyncStorage untouched.
export async function isRitualsEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEYS.RITUALS);
  return raw !== '0'; // Default on
}

export async function setRitualsEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.RITUALS, on ? '1' : '0');
}

// ---------- Mood history ----------
export interface MoodEntry {
  date: string;
  valence: number;
  emotions: string[];
}

export async function getMoodHistory(): Promise<MoodEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MOOD_HISTORY);
    return raw ? (JSON.parse(raw) as MoodEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveMood(valence: number, emotions: string[]): Promise<void> {
  const history = await getMoodHistory();
  // Local day key, NOT toISOString() (UTC): an evening check-in after
  // 8 PM ET was stored under TOMORROW's date, and two check-ins on the
  // same local day could land on different stored dates (build 19 fix —
  // the check-in looked like it "didn't save").
  const today = dayKey();
  const filtered = history.filter((h) => h.date !== today);
  filtered.push({ date: today, valence, emotions });
  await AsyncStorage.setItem(KEYS.MOOD_HISTORY, JSON.stringify(filtered));
}

// ---------- Vent entries ----------
export interface VentEntry {
  id: string;
  text: string;
  date: string;
}

export async function getVentEntries(): Promise<VentEntry[]> {
  const raw = await AsyncStorage.getItem(KEYS.VENT_ENTRIES);
  return raw ? JSON.parse(raw) : [];
}

export async function saveVent(text: string): Promise<void> {
  const entries = await getVentEntries();
  entries.unshift({
    id: Date.now().toString(),
    text,
    date: new Date().toLocaleDateString(),
  });
  await AsyncStorage.setItem(KEYS.VENT_ENTRIES, JSON.stringify(entries.slice(0, 100)));
}

export async function deleteVent(id: string): Promise<void> {
  const entries = await getVentEntries();
  await AsyncStorage.setItem(
    KEYS.VENT_ENTRIES,
    JSON.stringify(entries.filter((e) => e.id !== id))
  );
}

// ---------- Full local wipe (account deletion) ----------
/**
 * Remove EVERYTHING this app stored on the device: all keys under the
 * brand storage prefix (favorites, journal, streaks, mood, vent entries,
 * plan, theme, onboarding flag, ...) plus imported-music bookkeeping.
 * Used by account deletion so the device returns to a first-run state.
 * Imported music FILES are deleted by the caller (lib/music helpers).
 */
export async function clearAllLocalData(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(
      (k) => k.startsWith(`${P}/`) || k === '@hustle-heart.imported-tracks'
    );
    if (ours.length > 0) {
      await AsyncStorage.multiRemove(ours);
    }
  } catch {
    // Best effort — deletion continues even if a key resists removal.
  }
}

// ---------- Breathe sessions ----------
export async function logBreatheSession(exerciseId: string, minutes: number): Promise<void> {
  const raw = await AsyncStorage.getItem(KEYS.BREATHE_SESSIONS);
  const sessions = raw ? JSON.parse(raw) : [];
  sessions.push({ date: new Date().toISOString(), exerciseId, minutes });
  await AsyncStorage.setItem(KEYS.BREATHE_SESSIONS, JSON.stringify(sessions));
}
