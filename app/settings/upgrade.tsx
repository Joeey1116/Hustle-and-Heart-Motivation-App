import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { Glass } from '../../components/Glass';
import { Radius, Spacing, Type } from '../../lib/design';
import type { ThemePalette } from '../../lib/themes';
import { useTheme } from '../../lib/themeContext';
import { LIFETIME_SKU, useHavenPlus } from '../../lib/purchases';
import { planName, useStrings } from '../../lib/i18n';

/**
 * Haven Plus — separate screen (not a popup), same chrome as the Your
 * Name screen: Back row, title, body, rows to tap.
 * A plan row starts that StoreKit purchase; success goes back to
 * Settings, where the plan row now shows Haven Plus. Restore shows its
 * result on this screen — no popup either way.
 */
export default function UpgradeScreen() {
  const { palette } = useTheme();
  const { t } = useStrings();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { purchase, purchaseInApp, restore, subscriptions, products, productsLoading } =
    useHavenPlus();
  const [busy, setBusy] = useState(false);
  const [restoreResult, setRestoreResult] = useState<'ok' | 'none' | null>(null);

  const lifetimeProduct = products.find((p) => p.id === LIFETIME_SKU);

  const buyPlan = async (sku: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await purchase(sku);
      if (ok) router.back();
      // Cancelled or failed → stay here; the store sheet already said so.
    } finally {
      setBusy(false);
    }
  };

  const buyLifetime = async () => {
    if (busy || !lifetimeProduct) return;
    setBusy(true);
    try {
      const ok = await purchaseInApp(LIFETIME_SKU);
      if (ok) router.back();
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await restore();
      setRestoreResult(ok ? 'ok' : 'none');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </Pressable>
        <Text style={styles.h1}>{t('settings.upgradeTitle')}</Text>
        <Text style={styles.sub}>{t('settings.upgradeBody')}</Text>

        {productsLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.textDim} />
            <Text style={styles.loadingText}>{t('settings.loadingPlans')}</Text>
          </View>
        ) : (
          <Glass style={styles.group}>
            {subscriptions.map((sub) => (
              <Pressable
                key={sub.id}
                style={[styles.row, busy && styles.disabled]}
                onPress={() => buyPlan(sub.id)}
                disabled={busy}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>{planName(sub.id, sub.title)}</Text>
                  <Text style={styles.rowDesc}>{sub.displayPrice}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
              </Pressable>
            ))}
            {lifetimeProduct && (
              <Pressable
                style={[styles.row, busy && styles.disabled]}
                onPress={buyLifetime}
                disabled={busy}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>{t('settings.lifetimeOption')}</Text>
                  <Text style={styles.rowDesc}>{lifetimeProduct.displayPrice}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
              </Pressable>
            )}
            <Pressable
              style={[styles.row, busy && styles.disabled]}
              onPress={doRestore}
              disabled={busy}
            >
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{t('settings.restorePurchase')}</Text>
                <Text style={styles.rowDesc}>{t('settings.restoreDesc')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
            </Pressable>
          </Glass>
        )}

        {restoreResult && (
          <Glass style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              {restoreResult === 'ok'
                ? t('settings.restoredTitle')
                : t('settings.noPurchaseTitle')}
            </Text>
            <Text style={styles.resultBody}>
              {restoreResult === 'ok'
                ? t('settings.restoredBody')
                : t('settings.noPurchaseBody')}
            </Text>
            <Pressable onPress={() => router.back()} style={[styles.btn, styles.doneBtn]}>
              <Text style={styles.doneText}>{t('common.ok')}</Text>
            </Pressable>
          </Glass>
        )}

        <Pressable onPress={() => router.back()} style={[styles.btn, styles.notNowBtn]}>
          <Text style={styles.notNowText}>{t('settings.notNow')}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function createStyles(p: ThemePalette) {
  return StyleSheet.create({
    body: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
    backRow: { paddingVertical: Spacing.xs },
    back: { color: p.textDim, fontSize: 17, fontWeight: '600' },
    h1: { ...Type.display, color: p.text },
    sub: { ...Type.body, color: p.textDim },
    loading: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
    loadingText: { ...Type.body, color: p.textDim },
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
    rowDesc: { color: p.textDim, fontSize: 14 },
    resultCard: {
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: p.border,
      gap: Spacing.sm,
    },
    resultTitle: { ...Type.title, color: p.text },
    resultBody: { ...Type.body, color: p.textDim },
    btn: { borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
    doneBtn: { backgroundColor: p.button, marginTop: Spacing.sm },
    doneText: { color: p.buttonText, fontSize: 17, fontWeight: '700' },
    notNowBtn: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
    notNowText: { color: p.text, fontSize: 17, fontWeight: '600' },
    disabled: { opacity: 0.5 },
  });
}
