import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../components/Screen';
import { Glass } from '../components/Glass';
import { Radius, Spacing, Type } from '../lib/design';
import { useTheme } from '../lib/themeContext';
import type { ThemePalette } from '../lib/themes';
import { getLanguage, trackName, useStrings } from '../lib/i18n';
import { getPlan } from '../lib/storage';
import {
  PACKS,
  PACK_LENGTH,
  currentPackDay,
  getPackQuote,
  getPackProgress,
  markPackDayDone,
  startPack,
  type PackId,
  type PackProgress,
} from '../lib/packs';
import type { Quote } from '../lib/quotes';

/**
 * Quote Packs (3.0 — Haven Plus).
 * Three themed 7-day journeys drawn from the existing quote pools.
 * Free users see the packs locked and are sent to the standard
 * Haven Plus upgrade screen; Plus users open a pack, read one quote
 * a day, and mark days done. Progress is local-only (AsyncStorage).
 */
export default function PacksScreen() {
  const { t, lang } = useStrings();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [isPlus, setIsPlus] = useState(false);
  const [progress, setProgress] = useState<Record<string, PackProgress>>({});
  const [selected, setSelected] = useState<PackId | null>(null);
  const [day, setDay] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);

  const reload = useCallback(async () => {
    setIsPlus((await getPlan()) === 'haven-plus');
    setProgress(await getPackProgress());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const openPack = async (id: PackId) => {
    if (!isPlus) {
      router.push('/settings/upgrade');
      return;
    }
    let p = progress[id];
    if (!p) {
      p = await startPack(id);
      setProgress(await getPackProgress());
    }
    setSelected(id);
    setDay(currentPackDay(p));
  };

  useEffect(() => {
    if (!selected) return;
    getPackQuote(getLanguage(), selected, day).then(setQuote);
  }, [selected, day, lang]);

  const selectedProgress = selected ? progress[selected] : undefined;
  const today = selectedProgress ? currentPackDay(selectedProgress) : 1;
  const doneToday = selectedProgress?.doneDays.includes(today) ?? false;
  const complete = (selectedProgress?.doneDays.length ?? 0) >= PACK_LENGTH;

  const onMarkDone = async () => {
    if (!selected || !selectedProgress) return;
    await markPackDayDone(selected, today);
    setProgress(await getPackProgress());
  };

  const packName = (id: PackId) => t(`packs.${id}.name`);
  const packDesc = (id: PackId) => t(`packs.${id}.desc`);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {selected ? (
          <>
            <Pressable onPress={() => setSelected(null)} style={styles.backRow}>
              <Ionicons name="chevron-back" size={20} color={palette.textDim} />
              <Text style={styles.back}>{t('common.back')}</Text>
            </Pressable>
            <Text style={styles.h1}>{packName(selected)}</Text>
            <Text style={styles.desc}>{packDesc(selected)}</Text>
            <Text style={styles.dayLabel}>{t('packs.dayOf', { n: day })}</Text>
            {quote ? (
              <Glass style={styles.quoteCard}>
                <Text style={styles.track}>{trackName(quote.tracks[0]).toUpperCase()}</Text>
                <Text style={styles.quote}>{quote.text}</Text>
                {quote.fallback === true ? (
                  <Text style={styles.fallback}>{t('today.fallbackNote')}</Text>
                ) : null}
              </Glass>
            ) : null}
            <View style={styles.daysRow}>
              {Array.from({ length: PACK_LENGTH }, (_, i) => i + 1).map((d) => {
                const done = selectedProgress?.doneDays.includes(d) ?? false;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDay(d)}
                    style={[
                      styles.dayDot,
                      done && styles.dayDotDone,
                      d === day && styles.dayDotActive,
                    ]}
                  >
                    <Text style={[styles.dayDotText, done && styles.dayDotTextDone]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
            {complete ? (
              <Text style={styles.complete}>{t('packs.completed')}</Text>
            ) : day === today ? (
              doneToday ? (
                <Text style={styles.doneText}>{t('packs.doneToday')}</Text>
              ) : (
                <Pressable onPress={onMarkDone} style={styles.doneBtn}>
                  <Text style={styles.doneBtnText}>{t('packs.markDone')}</Text>
                </Pressable>
              )
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.h1}>{t('packs.title')}</Text>
            <Text style={styles.desc}>{t('packs.subtitle')}</Text>
            {PACKS.map((pack) => {
              const p = progress[pack.id];
              const current = p ? currentPackDay(p) : 1;
              const doneCount = p?.doneDays.length ?? 0;
              return (
                <Pressable key={pack.id} onPress={() => openPack(pack.id)}>
                  <Glass style={styles.card}>
                    <Ionicons
                      name={isPlus ? 'map-outline' : 'lock-closed-outline'}
                      size={28}
                      color={palette.text}
                    />
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitle}>{packName(pack.id)}</Text>
                      <Text style={styles.cardDesc}>{packDesc(pack.id)}</Text>
                      <Text style={styles.cardProgress}>
                        {isPlus
                          ? p
                            ? `${t('packs.dayOf', { n: current })} · ${doneCount}/${PACK_LENGTH}`
                            : t('packs.start')
                          : t('packs.lockedDesc')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
                  </Glass>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(p: ThemePalette) {
  return StyleSheet.create({
    body: { padding: Spacing.lg, paddingBottom: 120, gap: Spacing.md },
    h1: { ...Type.display, color: p.text },
    desc: { ...Type.body, color: p.textDim },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    back: { ...Type.body, color: p.textDim, fontWeight: '700' },
    card: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: p.border, gap: Spacing.md, marginTop: Spacing.sm },
    cardInfo: { flex: 1 },
    cardTitle: { color: p.text, fontSize: 17, fontWeight: '700', marginBottom: Spacing.xs },
    cardDesc: { ...Type.caption, color: p.textDim },
    cardProgress: { ...Type.caption, color: p.text, fontWeight: '700', marginTop: Spacing.xs },
    dayLabel: { ...Type.title, color: p.text, fontWeight: '800', marginTop: Spacing.sm },
    quoteCard: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: p.border, gap: Spacing.sm },
    track: { ...Type.eyebrow, color: p.textDim, letterSpacing: 2 },
    quote: { color: p.text, fontSize: 20, fontWeight: '700', lineHeight: 30 },
    fallback: { color: p.textDim, fontSize: 11, fontStyle: 'italic' },
    daysRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    dayDot: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayDotDone: { backgroundColor: p.button, borderColor: p.button },
    dayDotActive: { borderColor: p.text, borderWidth: 2 },
    dayDotText: { color: p.textDim, fontWeight: '700' },
    dayDotTextDone: { color: p.buttonText },
    doneBtn: {
      backgroundColor: p.button,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    doneBtnText: { color: p.buttonText, fontSize: 16, fontWeight: '700' },
    doneText: { ...Type.title, color: p.text, textAlign: 'center', marginTop: Spacing.sm },
    complete: { ...Type.title, color: p.text, textAlign: 'center', marginTop: Spacing.sm, fontWeight: '800' },
  });
}
