import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useStrings } from '../../lib/i18n';
import { useTheme } from '../../lib/themeContext';

/**
 * Bottom navigation is the OS's OWN tab bar (UITabBar on iOS, the
 * Material navigation bar on Android) — on iOS 26 the system draws it
 * as the floating Liquid Glass capsule, the genuine Apple article.
 *
 * HISTORY: unstable-native-tabs was reverted on Oct 14, 2026 after a
 * SIGABRT (RNSTabBarController mounting crash) on iOS 26 TestFlight
 * builds, and builds 18–21 shipped a JS Tabs bar instead — first a
 * glass-background bar, then a custom floating GlassView capsule
 * (builds 20–21). Neither imitation satisfied: on device the capsule
 * read as a flat dark slab next to the real thing. RESTORED in build
 * 22 (Oct 22, 2026, Joey's explicit call): the Fam Rewards app runs
 * this exact NativeTabs setup on the identical library versions
 * (expo ~57.0.26, expo-router ~57.0.24, react-native-screens ~4.26.0)
 * and has been stable through heavy on-device use, so Motivation
 * mirrors Rewards' layout structure and props.
 *
 * CRASH WATCH (build 22 device check): the Oct 14 signature was a
 * SIGABRT ~1s after the tabs mounted — system crash dialog, no JS
 * redbox — often right as a permission prompt appeared. If it ever
 * recurs, it will be visible immediately on launch/tab-switch.
 *
 * The bar's colors come from the ACTIVE theme (build 20's
 * ThemeProvider): tint/icon/label selected color = palette.tabActive,
 * unselected = palette.tabInactive, so picking a theme recolors the
 * bar's active state along with the rest of the app. Midnight's
 * tab colors (#FFFFFF / #666666) are exactly Rewards' hardcoded ones.
 *
 * TAB BAR BACKGROUND (Nov 24, 2026, 3.0 build 34, on device): a solid
 * bar showed behind the floating glass capsule — the native tab bar's
 * opaque background, forced by `disableTransparentOnScrollEdge` on
 * every trigger. Removed that prop everywhere and set the bar's
 * background transparent, so only the Liquid Glass capsule shows and
 * the screen shows through around it, which is the look Joey asked
 * for. If the bar ever comes back, this is the first place to look.
 *
 * FOLLOW-UP (Nov 24, 2026, build 35, on device): the bar was gone on
 * Today but a frosted box still showed on the scrolled tabs (Browse,
 * Music, Journal). Cause: Today uses the scroll-edge appearance
 * (blur 'none' once the prop above is gone), but a scrolled tab uses
 * the STANDARD appearance, whose blur defaults to the system material
 * — a full-width frosted panel behind the capsule. Fix: blurEffect
 * "none" + shadowColor "transparent" on the navigator, so the
 * standard appearance has no blur and no shadow line either. The
 * capsule itself keeps its own system glass; only the panel goes.
 *
 * 5 tabs (consolidated Oct 15, 2026; revised in 2.0): Today, Browse
 * (Saved merged in), Music (promoted to a full tab in 2.0 — the
 * Haven AI companion tab was removed in 2.0), Journal (Wellness
 * tools merged in), Settings.
 */
function NativeTabsLayout() {
  const { t } = useStrings();
  const { palette } = useTheme();
  return (
    <NativeTabs
      backgroundColor="transparent"
      blurEffect="none"
      shadowColor="transparent"
      tintColor={palette.tabActive}
      iconColor={{ default: palette.tabInactive, selected: palette.tabActive }}
      labelStyle={{
        default: { color: palette.tabInactive, fontWeight: '500' },
        selected: { color: palette.tabActive, fontWeight: '700' },
      }}
    >
      <NativeTabs.Trigger
        name="index"
        contentStyle={{ backgroundColor: palette.background }}
      >
        <NativeTabs.Trigger.Label>{t('tabs.today')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'sun.max', selected: 'sun.max.fill' }}
          md="sunny"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="browse"
        contentStyle={{ backgroundColor: palette.background }}
      >
        <NativeTabs.Trigger.Label>{t('tabs.browse')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}
          md="grid_view"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="music"
        contentStyle={{ backgroundColor: palette.background }}
      >
        <NativeTabs.Trigger.Label>{t('tabs.music')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'music.note', selected: 'music.note' }}
          md="music_note"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="journal"
        contentStyle={{ backgroundColor: palette.background }}
      >
        <NativeTabs.Trigger.Label>{t('tabs.journal')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'book', selected: 'book.fill' }}
          md="menu_book"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="settings"
        contentStyle={{ backgroundColor: palette.background }}
      >
        <NativeTabs.Trigger.Label>{t('tabs.settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          md="settings"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

/* ------------------------------------------------------------------ */
/* tvOS fallback bar (Nov 27, 2026, replicating the Flight Journal    */
/* pilot): NativeTabs (Liquid Glass UITabBar) is not the tvOS         */
/* navigation model — Apple TV needs a focus-driven bar the Siri      */
/* Remote can move through. The JS Tabs bar below is built from       */
/* Pressables, which the react-native-tvos fork makes focusable with  */
/* native focus events, so the same five tabs render and are          */
/* reachable by remote. iOS/Android never take this branch            */
/* (Platform.isTV is false there); the macOS build uses               */
/* _layout.macos.tsx and never sees this file's navigator either.     */
/* ------------------------------------------------------------------ */

interface TvTabDef {
  name: string;
  labelKey: 'tabs.today' | 'tabs.browse' | 'tabs.music' | 'tabs.journal' | 'tabs.settings';
  ion: { focused: keyof typeof Ionicons.glyphMap; outline: keyof typeof Ionicons.glyphMap };
}

const TV_TABS: TvTabDef[] = [
  { name: 'index', labelKey: 'tabs.today', ion: { focused: 'sunny', outline: 'sunny-outline' } },
  { name: 'browse', labelKey: 'tabs.browse', ion: { focused: 'grid', outline: 'grid-outline' } },
  { name: 'music', labelKey: 'tabs.music', ion: { focused: 'musical-notes', outline: 'musical-notes-outline' } },
  { name: 'journal', labelKey: 'tabs.journal', ion: { focused: 'book', outline: 'book-outline' } },
  { name: 'settings', labelKey: 'tabs.settings', ion: { focused: 'settings', outline: 'settings-outline' } },
];

interface TvBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: string; target: string; canPreventDefault: boolean }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
  insets: { top: number; right: number; bottom: number; left: number };
}

function TvTabBar({ state, navigation, insets }: TvBarProps) {
  const { t } = useStrings();
  const { palette } = useTheme();
  const barStyle: ViewStyle = {
    paddingBottom: Math.max(insets.bottom, 8),
    backgroundColor: palette.background,
    borderTopColor: palette.border ?? 'rgba(255,255,255,0.12)',
  };
  return (
    <View style={[tvStyles.bar, barStyle]}>
      {state.routes.map((route, i) => {
        const def = TV_TABS.find((tab) => tab.name === route.name) ?? TV_TABS[0];
        const focused = state.index === i;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        return (
          <Pressable key={route.key} onPress={onPress} style={tvStyles.tab}>
            <Ionicons
              name={focused ? def.ion.focused : def.ion.outline}
              size={22}
              color={focused ? palette.tabActive : palette.tabInactive}
            />
            <Text
              style={[
                tvStyles.label,
                { color: focused ? palette.tabActive : palette.tabInactive },
                focused && tvStyles.labelActive,
              ]}
            >
              {t(def.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TvTabsLayout() {
  const { palette } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TvTabBar {...(props as unknown as TvBarProps)} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.background },
      }}
    >
      {TV_TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

export default function TabsLayout() {
  // tvOS only: JS Tabs fallback (see the tvOS section above). Every
  // other platform renders the NativeTabs layout exactly as before.
  if ((Platform as unknown as { isTV?: boolean }).isTV) {
    return <TvTabsLayout />;
  }
  return <NativeTabsLayout />;
}

const tvStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2 },
  label: { fontSize: 10, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
});
