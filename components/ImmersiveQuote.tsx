import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { trackName, useStrings } from '../lib/i18n';
import { getTheme } from '../lib/themes';
import { Type } from '../lib/design';
import type { Quote } from '../lib/quotes';

interface Props {
  quote: Quote;
  themeId: string;
  streak: number;
  /** Banked Streak Freezes — shown when > 0 so the user knows they're protected. */
  freezes: number;
  heartsToday: number;
  isFav: boolean;
  onFavorite: () => void;
  onShare: () => void;
  onNewQuote: () => void;
  /** 3.0 — read the quote aloud. */
  onListen?: () => void;
  listening?: boolean;
  /** 3.0 — one small action tied to today's quote, or null to hide. */
  smallAction?: string | null;
  /** 3.0 — share the streak as an image (tap the streak badge). */
  onShareStreak?: () => void;
}

/**
 * Immersive full-screen quote experience.
 * BeaTrackFam black/white aesthetic — original, not copied from any app.
 */
export function ImmersiveQuote({
  quote,
  themeId,
  streak,
  freezes,
  heartsToday,
  isFav,
  onFavorite,
  onShare,
  onNewQuote,
  onListen,
  listening,
  smallAction,
  onShareStreak,
}: Props) {
  const { t } = useStrings();
  const theme = getTheme(themeId);
  const primaryTrack = quote.tracks[0];
  const insets = useSafeAreaInsets();
  // Floating Liquid Glass tab bar needs generous clearance
  const TAB_BAR_CLEARANCE = 110;

  return (
    <View style={styles.container}>
      <LinearGradient colors={theme.bg} style={StyleSheet.absoluteFill} />

      {/* Top: streak + hearts progress — tapping the streak badge
          shares it as an image (3.0); the hearts open Saved. */}
      <View style={[styles.topRow, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topLeft}>
          {/* 3.0 — tapping the streak badge shares it as an image. */}
          <Pressable
            onPress={onShareStreak}
            style={styles.streakBadge}
            hitSlop={10}
            accessibilityLabel={t('today.shareStreak')}
          >
            <Ionicons name="flame" size={16} color={theme.accent} />
            <Text style={[styles.streakText, { color: theme.text }]}>{streak}</Text>
          </Pressable>
          {/* Banked Streak Freezes — display-only, like the streak badge.
              Buying happens in Settings; a freeze is spent automatically
              when a day is missed (see recordOpen in lib/storage.ts). */}
          {freezes > 0 && (
            <View
              style={styles.streakBadge}
              accessibilityLabel={t('today.freezeCount', { n: freezes })}
            >
              <Ionicons name="snow" size={16} color={theme.accent} />
              <Text style={[styles.streakText, { color: theme.text }]}>{freezes}</Text>
            </View>
          )}
        </View>
        <View style={styles.topRight}>
          {/* 3.0 fix: the hearts used to push /(tabs)/favorites, a route
              that does not exist (favorites live in Browse as the Saved
              segment) — tapping them showed an "Unmatched Route" screen.
              They now open Browse directly on Saved. */}
          <Pressable
            onPress={() => router.push({ pathname: '/(tabs)/browse', params: { segment: 'saved' } })}
            style={styles.heartsRow}
            hitSlop={10}
            accessibilityLabel={t('favorites.title')}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <Ionicons
                key={i}
                name={i < heartsToday ? 'heart' : 'heart-outline'}
                size={18}
                color={i < heartsToday ? '#ff4d6d' : theme.muted}
              />
            ))}
          </Pressable>
          {/* Music is a full tab (2.0) — this is its home-tab entry point. */}
          <Pressable
            onPress={() => router.push('/(tabs)/music')}
            style={styles.streakBadge}
            hitSlop={10}
            accessibilityLabel={t('today.openMusic')}
          >
            <Ionicons name="musical-notes" size={16} color={theme.accent} />
          </Pressable>
        </View>
      </View>

      {/* Center: quote */}
      <View style={styles.quoteWrap}>
        <Text style={[styles.track, { color: theme.accent }]}>
          {trackName(primaryTrack).toUpperCase()}
        </Text>
        <Text style={[styles.quote, { color: theme.text }]}>{quote.text}</Text>
        <Text style={[styles.brand, { color: theme.muted }]}>HUSTLE &amp; HEART</Text>
        {/* 3.0 — one small action for today, tied to the quote's track. */}
        {smallAction ? (
          <Text style={[styles.smallAction, { color: theme.accent }]}>
            {t('today.oneSmallThing')} {smallAction}
          </Text>
        ) : null}
      </View>

      {/* Bottom: actions — clear of the floating tab bar */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
        <Pressable onPress={onShare} style={styles.actionBtn} hitSlop={12}>
          <Ionicons name="share-outline" size={28} color={theme.text} />
        </Pressable>
        <Pressable onPress={onNewQuote} style={styles.newQuoteBtn}>
          <Ionicons name="refresh" size={20} color="#000" />
          <Text style={styles.newQuoteText} numberOfLines={1}>
            {t('today.newQuote')}
          </Text>
        </Pressable>
        <Pressable onPress={onFavorite} style={styles.actionBtn} hitSlop={12}>
          <Ionicons
            name={isFav ? 'heart' : 'heart-outline'}
            size={28}
            color={isFav ? '#ff4d6d' : theme.text}
          />
        </Pressable>
        {/* 3.0 — listen to the quote read aloud (expo-speech). */}
        {onListen ? (
          <Pressable
            onPress={onListen}
            style={styles.actionBtn}
            hitSlop={12}
            accessibilityLabel={listening ? t('today.stopListening') : t('today.listen')}
          >
            <Ionicons
              name={listening ? 'stop' : 'volume-high'}
              size={28}
              color={listening ? theme.accent : theme.text}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakText: {
    fontSize: 15,
    fontWeight: '700',
  },
  heartsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quoteWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  track: {
    ...Type.eyebrow,
    marginBottom: 20,
  },
  quote: {
    ...Type.display,
    textAlign: 'center',
  },
  brand: {
    ...Type.eyebrow,
    marginTop: 24,
  },
  smallAction: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 8,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    // Nov 24, 2026 (3.0 build 34, on device): the row overflowed a 390pt
    // screen — share cut at the left edge, speaker cut at the right —
    // because 3x56 buttons + the ~170pt pill + 3x24 gaps + 2x20 padding
    // totalled ~450pt. Narrowed so the whole row fits even a 360pt
    // screen, and the pill may shrink (flexShrink) instead of pushing
    // buttons off-screen on anything narrower.
    gap: 10,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  actionBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newQuoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 30,
  },
  newQuoteText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
});
