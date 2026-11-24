import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Glass } from '../../components/Glass';
import { Radius, Spacing, Type } from '../../lib/design';
import { useTheme } from '../../lib/themeContext';
import type { ThemePalette } from '../../lib/themes';
import { getLanguage, trackDesc, trackName, useStrings } from '../../lib/i18n';
import { getQuotes, getQuotesByTrack, type Quote } from '../../lib/quotes';
import {
  getChosenTracks,
  getFavorites,
  getQuoteHistory,
  toggleFavorite,
  type QuoteHistoryEntry,
} from '../../lib/storage';
import { TRACKS, type TrackId } from '../../lib/brand';

type Segment = 'browse' | 'saved' | 'history';

export default function Browse() {
  const { t, lang } = useStrings();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  // 3.0 — the hearts on Today open Browse on Saved via ?segment=saved.
  const { segment: segParam } = useLocalSearchParams<{ segment?: string }>();
  const [segment, setSegment] = useState<Segment>(segParam === 'saved' ? 'saved' : 'browse');
  const [tracks, setTracks] = useState<TrackId[]>([]);
  const [active, setActive] = useState<TrackId | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<Quote[]>([]);
  // 3.0 — quote history: the last 7 days of daily quotes.
  const [historyItems, setHistoryItems] = useState<{ entry: QuoteHistoryEntry; quote: Quote }[]>([]);

  // The param can arrive while Browse is already mounted (hearts tapped
  // from Today while Browse sits in the tab stack) — react to it.
  useEffect(() => {
    if (segParam === 'saved') setSegment('saved');
  }, [segParam]);

  useEffect(() => {
    getChosenTracks().then((tr) => {
      setTracks(tr);
      setActive((prev) => prev ?? tr[0] ?? null);
    });
    getFavorites().then(setFavs);
  }, [lang]);

  useEffect(() => {
    if (active) getQuotesByTrack(getLanguage(), active).then(setQuotes);
  }, [active, lang]);

  useEffect(() => {
    if (segment !== 'saved') return;
    (async () => {
      const favIds = await getFavorites();
      const all = await getQuotes(getLanguage(), await getChosenTracks());
      setSavedQuotes(all.filter((q) => favIds.includes(q.id)));
    })();
  }, [segment, lang]);

  // 3.0 — history: resolve each stored daily-quote id to its text.
  // Look across ALL tracks (a quote may belong to a track the user
  // has since un-chosen); entries without a match are dropped.
  useEffect(() => {
    if (segment !== 'history') return;
    (async () => {
      const entries = await getQuoteHistory();
      const all = await getQuotes(getLanguage(), [...TRACKS]);
      const byId = new Map(all.map((q) => [q.id, q]));
      setHistoryItems(
        entries
          .map((entry) => ({ entry, quote: byId.get(entry.quoteId) }))
          .filter((item): item is { entry: QuoteHistoryEntry; quote: Quote } => item.quote !== undefined)
      );
    })();
  }, [segment, lang]);

  const onFav = async (id: string) => {
    await toggleFavorite(id);
    const updated = await getFavorites();
    setFavs(updated);
    if (segment === 'saved') {
      const all = await getQuotes(getLanguage(), await getChosenTracks());
      setSavedQuotes(all.filter((q) => updated.includes(q.id)));
    }
  };

  const historyDate = (dateKey: string) => {
    const d = new Date(`${dateKey}T12:00:00`);
    return d.toLocaleDateString(
      lang === 'he' ? 'he-IL' : lang === 'es' ? 'es-ES' : 'en-US',
      { weekday: 'short', month: 'short', day: 'numeric' }
    );
  };

  const renderQuoteCard = (q: Quote, showTrack = false) => (
    <Glass key={q.id} style={styles.card}>
      {showTrack ? <Text style={styles.track}>{trackName(q.tracks[0]).toUpperCase()}</Text> : null}
      <Text style={styles.quote}>{q.text}</Text>
      {q.fallback === true ? <Text style={styles.fallback}>{t('today.fallbackNote')}</Text> : null}
      <Pressable onPress={() => onFav(q.id)} style={styles.favRow}>
        <Ionicons
          name={favs.includes(q.id) ? 'heart' : 'heart-outline'}
          size={20}
          color={favs.includes(q.id) ? '#ff4d6d' : palette.textDim}
        />
      </Pressable>
    </Glass>
  );

  const segmentLabel = (s: Segment) =>
    s === 'browse' ? t('browse.title') : s === 'saved' ? t('favorites.title') : t('history.title');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>{t('browse.title')}</Text>
        {/* 3.0 — Quote Packs (Haven Plus): 7-day themed journeys. */}
        <Pressable onPress={() => router.push('/packs')}>
          <Glass style={styles.packsCard}>
            <Ionicons name="map-outline" size={28} color={palette.text} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{t('browse.packs')}</Text>
              <Text style={styles.cardDesc}>{t('browse.packsDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
          </Glass>
        </Pressable>
        <View style={styles.segments}>
          {(['browse', 'saved', 'history'] as Segment[]).map((s) => (
            <Pressable key={s} onPress={() => setSegment(s)} style={[styles.segment, segment === s && styles.segmentActive]}>
              <Text style={[styles.segmentText, segment === s && styles.segmentTextActive]}>
                {segmentLabel(s)}
              </Text>
            </Pressable>
          ))}
        </View>
        {segment === 'browse' ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {tracks.map((tr) => (
                <Pressable key={tr} onPress={() => setActive(tr)}>
                  <View style={[styles.chip, active === tr && styles.chipActive]}>
                    <Text style={[styles.chipText, active === tr && styles.chipTextActive]}>
                      {trackName(tr)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
            {active ? <Text style={styles.desc}>{trackDesc(active)}</Text> : null}
            <View style={styles.list}>
              {quotes.map((q) => renderQuoteCard(q))}
            </View>
          </>
        ) : segment === 'saved' ? (
          savedQuotes.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={48} color={palette.border} />
              <Text style={styles.emptyText}>{t('favorites.empty')}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {savedQuotes.map((q) => renderQuoteCard(q, true))}
            </View>
          )
        ) : historyItems.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={48} color={palette.border} />
            <Text style={styles.emptyText}>{t('history.empty')}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {historyItems.map(({ entry, quote }) => (
              <View key={entry.date}>
                <Text style={styles.historyDate}>{historyDate(entry.date)}</Text>
                {renderQuoteCard(quote, true)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(p: ThemePalette) {
  return StyleSheet.create({
  // paddingBottom clears the floating tab bar so the
  // last cards can scroll up past it instead of hiding behind it.
  body: { padding: Spacing.lg, paddingBottom: 120, gap: Spacing.md },
  h1: { ...Type.display, color: p.text },
  segments: { flexDirection: 'row', backgroundColor: p.surface, borderRadius: Radius.pill, padding: 4, gap: 4 },
  segment: { flex: 1, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: p.button },
  segmentText: { ...Type.body, color: p.textDim, fontWeight: '700' },
  segmentTextActive: { color: p.buttonText },
  chips: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  chip: { backgroundColor: p.surface, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: p.border },
  chipActive: { backgroundColor: p.button, borderColor: p.button },
  chipText: { ...Type.body, color: p.textDim, fontWeight: '700' },
  chipTextActive: { color: p.buttonText },
  desc: { ...Type.body, color: p.textDim },
  list: { gap: Spacing.sm },
  card: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: p.border, gap: Spacing.sm },
  quote: { color: p.text, fontSize: 17, fontWeight: '600', lineHeight: 26 },
  fallback: { color: p.textDim, fontSize: 11, fontStyle: 'italic' },
  favRow: { alignSelf: 'flex-end', padding: Spacing.xs },
  empty: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingTop: 60 },
  emptyText: { ...Type.title, color: p.textDim, fontWeight: '400', textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.xl },
  track: { ...Type.eyebrow, color: p.textDim, letterSpacing: 2 },
  // 3.0 — packs entry card + history dates.
  packsCard: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: p.border, gap: Spacing.md },
  cardInfo: { flex: 1 },
  cardTitle: { color: p.text, fontSize: 17, fontWeight: '700', marginBottom: Spacing.xs },
  cardDesc: { ...Type.caption, color: p.textDim },
  historyDate: { ...Type.caption, color: p.textDim, fontWeight: '700', marginTop: Spacing.sm },
  });
}
