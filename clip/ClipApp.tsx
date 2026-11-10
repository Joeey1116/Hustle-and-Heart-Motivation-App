/**
 * ClipApp — the App Clip's single screen: today's quote.
 *
 * Same quote as the full app's Today tab (getQuoteOfTheDay, default tracks
 * for a fresh user, device language), rendered on the default Midnight
 * theme. No sign-in, no tabs, no purchases, no audio — the clip is a
 * taste of the app, and the button hands the user to the full app.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND } from '../lib/brand';
import { getTheme } from '../lib/themes';
import { getLanguage, initLanguage, trackName, useStrings } from '../lib/i18n';
import { getQuoteOfTheDay, getRandomQuote, type Quote } from '../lib/quotes';
import { getChosenTracks } from '../lib/storage';

// No App Store Connect app record exists yet, so there is no direct App
// Store link — a search for the app name is the fallback when the full
// app isn't installed to deep-link into.
const APP_STORE_SEARCH_URL =
  'https://apps.apple.com/us/search?term=Hustle%20%26%20Heart%20Motivation';

export function ClipApp() {
  const { t: strings } = useStrings();
  const theme = getTheme('midnight');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [canOpenApp, setCanOpenApp] = useState(false);

  const load = useCallback(async () => {
    await initLanguage();
    const tracks = await getChosenTracks();
    const q = await getQuoteOfTheDay(getLanguage(), tracks);
    setQuote(q);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    Linking.canOpenURL(`${BRAND.SCHEME}://`).then((ok) => {
      if (alive) setCanOpenApp(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const onNewQuote = useCallback(async () => {
    const tracks = await getChosenTracks();
    const q = await getRandomQuote(getLanguage(), tracks, quote?.id);
    if (q) setQuote(q);
  }, [quote?.id]);

  const onGetFullApp = useCallback(async () => {
    if (canOpenApp) {
      await Linking.openURL(`${BRAND.SCHEME}://`);
    } else {
      await Linking.openURL(APP_STORE_SEARCH_URL);
    }
  }, [canOpenApp]);

  return (
    <LinearGradient colors={theme.bg} style={styles.root}>
      <View style={styles.content}>
        <Text style={[styles.wordmark, { color: theme.accent }]}>{BRAND.SHORT_NAME}</Text>
        <Text style={[styles.label, { color: theme.muted }]}>{strings('today.quoteOfTheDay')}</Text>
        {loading ? (
          <ActivityIndicator color={theme.text} size="large" style={styles.spinner} />
        ) : quote ? (
          <>
            <Text style={[styles.quote, { color: theme.text }]}>{quote.text}</Text>
            <Text style={[styles.track, { color: theme.muted }]}>
              {quote.tracks.map((tr) => trackName(tr)).join(' · ')}
            </Text>
            {quote.fallback ? (
              <Text style={[styles.fallback, { color: theme.muted }]}>
                {strings('today.fallbackNote')}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[styles.quote, { color: theme.text }]}>{BRAND.TAGLINE}</Text>
        )}
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onNewQuote} style={[styles.ghostButton, { borderColor: theme.text }]}>
          <Text style={[styles.ghostButtonText, { color: theme.text }]}>
            {strings('today.newQuote')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onGetFullApp}
          style={[styles.solidButton, { backgroundColor: theme.palette.button }]}
        >
          <Text style={[styles.solidButtonText, { color: theme.palette.buttonText }]}>
            {canOpenApp ? strings('clip.openApp') : strings('clip.getFullApp')}
          </Text>
        </Pressable>
        <Text style={[styles.blurb, { color: theme.muted }]}>{strings('clip.fullAppBlurb')}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  wordmark: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  spinner: {
    marginVertical: 24,
  },
  quote: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 40,
    textAlign: 'center',
  },
  track: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  fallback: {
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  actions: {
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 12,
  },
  ghostButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ghostButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  solidButton: {
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  solidButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  blurb: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
