/**
 * react-native-screens TabsHost / TabsScreen stub for macOS bundles
 * ONLY (wired up in metro.config.js; other platforms resolve the real
 * platform files inside react-native-screens).
 *
 * react-native-screens 4.26 ships its native-tabs host/screen
 * components for ios/android/web only — there is no .macos (or
 * .native) variant, so Metro cannot resolve them for the macos
 * platform and the whole bundle fails. expo-router imports these
 * modules for its NativeTabs navigator, which the macOS build never
 * renders (app/(tabs)/_layout.macos.tsx uses a sidebar + <Slot />
 * instead). This inert component — render children, nothing native —
 * exists purely so the module graph resolves on macOS.
 */
import React, { type ReactNode } from 'react';

export default function RNScreensTabsStub({ children }: { children?: ReactNode }) {
  return <>{children ?? null}</>;
}
