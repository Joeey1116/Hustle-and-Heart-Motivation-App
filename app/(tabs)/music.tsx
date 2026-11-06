import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { MusicPlayer } from '../../components/MusicPlayer';
import { Spacing, Type } from '../../lib/design';
import type { ThemePalette } from '../../lib/themes';
import { useTheme } from '../../lib/themeContext';
import { getPlan } from '../../lib/storage';
import { useStrings } from '../../lib/i18n';

/**
 * Music tab — promoted to a full tab in 2.0 (it was its own screen
 * reached from the Today tab before that; the Haven AI companion tab
 * it replaces was removed in 2.0). Playback keeps going when you
 * leave this screen or background the app (see lib/music.ts).
 */
export default function MusicScreen() {
  const { palette } = useTheme();
  const { t } = useStrings();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [isPlus, setIsPlus] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getPlan().then((p) => setIsPlus(p === 'haven-plus'));
    }, [])
  );

  return (
    <Screen>
      <View style={styles.body}>
        <Text style={styles.h1}>{t('music.title')}</Text>
        <MusicPlayer isHavenPlus={isPlus} />
      </View>
    </Screen>
  );
}

function createStyles(p: ThemePalette) {
  return StyleSheet.create({
    body: { padding: Spacing.lg, gap: Spacing.sm, flex: 1 },
    h1: { ...Type.display, color: p.text },
  });
}
