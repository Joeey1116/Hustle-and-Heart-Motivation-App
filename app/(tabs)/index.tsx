import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import type { ShotHandle } from '../../components/QuoteCard';
import { ImmersiveQuote } from '../../components/ImmersiveQuote';
import { QuoteCard } from '../../components/QuoteCard';
import { StreakCard } from '../../components/StreakCard';
import { type TrackId } from '../../lib/brand';
import { getLanguage, useStrings } from '../../lib/i18n';
import { getQuoteOfTheDay, getRandomQuote, type Quote } from '../../lib/quotes';
import {
  getChosenTracks,
  getFavorites,
  getFreezeCount,
  getMoodHistory,
  getStreak,
  grantFreeFreezes,
  recordDailyQuote,
  recordOpen,
  todayKey,
  toggleFavorite,
} from '../../lib/storage';
import { refreshQuoteLiveActivity } from '../../lib/liveActivity';
import { syncMyStreak } from '../../lib/social';
import { useTheme } from '../../lib/themeContext';

/** Emotions that call for a calming quote (3.0 mood matching). */
const CALMING_EMOTIONS = ['anxious', 'stressed', 'overwhelmed', 'sad', 'lonely', 'tired', 'frustrated'];
/** Emotions that call for a pushing quote. */
const PUSHING_EMOTIONS = ['energized', 'motivated', 'hopeful', 'grateful', 'joyful'];

const CALM_TRACKS: TrackId[] = ['gratitude', 'faith-christian', 'faith-jewish', 'resilience'];
const PUSH_TRACKS: TrackId[] = ['motivation', 'hustle'];

/** expo-speech locale per app language. */
const SPEECH_LOCALE: Record<string, string> = { en: 'en-US', es: 'es-ES', he: 'he-IL' };

export default function Today() {
  const { t, lang } = useStrings();
  // Theme comes from the app-wide provider (build 20) — a selection in
  // Settings recolors this screen in the same render pass, no refetch.
  const { themeId, palette } = useTheme();
  const [tracks, setTracks] = useState<TrackId[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [streak, setStreak] = useState(0);
  const [freezes, setFreezes] = useState(0);
  const [isFav, setIsFav] = useState(false);
  const [heartsToday, setHeartsToday] = useState(0);
  const [listening, setListening] = useState(false);
  const shotRef = useRef<ShotHandle | null>(null);
  const streakShotRef = useRef<ShotHandle | null>(null);

  // One small action for today, tied to the quote's track — rotates
  // between the two actions per track by day of year (3.0).
  const smallAction = useMemo(() => {
    if (!quote) return null;
    const track = quote.tracks[0];
    const yearStart = new Date(new Date().getFullYear(), 0, 0).getTime();
    const dayOfYear = Math.floor((Date.now() - yearStart) / 86_400_000);
    const key = `actions.${track}.${dayOfYear % 2}`;
    const text = t(key);
    return text === key ? null : text;
  }, [quote, lang]);

  const stopListening = useCallback(async () => {
    try {
      await Speech.stop();
    } catch {
      // Speech may not be speaking — safe to ignore.
    }
    setListening(false);
  }, []);

  const onListen = useCallback(async () => {
    if (listening) {
      await stopListening();
      return;
    }
    if (!quote) return;
    setListening(true);
    try {
      await Speech.speak(quote.text, {
        language: SPEECH_LOCALE[getLanguage()] ?? 'en-US',
        onDone: () => setListening(false),
        onStopped: () => setListening(false),
        onError: () => setListening(false),
      });
    } catch {
      setListening(false);
    }
  }, [listening, quote, stopListening]);

  // Stop reading aloud when leaving the Today screen.
  useFocusEffect(
    useCallback(() => {
      return () => {
        void stopListening();
      };
    }, [stopListening])
  );

  const load = useCallback(async () => {
    const l = getLanguage();
    const tr = await getChosenTracks();
    setTracks(tr);
    // 3.0 — mood-matched quote: if the user checked in a mood today,
    // the quote leans toward what that mood needs. No check-in, or a
    // neutral mood, keeps the normal daily quote.
    let effectiveTracks = tr;
    try {
      const history = await getMoodHistory();
      const todayMood = history.find((m) => m.date === todayKey());
      const emotions = todayMood?.emotions ?? [];
      if (emotions.some((e) => CALMING_EMOTIONS.includes(e))) {
        const calm = tr.filter((t) => CALM_TRACKS.includes(t));
        if (calm.length > 0) effectiveTracks = calm;
      } else if (emotions.some((e) => PUSHING_EMOTIONS.includes(e))) {
        const push = tr.filter((t) => PUSH_TRACKS.includes(t));
        if (push.length > 0) effectiveTracks = push;
      }
    } catch {
      // Mood lookup is best-effort — the daily quote must never fail.
    }
    const q = await getQuoteOfTheDay(l, effectiveTracks);
    setQuote(q);
    const { streak: s, freezeUsed } = await recordOpen();
    // Free freezes earned in-app (first one free, one per 7-day streak
    // milestone) — grantFreeFreezes is idempotent, so re-running load()
    // on focus is safe. At most one alert per open: a freeze that saved
    // the streak explains itself first, then a milestone, then the
    // welcome freeze (React Native only shows the last alert if two
    // are fired back to back).
    const grants = await grantFreeFreezes(s);
    setStreak(s);
    // 3.0 (social): publish my streak so a linked partner can see it.
    // Best effort — no-op when offline / not signed in / tables missing.
    void syncMyStreak(s);
    setFreezes(await getFreezeCount());
    // A freeze was spent to save the streak after a missed day — tell
    // the user exactly once (recordOpen only reports it on that first
    // open, so re-running load() on focus won't repeat the alert).
    if (freezeUsed) {
      Alert.alert(t('today.freezeUsedTitle'), t('today.freezeUsedBody'));
    } else if (grants.milestone) {
      Alert.alert(
        t('today.freezeMilestoneTitle'),
        t('today.freezeMilestoneBody', { n: grants.milestoneDays })
      );
    } else if (grants.welcome) {
      Alert.alert(t('today.freezeWelcomeTitle'), t('today.freezeWelcomeBody'));
    }
    if (q) {
      const favs = await getFavorites();
      setIsFav(favs.includes(q.id));
      setHeartsToday(Math.min(favs.length, 5));
      // 3.0 — remember today's quote so History can show the last 7 days.
      await recordDailyQuote(q.id);
      await refreshQuoteLiveActivity(q);
    }
  }, []);

  // Theme changes in Settings must reflect on return — reload on every focus.
  // recordOpen() is idempotent per day, so re-running load() is safe.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Language switches also rebuild the quote.
  useEffect(() => {
    load();
  }, [load, lang]);

  const newQuote = async () => {
    await stopListening();
    const q = await getRandomQuote(getLanguage(), tracks, quote?.id);
    if (!q) return;
    setQuote(q);
    setIsFav((await getFavorites()).includes(q.id));
  };

  const onFavorite = async () => {
    if (!quote) return;
    const fav = await toggleFavorite(quote.id);
    setIsFav(fav);
    setHeartsToday(Math.min((await getFavorites()).length, 5));
  };

  const onShare = async () => {
    try {
      const uri = await shotRef.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri);
      }
    } catch {
      // share cancelled or unavailable — non-fatal
    }
  };

  // 3.0 — share the streak as an image (same hidden-card pattern as
  // the quote share). Outbound share-sheet only, no accounts.
  const onShareStreak = async () => {
    try {
      const uri = await streakShotRef.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri);
      }
    } catch {
      // share cancelled or unavailable — non-fatal
    }
  };

  if (!quote) {
    return <View style={[styles.loading, { backgroundColor: palette.background }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <ImmersiveQuote
        quote={quote}
        themeId={themeId}
        streak={streak}
        freezes={freezes}
        heartsToday={heartsToday}
        isFav={isFav}
        onFavorite={onFavorite}
        onShare={onShare}
        onNewQuote={newQuote}
        onListen={onListen}
        listening={listening}
        smallAction={smallAction}
        onShareStreak={onShareStreak}
      />
      {/* Hidden share card for image export */}
      <View style={styles.hidden}>
        <QuoteCard quote={quote} shotRef={shotRef} />
      </View>
      {/* Hidden streak card for image export (3.0) */}
      <View style={styles.hidden}>
        <StreakCard streak={streak} shotRef={streakShotRef} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
  },
  hidden: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: 400,
  },
});
