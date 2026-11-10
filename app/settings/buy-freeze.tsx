import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Glass } from '../../components/Glass';
import { Radius, Spacing, Type } from '../../lib/design';
import type { ThemePalette } from '../../lib/themes';
import { useTheme } from '../../lib/themeContext';
import { FREEZE_SKU, useHavenPlus } from '../../lib/purchases';
import { useStrings } from '../../lib/i18n';

/**
 * Buy a Streak Freeze — separate screen (not a popup), same chrome as
 * the Your Name screen: Back row, title, body, pill buttons.
 * Buy → real StoreKit purchase; success goes back to Settings, where
 * the row now shows the new freeze count. Cancel → just go back.
 */
export default function BuyFreezeScreen() {
  const { palette } = useTheme();
  const { t } = useStrings();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { products, productsLoading, purchaseInApp } = useHavenPlus();
  const [busy, setBusy] = useState(false);

  const freezeProduct = products.find((p) => p.id === FREEZE_SKU);

  const onBuy = async () => {
    if (busy || !freezeProduct) return;
    setBusy(true);
    try {
      const ok = await purchaseInApp(FREEZE_SKU);
      if (ok) router.back();
      // Cancelled or failed → stay here; the store sheet already said so.
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
        <Text style={styles.h1}>{t('settings.freezeBuyTitle')}</Text>
        <Text style={styles.sub}>{t('settings.freezeBuyBody')}</Text>
        {productsLoading || !freezeProduct ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.textDim} />
            <Text style={styles.loadingText}>{t('settings.loadingPlans')}</Text>
          </View>
        ) : (
          <Glass style={styles.card}>
            <Text style={styles.price}>{freezeProduct.displayPrice}</Text>
            <Text style={styles.priceNote}>{t('settings.freezeTitle')}</Text>
          </Glass>
        )}
        <View style={styles.buttons}>
          <Pressable onPress={() => router.back()} style={[styles.btn, styles.cancelBtn]}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            onPress={onBuy}
            style={[styles.btn, styles.buyBtn, (busy || !freezeProduct) && styles.disabled]}
            disabled={busy || !freezeProduct}
          >
            <Text style={styles.buyText}>
              {freezeProduct
                ? `${t('common.buy')} — ${freezeProduct.displayPrice}`
                : t('common.buy')}
            </Text>
          </Pressable>
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
    loading: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
    loadingText: { ...Type.body, color: p.textDim },
    card: {
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: p.border,
      alignItems: 'center',
      gap: Spacing.xs,
    },
    price: { ...Type.display, color: p.text },
    priceNote: { ...Type.body, color: p.textDim },
    buttons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    btn: { flex: 1, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
    cancelBtn: { backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
    cancelText: { color: p.text, fontSize: 17, fontWeight: '600' },
    buyBtn: { backgroundColor: p.button },
    buyText: { color: p.buttonText, fontSize: 17, fontWeight: '700' },
    disabled: { opacity: 0.5 },
  });
}
