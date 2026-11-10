import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { Glass } from '../../components/Glass';
import { Radius, Spacing, Type } from '../../lib/design';
import type { ThemePalette } from '../../lib/themes';
import { useTheme } from '../../lib/themeContext';
import { useStrings } from '../../lib/i18n';

/**
 * Manage Subscription — separate screen (not a popup), same chrome as
 * the Your Name screen. Two rows: Apple subscriptions, Google Play
 * subscriptions. Each opens the store's own manage page.
 */
export default function ManageSubscriptionScreen() {
  const { palette } = useTheme();
  const { t } = useStrings();
  const styles = useMemo(() => createStyles(palette), [palette]);

  return (
    <Screen>
      <View style={styles.body}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.h1}>{t('settings.manageAlertTitle')}</Text>
        <Text style={styles.sub}>{t('settings.manageAlertBody')}</Text>
        <Glass style={styles.group}>
          <Pressable
            style={styles.row}
            onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
          >
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t('settings.manageApple')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
          </Pressable>
          <Pressable
            style={styles.row}
            onPress={() =>
              Linking.openURL('https://play.google.com/store/account/subscriptions')
            }
          >
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t('settings.manageGoogle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
          </Pressable>
        </Glass>
        <Pressable onPress={() => router.back()} style={[styles.btn, styles.cancelBtn]}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>
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
    group: { borderRadius: Radius.lg, overflow: 'hidden' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
    },
    rowInfo: { flex: 1, gap: 2 },
    rowTitle: { color: p.text, fontSize: 17, fontWeight: '700' },
    btn: { borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
    cancelBtn: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
    cancelText: { color: p.text, fontSize: 17, fontWeight: '600' },
  });
}
