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
import { useStrings, setLanguage } from '../../lib/i18n';
import { useHavenPlus } from '../../lib/purchases';

const REVIEW_URL = 'https://apps.apple.com/app/id6821567537?action=write-review';

/**
 * Settings — structured per Joey's blueprint:
 * HAVEN / ABOUT YOU / MAKE IT YOURS / ACCOUNT / SUPPORT US / FOLLOW US / HELP / OTHER
 */
export default function Settings() {
  const { t, lang } = useStrings();
  const { theme, palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const { productsLoading } = useHavenPlus();
  const [plan, setPlanState] = useState<'haven' | 'haven-plus'>('haven');
  const [isLifetime, setIsLifetime] = useState(false);
  const [freezes, setFreezes] = useState(0);
  const [rituals, setRituals] = useState(true);
  const [notifOn, setNotifOn] = useState(false);
  const [userName, setUserNameState] = useState('');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
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

  // Manage Subscription is a full screen now (build 31), not a popup.
  const manageSubscription = () => {
    router.push('/settings/manage-subscription');
  };

  // Lifetime owners have no subscription to manage — just tell them so.
  const showLifetimeInfo = () => {
    Alert.alert(
      t('settings.lifetimeInfoTitle'),
      t('settings.lifetimeInfoBody'),
      [{ text: t('common.ok'), style: 'cancel' }]
    );
  };

  // Buy a Streak Freeze is a full screen now (build 31), not a popup.
  // The screen loads the StoreKit product itself and shows its own
  // loading state instead of the old "still loading" alert.
  const buyFreeze = () => {
    router.push('/settings/buy-freeze');
  };

  // Haven Plus is a full screen now (build 31), not a popup: plan rows,
  // Lifetime, and Restore all live on /settings/upgrade.
  const upgradeToPlus = () => {
    router.push('/settings/upgrade');
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

  // Why We Built This is a full screen now (build 31), not a popup.
  const whyWeBuiltThis = () => {
    router.push('/settings/why');
  };

  // Support Resources is a full screen now (build 31), not a popup.
  const supportResources = () => {
    router.push('/settings/support');
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
          <Pressable onPress={() => router.push('/settings/upgrade')} style={styles.row}>
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
