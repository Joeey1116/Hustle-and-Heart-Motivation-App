import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Screen } from '../../components/Screen';
import { Glass } from '../../components/Glass';
import { Colors, Radius, Spacing, Type } from '../../lib/design';
import type { ThemePalette } from '../../lib/themes';
import { useTheme } from '../../lib/themeContext';
import { supabase } from '../../lib/supabase';
import { clearAllLocalData } from '../../lib/storage';
import { readImportedList, stopPlayback } from '../../lib/music';
import { useStrings } from '../../lib/i18n';

/**
 * Delete Account — separate screen (not a popup), same chrome as the
 * Your Name screen. Two steps, same as the old double confirmation:
 * step 1 explains, step 2 is the final "delete forever". Deleting
 * removes the account server-side, wipes the device, and restarts
 * the app from first run. Errors show on this screen — no popup.
 */
export default function DeleteAccountScreen() {
  const { palette } = useTheme();
  const { t } = useStrings();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wipeDevice = async () => {
    stopPlayback();
    try {
      const imported = await readImportedList();
      for (const track of imported) {
        await FileSystem.deleteAsync(track.uri, { idempotent: true });
      }
    } catch {
      // Best effort — storage wipe below still proceeds.
    }
    await clearAllLocalData();
  };

  const deleteAccount = async () => {
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: invokeError } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      });
      if (invokeError) throw invokeError;
      await wipeDevice();
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Session is already invalid server-side — nothing to clean up.
      }
      router.replace('/');
    } catch (e: any) {
      setError(e?.message || t('account.deleteFailBody'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.body}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.h1}>
          {step === 1 ? t('account.confirm1Title') : t('account.confirm2Title')}
        </Text>
        <Text style={styles.sub}>
          {step === 1 ? t('account.confirm1Body') : t('account.confirm2Body')}
        </Text>
        {error && (
          <Glass style={styles.errorCard}>
            <Text style={styles.errorTitle}>{t('account.deleteFailTitle')}</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </Glass>
        )}
        <View style={styles.buttons}>
          {step === 1 ? (
            <>
              <Pressable onPress={() => router.back()} style={[styles.btn, styles.keepBtn]}>
                <Text style={styles.keepText}>{t('account.keepAccount')}</Text>
              </Pressable>
              <Pressable
                onPress={() => setStep(2)}
                style={[styles.btn, styles.dangerBtn]}
              >
                <Text style={styles.dangerText}>{t('common.continue')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={() => setStep(1)} style={[styles.btn, styles.keepBtn]}>
                <Text style={styles.keepText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={deleteAccount}
                style={[styles.btn, styles.dangerBtn, busy && styles.disabled]}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.dangerText}>{t('account.deleteForever')}</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

function createStyles(p: ThemePalette) {
  return StyleSheet.create({
    body: { padding: Spacing.lg, gap: Spacing.md, flex: 1 },
    backRow: { paddingVertical: Spacing.xs },
    back: { color: p.textDim, fontSize: 17, fontWeight: '600' },
    h1: { ...Type.display, color: p.text },
    sub: { ...Type.body, color: p.textDim },
    errorCard: {
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.danger,
      gap: Spacing.xs,
    },
    errorTitle: { ...Type.title, color: Colors.danger },
    errorBody: { ...Type.body, color: p.textDim },
    buttons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    btn: { flex: 1, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
    keepBtn: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
    keepText: { color: p.text, fontSize: 17, fontWeight: '600' },
    dangerBtn: { backgroundColor: Colors.danger },
    dangerText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    disabled: { opacity: 0.5 },
  });
}
