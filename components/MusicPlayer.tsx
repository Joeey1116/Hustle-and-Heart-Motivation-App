import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Radius, Spacing, Type } from '../lib/design';
import type { ThemePalette } from '../lib/themes';
import { useTheme } from '../lib/themeContext';
import { useStrings } from '../lib/i18n';
import {
  BUNDLED_TRACKS,
  loadImportedTracks,
  readImportedList,
  saveImportedTracks,
  stopIfPlaying,
  useMusicPlayback,
  useSleepTimer,
  type Track,
} from '../lib/music';

const GENRES = ['All', 'Ambient', 'Piano', 'Nature', 'Meditation', 'Acoustic', 'Lo-Fi'] as const;

/** Locale key suffix for a genre id ('Lo-Fi' → 'lofi'). */
const genreKey = (g: string) => g.toLowerCase().replace(/[^a-z]/g, '');

/** Localized genre label; unknown genres (user data) pass through as-is. */
function genreLabel(g: string, t: (path: string) => string): string {
  const key = `music.genres.${genreKey(g)}`;
  const label = t(key);
  return label === key ? g : label;
}

interface Props {
  isHavenPlus: boolean;
}

/**
 * Music room — calming tracks by genre.
 * Free (Haven): built-in tracks with occasional ads.
 * Haven Plus: no ads + import your own tracks from your device.
 *
 * Playback lives in lib/music.ts (one app-wide player): leaving this
 * screen or backgrounding the app does NOT stop the music.
 */
export function MusicPlayer({ isHavenPlus }: Props) {
  const { palette } = useTheme();
  const { t } = useStrings();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [genre, setGenre] = useState('All');
  const [tracks, setTracks] = useState<Track[]>(BUNDLED_TRACKS);
  const { playingId, togglePlay } = useMusicPlayback();
  // 3.0 — sleep timer (module-level in lib/music.ts, survives tab switches).
  const { endsAt, minutes: sleepMinutes, setSleepTimer } = useSleepTimer();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const sleepRemainingMs = endsAt ? Math.max(endsAt - now, 0) : 0;
  const sleepRemaining =
    endsAt && sleepRemainingMs > 0
      ? `${Math.floor(sleepRemainingMs / 60_000)}:${String(Math.floor((sleepRemainingMs % 60_000) / 1000)).padStart(2, '0')}`
      : null;
  const sleepActive = (minutes: number | null) =>
    minutes === null ? endsAt === null : sleepMinutes === minutes;

  // Load imported tracks on mount.
  useEffect(() => {
    loadImportedTracks().then((imported) => {
      if (imported.length > 0) setTracks([...BUNDLED_TRACKS, ...imported]);
    });
  }, []);

  const filtered =
    genre === 'All' ? tracks : tracks.filter((t) => t.genre === genre);

  const importTrack = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      // Copy into the app's document directory so it survives cache clears.
      const destUri = `${FileSystem.Paths.document.uri}music-${Date.now()}-${asset.name}`;
      await FileSystem.copyAsync({ from: asset.uri, to: destUri });

      const imported = {
        id: `imported-${Date.now()}`,
        title: asset.name.replace(/\.[^.]+$/, ''),
        uri: destUri,
      };

      const list = await readImportedList();
      list.push(imported);
      await saveImportedTracks(list);

      const newTrack: Track = {
        id: imported.id,
        title: imported.title,
        artist: 'Your library',
        genre: 'Imported',
        duration: '',
        file: { uri: imported.uri },
        imported: true,
      };
      setTracks((prev) => [...prev, newTrack]);
      Alert.alert(t('music.addedTitle'), t('music.addedBody', { title: imported.title }));
    } catch (e) {
      console.error('Import failed:', e);
      Alert.alert(t('music.importFailTitle'), t('music.importFailBody'));
    }
  };

  const removeImported = (id: string) => {
    Alert.alert(t('music.removeTitle'), t('music.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            const track = tracks.find((t) => t.id === id);
            if (track?.imported && track.file?.uri) {
              await FileSystem.deleteAsync(track.file.uri, { idempotent: true });
            }
            const list = await readImportedList();
            await saveImportedTracks(list.filter((t) => t.id !== id));
            stopIfPlaying(id);
            setTracks((prev) => prev.filter((t) => t.id !== id));
          } catch {
            // Best effort — track is gone from the list regardless.
            stopIfPlaying(id);
            setTracks((prev) => prev.filter((t) => t.id !== id));
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        {t('music.subtitle')}
      </Text>

      {!isHavenPlus && (
        <View style={styles.adNote}>
          <Ionicons name="information-circle-outline" size={16} color={palette.textDim} />
          <Text style={styles.adNoteText}>
            {t('music.adNote')}
          </Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.genres}
        contentContainerStyle={styles.genresContent}
      >
        {GENRES.map((g) => (
          <Pressable
            key={g}
            onPress={() => setGenre(g)}
            style={[styles.genreChip, genre === g && styles.genreChipActive]}
          >
            <Text style={[styles.genreText, genre === g && styles.genreTextActive]}>
              {t(`music.genres.${genreKey(g)}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 3.0 — sleep timer: stop playback after 15 / 30 / 60 minutes. */}
      <View style={styles.sleepRow}>
        <View style={styles.sleepLabel}>
          <Ionicons name="moon-outline" size={16} color={palette.textDim} />
          <Text style={styles.sleepTitle}>{t('sleep.title')}</Text>
          {sleepRemaining ? (
            <Text style={styles.sleepCountdown}>{t('sleep.stopsIn', { time: sleepRemaining })}</Text>
          ) : null}
        </View>
        <View style={styles.sleepChips}>
          {([null, 15, 30, 60] as const).map((m) => (
            <Pressable
              key={m === null ? 'off' : String(m)}
              onPress={() => setSleepTimer(m)}
              style={[styles.sleepChip, sleepActive(m) && styles.sleepChipActive]}
            >
              <Text style={[styles.sleepChipText, sleepActive(m) && styles.sleepChipTextActive]}>
                {m === null ? t('sleep.off') : `${m}`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView style={styles.tracks} showsVerticalScrollIndicator={false}>
        {filtered.map((track) => {
          const isPlaying = playingId === track.id;
          return (
            <Pressable
              key={track.id}
              onPress={() => togglePlay(track)}
              onLongPress={track.imported ? () => removeImported(track.id) : undefined}
              style={[styles.track, isPlaying && styles.trackPlaying]}
            >
              <View style={styles.playBtn}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={palette.buttonText} />
              </View>
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.trackMeta} numberOfLines={1}>
                  {track.artist === 'Your library' ? t('music.yourLibrary') : track.artist}
                  {track.genre ? ` · ${genreLabel(track.genre, t)}` : ''}
                  {track.duration ? ` · ${track.duration}` : ''}
                </Text>
              </View>
              {isPlaying && (
                <Ionicons name="musical-notes" size={20} color={palette.text} />
              )}
            </Pressable>
          );
        })}
        {filtered.length === 0 && (
          <Text style={styles.empty}>{t('music.empty')}</Text>
        )}
      </ScrollView>

      {isHavenPlus && (
        <Pressable style={styles.importBtn} onPress={importTrack}>
          <Ionicons name="add-circle-outline" size={20} color={palette.text} />
          <Text style={styles.importText}>{t('music.import')}</Text>
        </Pressable>
      )}

      <Text style={styles.credit}>
        Music by Kevin MacLeod (incompetech.com){'\n'}Licensed under Creative Commons CC BY 4.0
      </Text>
    </View>
  );
}

function createStyles(p: ThemePalette) {
  return StyleSheet.create({
  container: { flex: 1, gap: Spacing.sm },
  subtitle: { ...Type.body, color: p.textMuted },
  adNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: p.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm + 2,
  },
  adNoteText: { ...Type.caption, color: p.textDim, flex: 1 },
  genres: { flexGrow: 0 },
  genresContent: { paddingVertical: Spacing.xs, alignItems: 'center' },
  genreChip: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
  },
  genreChipActive: { backgroundColor: p.button, borderColor: p.button },
  genreText: { fontSize: 14, color: p.textDim },
  genreTextActive: { color: p.buttonText, fontWeight: '600' },
  tracks: { flex: 1 },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  trackPlaying: { borderColor: p.text },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: p.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: { flex: 1 },
  trackTitle: { ...Type.title, color: p.text, marginBottom: 2 },
  trackMeta: { ...Type.caption, color: p.textDim },
  empty: { ...Type.body, color: p.textDim, textAlign: 'center', marginTop: Spacing.lg },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: p.surfaceRaised,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
  },
  importText: { ...Type.title, color: p.text },
  credit: {
    fontSize: 11,
    color: p.textDim,
    textAlign: 'center',
    lineHeight: 16,
  },
  // 3.0 — sleep timer.
  sleepRow: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sleepLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sleepTitle: { ...Type.title, color: p.text },
  sleepCountdown: { ...Type.caption, color: p.textDim, flex: 1, textAlign: 'right' },
  sleepChips: { flexDirection: 'row', gap: Spacing.sm },
  sleepChip: {
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minWidth: 52,
    alignItems: 'center',
  },
  sleepChipActive: { backgroundColor: p.button, borderColor: p.button },
  sleepChipText: { fontSize: 14, color: p.textDim, fontWeight: '700' },
  sleepChipTextActive: { color: p.buttonText },
  });
}
