/**
 * App Clip entry point — the JS bundle the clip target builds (see
 * plugins/withAppClip.js, ENTRY_FILE build setting).
 *
 * One screen, no router/tabs/accounts: today's quote (same
 * getQuoteOfTheDay the Today tab shows, same default tracks a fresh user
 * gets) over the default Midnight theme, plus a shuffle and a
 * "Get the full app" button that deep-links into the full app when it is
 * installed, or falls back to an App Store search for the app.
 *
 * Deliberately light imports: react-native, expo-linear-gradient,
 * lib/quotes, lib/i18n, lib/themes, lib/brand, lib/storage. Do NOT import
 * expo-router, expo-audio, react-native-iap or any screen/component that
 * pulls them in — the clip's JS bundle (and the 15 MB App Clip budget)
 * stays small only if this graph stays small.
 */
import { AppRegistry } from 'react-native';
import { ClipApp } from './ClipApp';

AppRegistry.registerComponent('main', () => ClipApp);
