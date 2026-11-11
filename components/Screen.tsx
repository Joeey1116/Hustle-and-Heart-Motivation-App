import * as React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/themeContext';

/**
 * Full-screen container with safe-area handling.
 * Build 20: the backdrop is the SELECTED THEME's gradient (was a
 * hardcoded black), so a theme choice recolors every screen that sits
 * on Screen — settings stack, account, music, legal, pickers.
 *
 * Bottom clearance: this container deliberately reserves NOTHING for
 * the tab bar — only the home-indicator inset. The floating native
 * bar overlays the content, and each tab screen's ScrollView already
 * carries its own bottom clearance inside the scroll content (120pt
 * — the same pattern as Rewards). Reserving it here too (the old
 * insets.bottom + 100) shrank every screen's viewport and left a
 * dead band of background above the bar — the "invisible bar" Joey
 * flagged Nov 11, 2026, with the last card sliced off at its edge.
 */
export function Screen({ style, children, ...rest }: ViewProps) {
  const insets = useSafeAreaInsets();
  const { theme, palette } = useTheme();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.background }}
      edges={['top', 'left', 'right']}
    >
      <LinearGradient
        colors={theme.bg}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          { flex: 1, paddingBottom: insets.bottom },
          style,
        ]}
        {...rest}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}
