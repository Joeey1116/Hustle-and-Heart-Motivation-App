import * as React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import type { ShotHandle } from './QuoteCard';
import { BRAND } from '../lib/brand';
import type { ThemePalette } from '../lib/themes';
import { useTheme } from '../lib/themeContext';
import { useStrings } from '../lib/i18n';

interface Props {
  streak: number;
  shotRef: React.RefObject<ShotHandle | null>;
}

/**
 * Shareable streak card (3.0): the same hidden ViewShot + Sharing
 * pattern as QuoteCard, but for the streak — "30 days straight".
 * Rendered off-screen; captured and shared from the Today screen when
 * the user taps the streak badge. Outbound share only, no accounts.
 */
export const StreakCard = React.forwardRef<ShotHandle | null, Props>(function StreakCard(
  { streak, shotRef },
  _ref,
) {
  const { t } = useStrings();
  const { theme, palette } = useTheme();
  const styles = React.useMemo(() => createStyles(palette), [palette]);
  return (
    <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={styles.shot}>
      <LinearGradient colors={theme.bg} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.card}>
        <View style={styles.header}>
          <Image source={require('../assets/mark.png')} style={styles.mark} resizeMode="contain" />
          <Text style={styles.brand}>{BRAND.SHORT_NAME.toUpperCase()}</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="flame" size={72} color={theme.accent} />
          <Text style={styles.number}>{streak}</Text>
          <Text style={styles.label}>{t('today.daysStraight', { n: streak })}</Text>
        </View>
        <Text style={styles.footer}>{t('today.streakShareTagline')}</Text>
      </LinearGradient>
    </ViewShot>
  );
});

function createStyles(p: ThemePalette) {
  return StyleSheet.create({
    shot: { width: '100%' },
    card: {
      borderColor: p.border,
      borderRadius: 24,
      borderWidth: 1,
      minHeight: 420,
      padding: 28,
      justifyContent: 'space-between',
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    mark: { width: 34, height: 34 },
    brand: { color: p.textDim, fontSize: 12, fontWeight: '800', letterSpacing: 4 },
    center: { alignItems: 'center', gap: 4, marginVertical: 24 },
    number: { color: p.text, fontSize: 96, fontWeight: '800', letterSpacing: -2, lineHeight: 110 },
    label: { color: p.text, fontSize: 22, fontWeight: '700' },
    footer: { color: p.textDim, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  });
}
