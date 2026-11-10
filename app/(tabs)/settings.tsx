import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '../../components/Glass';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';
import { Radius, Spacing, Type } from '../../lib/design';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../lib/themeContext';
import type { ThemePalette } from '../../lib/themes';
import { getPlan, isRitualsEnabled,
  setRitualsEnabled,
  isNotifEnabled, setNotifEnabled, getUserName, setUserName,
  getChosenTracks, setChosenTracks, getThemeId, setThemeId,
  getFreezeCount, isLifetimeOwned } from '../../lib/storage';
import { useStrings, setLanguage, planName } from '../../lib/i18n';
import { FREEZE_SKU, LIFETIME_SKU, useHavenPlus } from '../../lib/purchases';

const REVIEW_URL = 'https://apps.apple.com/app/id6821567537?action=write-review';

/**
 * Settings — structured per Joey's blueprint:
 * HAVEN / ABOUT YOU / MAKE IT YOURS / ACCOUNT / SUPPORT US / FOLLOW US / HELP / OTHER
 */
export default function Settings() {
  const { t, lang } = useStrings();
  const { theme, palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { purchase, purchaseInApp, restore, subscriptions, products, productsLoading } = useHavenPlus();
  const [plan, setPlanState] = useState<'haven' | 'haven-plus'>('haven');
  const [isLifetime, setIsLifetime] = useState(false);
  const [freezes, setFreezes] = useState(0);
  const [rituals, setRituals] = useState(true);
  const [notifOn, setNotifOn] = useState(false);
  const [userName, setUserNameState] = useState('');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const p = await getPlan();
    setPlanState(p === 'haven-plus' ? 'haven-plus' : 'haven');
    setIsLifetime(await isLifetimeOwned());
    setFreezes(await getFreezeCount());
    setRituals(await isRitualsEnabled());
    setNotifOn(await isNotifEnabled());
    setUserNameState(await getUserName());
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      setAccountEmail(data.session?.user?.email ?? null);
    } else {
      setAccountEmail(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openAppleSubs = () => {
    Linking.openURL('https://apps.apple.com/account/subscriptions');
  };

  const openPlaySubs = () => {
    Linking.openURL('https://play.google.com/store/account/subscriptions');
  };

  const manageSubscription = () => {
    Alert.alert(
      t('settings.manageAlertTitle'),
      t('settings.manageAlertBody'),
      [
        { text: t('settings.manageApple'), onPress: openAppleSubs },
        { text: t('settings.manageGoogle'), onPress: openPlaySubs },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  // Lifetime owners have no subscription to manage — just tell them so.
  const showLifetimeInfo = () => {
    Alert.alert(
      t('settings.lifetimeInfoTitle'),
      t('settings.lifetimeInfoBody'),
      [{ text: t('common.ok'), style: 'cancel' }]
    );
  };

  // Live one-time products (2.0) — undefined until StoreKit returns them,
  // so their buttons only appear once the store has the products.
  const lifetimeProduct = products.find((p) => p.id === LIFETIME_SKU);
  const freezeProduct = products.find((p) => p.id === FREEZE_SKU);

  const buyFreeze = () => {
    // Never open a buy flow on a cold StoreKit fetch — same rule as the
    // subscription paywall below.
    if (productsLoading || !freezeProduct) {
      Alert.alert(
        t('settings.upgradeLoadingTitle'),
        t('settings.loadingPlans'),
        [{ text: t('common.ok'), style: 'cancel' }]
      );
      return;
    }
    Alert.alert(
      t('settings.freezeBuyTitle'),
      t('settings.freezeBuyBody'),
      [
        {
          text: `${t('common.buy')} — ${freezeProduct.displayPrice}`,
          onPress: () => handlePurchaseInApp(FREEZE_SKU),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const upgradeToPlus = () => {
    // Never open the paywall on a cold StoreKit fetch — that was the
    // "takes forever" sheet. Products are prefetched at app launch.
    if (productsLoading || subscriptions.length === 0) {
      Alert.alert(
        t('settings.upgradeLoadingTitle'),
        t('settings.loadingPlans'),
        [{ text: t('common.ok'), style: 'cancel' }]
      );
      return;
    }
    Alert.alert(
      t('settings.upgradeTitle'),
      t('settings.upgradeBody'),
      [
        // Live StoreKit prices — never hardcoded, so they can't drift.
        ...subscriptions.map((sub) => ({
          text: `${planName(sub.id, sub.title)} ${sub.displayPrice}`,
          onPress: () => handlePurchase(sub.id),
        })),
        // Lifetime (2.0): pay once, keep Haven Plus forever.
        ...(lifetimeProduct
          ? [
              {
                text: `${t('settings.lifetimeOption')} ${lifetimeProduct.displayPrice}`,
                onPress: () => handlePurchaseInApp(LIFETIME_SKU),
              },
            ]
          : []),
        { text: t('settings.restorePurchase'), onPress: handleRestore },
        { text: t('settings.notNow'), style: 'cancel' },
      ]
    );
  };

  const handlePurchase = async (sku: string) => {
    if (busy) return;
    setBusy(true);
    try {
      // purchase() resolves true ONLY on a verified transaction for this
      // SKU (see lib/purchases.ts). Cancel/failure → false, no grant.
      const ok = await purchase(sku);
      if (ok) {
        await load();
        Alert.alert(
          t('settings.welcomePlusTitle'),
          t('settings.welcomePlusBody')
        );
      }
      // Cancelled or failed → stay silent; the store sheet already said so.
    } finally {
      setBusy(false);
    }
  };

  /**
   * One-time purchase (Lifetime / Streak Freeze). Same verified-transaction
   * rule as handlePurchase: purchaseInApp() resolves true ONLY on a real
   * transaction for the SKU, and the grant happens in the purchase
   * listener (lib/purchases.ts) — never here.
   */
  const handlePurchaseInApp = async (sku: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await purchaseInApp(sku);
      if (ok) {
        await load();
        if (sku === LIFETIME_SKU) {
          Alert.alert(
            t('settings.welcomeLifetimeTitle'),
            t('settings.welcomeLifetimeBody')
          );
        } else if (sku === FREEZE_SKU) {
          Alert.alert(
            t('settings.freezeBoughtTitle'),
            t('settings.freezeBoughtBody')
          );
        }
      }
      // Cancelled or failed → stay silent; the store sheet already said so.
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // restore() grants haven-plus itself on success (lib/purchases.ts).
      const ok = await restore();
      Alert.alert(
        ok ? t('settings.restoredTitle') : t('settings.noPurchaseTitle'),
        ok
          ? t('settings.restoredBody')
          : t('settings.noPurchaseBody')
      );
      if (ok) load();
    } finally {
      setBusy(false);
    }
  };

  const editName = () => {
    router.push('/settings/name');
  };

  const editBeliefs = () => {
    router.push('/settings/tracks');
  };

  const editLanguage = () => {
    router.push('/settings/language');
  };

  const editThemes = () => {
    router.push('/settings/themes');
  };

  const openAccount = () => {
    router.push('/settings/account');
  };

  const shareApp = async () => {
    try {
      await Share.share({
        message: t('settings.shareMessage'),
      });
    } catch {
      // dismissed
    }
  };

  const leaveReview = () => {
    Linking.openURL(REVIEW_URL).catch(() => {
      Alert.alert(t('settings.reviewThanksTitle'), t('settings.reviewThanksBody'));
    });
  };

  const whyWeBuiltThis = () => {
    Alert.alert(
      t('settings.whyBuilt'),
      t('settings.whyBuiltBody')
    );
  };

  const supportResources = () => {
    Alert.alert(
      t('settings.supportResources'),
      t('settings.supportBody'),
      [{ text: t('common.close'), style: 'cancel' }]
    );
  };

  const contactUs = () => {
    Linking.openURL('mailto:contact@beatrackfam.info?subject=Hustle%20%26%20Heart%20App');
  };

  const toggleRituals = async (v: boolean) => {
    setRituals(v);
    await setRitualsEnabled(v);
  };

  const toggleNotif = async (v: boolean) => {
    setNotifOn(v);
    await setNotifEnabled(v);
  };

  return (
    <View style={styles.wrapper}>
      <LinearGradient colors={theme.bg} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120 },
      ]}
    >
      <Text style={styles.title}>{t('settings.title')}</Text>

      {/* HAVEN */}
      <Text style={styles.section}>{t('settings.sections.haven')}</Text>
      <Glass style={styles.group}>
        <Pressable
          style={styles.row}
          onPress={
            plan === 'haven-plus'
              ? isLifetime
                ? showLifetimeInfo
                : manageSubscription
              : upgradeToPlus
          }
        >
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>
              {plan === 'haven-plus' ? t('settings.planPlusTitle') : t('settings.planFreeTitle')}
            </Text>
            <Text style={styles.rowDesc}>
              {plan === 'haven-plus'
                ? isLifetime
                  ? t('settings.planLifetimeDesc')
                  : t('settings.planPlusDesc')
                : productsLoading
                  ? t('settings.loadingPlans')
                  : t('settings.planFreeDesc')}
            </Text>
          </View>
          {productsLoading && plan !== 'haven-plus' ? (
            <ActivityIndicator size="small" color={palette.textDim} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
          )}
        </Pressable>
        {/* Streak Freeze (2.0) — streaks live on the free plan too, so this
            row shows for everyone. A banked freeze is spent automatically
            the next time a day is missed (see recordOpen). */}
        <Pressable onPress={buyFreeze} style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.freezeTitle')}</Text>
            <Text style={styles.rowDesc}>
              {freezes > 0
                ? t('settings.freezeDescHas', { n: freezes })
                : t('settings.freezeDescNone')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
        {plan === 'haven-plus' && !isLifetime && (
          <Pressable onPress={manageSubscription} style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t('settings.manageSub')}</Text>
              <Text style={styles.rowDesc}>{t('settings.manageSubDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
          </Pressable>
        )}
        {plan !== 'haven-plus' && (
          <Pressable onPress={handleRestore} style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>{t('settings.restorePurchase')}</Text>
              <Text style={styles.rowDesc}>{t('settings.restoreDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
          </Pressable>
        )}
      </Glass>

      {/* ABOUT YOU */}
      <Text style={styles.section}>{t('settings.sections.aboutYou')}</Text>
      <Glass style={styles.group}>
        <Pressable style={styles.row} onPress={editName}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.nameRow')}</Text>
            <Text style={styles.rowDesc}>
              {userName ? t('settings.nameDescNamed', { name: userName }) : t('settings.nameDesc')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
        <Pressable style={styles.row} onPress={editBeliefs}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.beliefs')}</Text>
            <Text style={styles.rowDesc}>{t('settings.beliefsDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
      </Glass>

      {/* MAKE IT YOURS — the AI companion + streak buddy toggles were
          removed in 2.0 with the Haven companion itself. */}
      <Text style={styles.section}>{t('settings.sections.makeItYours')}</Text>
      <Glass style={styles.group}>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.dailyRituals')}</Text>
            <Text style={styles.rowDesc}>{t('settings.dailyRitualsDesc')}</Text>
          </View>
          <Switch value={rituals} onValueChange={toggleRituals} />
        </View>
        <View style={styles.row}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.notifications')}</Text>
            <Text style={styles.rowDesc}>{t('settings.notificationsDesc')}</Text>
          </View>
          <Switch value={notifOn} onValueChange={toggleNotif} />
        </View>
        <Pressable style={styles.row} onPress={editLanguage}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.language')}</Text>
            <Text style={styles.rowDesc}>{t('settings.languageDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
        <Pressable style={styles.row} onPress={editThemes}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.themes')}</Text>
            <Text style={styles.rowDesc}>{t('settings.themesDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
      </Glass>

      {/* ACCOUNT — always visible (build 18 fix: it used to vanish
          entirely whenever the backend wasn't configured). The account
          screen itself handles signed-out / signed-in / not-configured
          states; Delete Account lives there and only shows when the
          user is actually signed in. */}
      <Text style={styles.section}>{t('settings.sections.account')}</Text>
      <Glass style={styles.group}>
        <Pressable style={styles.row} onPress={openAccount}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.accountRow')}</Text>
            <Text style={styles.rowDesc}>
              {accountEmail
                ? t('settings.accountDescSignedIn', { email: accountEmail })
                : t('settings.accountDescSignedOut')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
      </Glass>

      {/* SUPPORT US */}
      <Text style={styles.section}>{t('settings.sections.supportUs')}</Text>
      <Glass style={styles.group}>
        <Pressable style={styles.row} onPress={shareApp}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.shareApp')}</Text>
            <Text style={styles.rowDesc}>{t('settings.shareDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
        <Pressable style={styles.row} onPress={leaveReview}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.leaveReview')}</Text>
            <Text style={styles.rowDesc}>{t('settings.reviewDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
      </Glass>

      {/* FOLLOW US */}
      <Text style={styles.section}>{t('settings.sections.followUs')}</Text>
      <Glass style={styles.group}>
        <Pressable
          style={styles.row}
          onPress={() => Linking.openURL('https://instagram.com/beatrackfam')}
        >
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>Instagram</Text>
            <Text style={styles.rowDesc}>@beatrackfam</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
      </Glass>

      {/* HELP */}
      <Text style={styles.section}>{t('settings.sections.help')}</Text>
      <Glass style={styles.group}>
        <Pressable style={styles.row} onPress={whyWeBuiltThis}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.whyBuilt')}</Text>
            <Text style={styles.rowDesc}>{t('settings.whyBuiltDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
        <Pressable style={styles.row} onPress={supportResources}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.supportResources')}</Text>
            <Text style={styles.rowDesc}>{t('settings.supportDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
        <Pressable style={styles.row} onPress={contactUs}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.contactUs')}</Text>
            <Text style={styles.rowDesc}>contact@beatrackfam.info</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
      </Glass>

      {/* OTHER */}
      <Text style={styles.section}>{t('settings.sections.other')}</Text>
      <Glass style={styles.group}>
        <Pressable style={styles.row} onPress={() => router.push('/settings/privacy')}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.privacyPolicy')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
        <Pressable style={styles.row} onPress={() => router.push('/settings/terms')}>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{t('settings.termsOfService')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textDim} />
        </Pressable>
      </Glass>

      <Text style={styles.footer}>
        Hustle & Heart v{Constants.expoConfig?.version ?? '1.0'}
        {Constants.nativeBuildVersion ? ` (${Constants.nativeBuildVersion})` : ''}
        {'\n'}{t('settings.footerNote')}
      </Text>
      </ScrollView>
    </View>
  );
}

function createStyles(p: ThemePalette) {
  return StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: p.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    ...Type.display,
    color: p.text,
    marginBottom: Spacing.md,
  },
  section: {
    ...Type.eyebrow,
    color: p.textDim,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  group: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: p.border,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    ...Type.title,
    color: p.text,
    marginBottom: 2,
  },
  rowDesc: {
    ...Type.caption,
    color: p.textMuted,
  },
  footer: {
    ...Type.caption,
    color: p.textDim,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  });
}
