import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Glass } from './Glass';
import { Radius, Spacing, Type } from '../lib/design';
import type { ThemePalette } from '../lib/themes';
import { useTheme } from '../lib/themeContext';
import { useStrings } from '../lib/i18n';
import { BUNDLED_TRACKS, stopPlayback, togglePlay, useMusicPlayback } from '../lib/music';
import { getFocusSessionCount, logFocusSession } from '../lib/storage';

const PRESETS = [10, 25, 45] as const;

interface Props {
  /** Called once when a block completes (minutes), so the screen can log it. */
  onComplete?: (minutes: number) => void;
  onClose?: () => void;
}

/**
 * Focus Timer (3.0) — simple timed focus blocks. Presets 10 / 25 /
 * 45 minutes, countdown, start / pause / reset, an optional calming
 * music toggle, and a calm completion message. No stats beyond a
 * completed-sessions count; everything is local.
 */
export function FocusTimer({ onComplete, onClose }: Props) {
  const { t } = useStrings();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [preset, setPreset] = useState<number>(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [sessions, setSessions] = useState(0);
  const { playingId } = useMusicPlayback();
  const completedRef = useRef(false);

  useEffect(() => {
    getFocusSessionCount().then(setSessions);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Completion fires exactly once when the countdown hits zero.
  useEffect(() => {
    if (remaining === 0 && running && !completedRef.current) {
      completedRef.current = true;
      setRunning(false);
      setDone(true);
      void logFocusSession().then(setSessions);
      onComplete?.(preset);
    }
  }, [remaining, running, preset, onComplete]);

  const pickPreset = (m: number) => {
    setPreset(m);
    setRemaining(m * 60);
    setRunning(false);
    setDone(false);
    completedRef.current = false;
  };

  const reset = () => {
    setRemaining(preset * 60);
    setRunning(false);
    setDone(false);
    completedRef.current = false;
  };

  const toggleMusic = async () => {
    if (playingId) {
      stopPlayback();
    } else {
      await togglePlay(BUNDLED_TRACKS[0]);
    }
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <View style={styles.container}>
      {onClose ? (
        <Pressable onPress={onClose} style={styles.closeRow}>
          <Ionicons name="close" size={24} color={palette.textDim} />
        </Pressable>
      ) : null}
      <Text style={styles.title}>{t('focus.title')}</Text>
      <Text style={styles.subtitle}>{t('focus.subtitle')}</Text>

      <View style={styles.presets}>
        {PRESETS.map((m) => (
          <Pressable
            key={m}
            onPress={() => pickPreset(m)}
            style={[styles.preset, preset === m && styles.presetActive]}
          >
            <Text style={[styles.presetText, preset === m && styles.presetTextActive]}>
              {t('focus.minutes', { n: m })}
            </Text>
          </Pressable>
        ))}
      </View>

      <Glass style={styles.clock}>
        <Text style={styles.time}>
          {mm}:{ss}
        </Text>
        {done ? (
          <>
            <Text style={styles.doneTitle}>{t('focus.doneTitle')}</Text>
            <Text style={styles.doneBody}>{t('focus.doneBody', { n: preset })}</Text>
          </>
        ) : null}
      </Glass>

      <View style={styles.controls}>
        {running ? (
          <Pressable onPress={() => setRunning(false)} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>{t('focus.pause')}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              if (remaining === 0) reset();
              setRunning(true);
            }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>
              {remaining < preset * 60 && remaining > 0 ? t('focus.resume') : t('focus.start')}
            </Text>
          </Pressable>
        )}
        <Pressable onPress={reset} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>{t('focus.reset')}</Text>
        </Pressable>
      </View>

      <Pressable onPress={toggleMusic} style={styles.musicRow}>
        <Ionicons
          name={playingId ? 'pause-circle-outline' : 'play-circle-outline'}
          size={24}
          color={palette.text}
        />
        <Text style={styles.musicText}>{t('focus.music')}</Text>
        <Text style={styles.musicState}>{playingId ? '●' : '○'}</Text>
      </Pressable>

      <Text style={styles.sessions}>{t('focus.sessions', { n: sessions })}</Text>
    </View>
  );
}

function createStyles(p: ThemePalette) {
  return StyleSheet.create({
    container: { flex: 1, gap: Spacing.md, padding: Spacing.lg },
    closeRow: { alignSelf: 'flex-end', padding: Spacing.xs },
    title: { ...Type.display, color: p.text, textAlign: 'center' },
    subtitle: { ...Type.body, color: p.textDim, textAlign: 'center' },
    presets: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
    preset: {
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    presetActive: { backgroundColor: p.button, borderColor: p.button },
    presetText: { fontSize: 15, color: p.textDim, fontWeight: '700' },
    presetTextActive: { color: p.buttonText },
    clock: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: p.border,
      padding: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    time: { color: p.text, fontSize: 64, fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'] },
    doneTitle: { ...Type.title, color: p.text, fontWeight: '800' },
    doneBody: { ...Type.body, color: p.textDim, textAlign: 'center' },
    controls: { flexDirection: 'row', gap: Spacing.sm },
    primaryBtn: {
      flex: 1,
      backgroundColor: p.button,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    primaryBtnText: { color: p.buttonText, fontSize: 16, fontWeight: '700' },
    secondaryBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    secondaryBtnText: { color: p.text, fontSize: 16, fontWeight: '700' },
    musicRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: Radius.lg,
      padding: Spacing.md,
    },
    musicText: { ...Type.title, color: p.text, flex: 1 },
    musicState: { color: p.textDim, fontSize: 12 },
    sessions: { ...Type.caption, color: p.textDim, textAlign: 'center' },
  });
}
