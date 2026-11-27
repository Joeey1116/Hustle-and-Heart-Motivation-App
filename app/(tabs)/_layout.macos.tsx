import { Ionicons } from '@expo/vector-icons';
import { Slot, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStrings } from '../../lib/i18n';
import { useTheme } from '../../lib/themeContext';

/**
 * macOS variant of the (tabs) layout — Metro resolves this file instead
 * of _layout.tsx for platform === 'macos'; iOS/Android/web are
 * untouched.
 *
 * NativeTabs (Liquid Glass) is iOS-only and has no macOS renderer, so
 * the desktop window gets a plain left SIDEBAR instead: the same five
 * tabs, same labels/icons, rendered as a vertical nav next to the
 * matched screen (<Slot />). Navigation goes through the router with
 * the same group hrefs the rest of the app already uses. Plainer than
 * the phone UI by design — a functional desktop window over the same
 * screens and the same on-device data. The iOS tab bar in
 * _layout.tsx (including the Nov 24, 2026 frosted-panel fixes) is not
 * modified by this file in any way.
 */

interface TabDef {
  href: string;
  match: (pathname: string) => boolean;
  labelKey: 'tabs.today' | 'tabs.browse' | 'tabs.music' | 'tabs.journal' | 'tabs.settings';
  ion: { focused: keyof typeof Ionicons.glyphMap; outline: keyof typeof Ionicons.glyphMap };
}

const TABS: TabDef[] = [
  {
    href: '/(tabs)',
    match: (p) => p === '/' || p === '/index',
    labelKey: 'tabs.today',
    ion: { focused: 'sunny', outline: 'sunny-outline' },
  },
  {
    href: '/(tabs)/browse',
    match: (p) => p.startsWith('/browse'),
    labelKey: 'tabs.browse',
    ion: { focused: 'grid', outline: 'grid-outline' },
  },
  {
    href: '/(tabs)/music',
    match: (p) => p.startsWith('/music'),
    labelKey: 'tabs.music',
    ion: { focused: 'musical-notes', outline: 'musical-notes-outline' },
  },
  {
    href: '/(tabs)/journal',
    match: (p) => p.startsWith('/journal'),
    labelKey: 'tabs.journal',
    ion: { focused: 'book', outline: 'book-outline' },
  },
  {
    href: '/(tabs)/settings',
    match: (p) => p.startsWith('/settings'),
    labelKey: 'tabs.settings',
    ion: { focused: 'settings', outline: 'settings-outline' },
  },
];

export default function TabsLayoutMacOS() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useStrings();
  const { palette } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <View
        style={[
          styles.sidebar,
          { backgroundColor: palette.surface, borderRightColor: palette.border },
        ]}
      >
        <Text style={[styles.brand, { color: palette.text }]}>Hustle &amp; Heart</Text>
        {TABS.map((tab) => {
          const focused = tab.match(pathname);
          return (
            <Pressable
              key={tab.href}
              onPress={() => router.navigate(tab.href as never)}
              style={[styles.item, focused && { backgroundColor: palette.surfaceRaised }]}
            >
              <Ionicons
                name={focused ? tab.ion.focused : tab.ion.outline}
                size={19}
                color={focused ? palette.tabActive : palette.tabInactive}
              />
              <Text
                style={[
                  styles.label,
                  { color: palette.tabInactive },
                  focused && { color: palette.tabActive, fontWeight: '700' },
                ]}
              >
                {t(tab.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.content, { backgroundColor: palette.background }]}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 216,
    borderRightWidth: 1,
    paddingTop: 28,
    paddingHorizontal: 12,
    gap: 4,
  },
  brand: {
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingBottom: 18,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 9,
  },
  label: { fontSize: 14, fontWeight: '500' },
  content: { flex: 1 },
});
