import { type Language, type TrackId } from './brand';
import { getQuotes, type Quote } from './quotes';
import {
  getPackProgress,
  markPackDayDone,
  startPack,
  type PackProgress,
} from './storage';

/**
 * Quote Packs (3.0 — Haven Plus).
 * Three themed 7-day journeys built ENTIRELY from the existing bundled
 * quote pools — no new quote content in any language. Each pack draws
 * its quotes from the tracks that already carry that theme.
 */

export type PackId = 'dontquit' | 'faith' | 'gratitude';

export interface PackDef {
  id: PackId;
  tracks: TrackId[];
}

export const PACKS: PackDef[] = [
  { id: 'dontquit', tracks: ['motivation', 'resilience', 'hustle'] },
  { id: 'faith', tracks: ['faith-christian', 'faith-jewish'] },
  { id: 'gratitude', tracks: ['gratitude'] },
];

export const PACK_LENGTH = 7;

/** The quote for a given day (1-7) of a pack — deterministic per pack. */
export async function getPackQuote(
  lang: Language,
  packId: PackId,
  day: number,
): Promise<Quote | null> {
  const def = PACKS.find((p) => p.id === packId);
  if (!def) return null;
  const pool = await getQuotes(lang, def.tracks);
  if (pool.length === 0) return null;
  return pool[(day - 1) % pool.length];
}

/** All 7 quotes of a pack, in day order. */
export async function getPackQuotes(lang: Language, packId: PackId): Promise<Quote[]> {
  const out: Quote[] = [];
  for (let day = 1; day <= PACK_LENGTH; day++) {
    const q = await getPackQuote(lang, packId, day);
    if (q) out.push(q);
  }
  return out;
}

/** Which day of the pack the user is on (1-7), from the start date. */
export function currentPackDay(progress: PackProgress | undefined, today = new Date()): number {
  if (!progress) return 1;
  const start = new Date(`${progress.startedOn}T12:00:00`);
  const days = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.min(Math.max(days, 1), PACK_LENGTH);
}

export { getPackProgress, markPackDayDone, startPack };
export type { PackProgress };
