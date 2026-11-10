import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { MoodCheckIn } from '../../components/MoodCheckIn';
import { getMoodHistory, saveMood, todayKey, type MoodEntry } from '../../lib/storage';
import { useTheme } from '../../lib/themeContext';

/**
 * Mood Check-In — separate screen (not a popup). Same component as the
 * old sheet, on a full screen: it loads today's check-in itself, and
 * its ✕ closes back to Journal.
 */
export default function MoodScreen() {
  const { palette } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [todayMood, setTodayMood] = useState<MoodEntry | null>(null);

  useEffect(() => {
    getMoodHistory().then((history) => {
      setTodayMood(history.find((m) => m.date === todayKey()) ?? null);
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={palette.textDim} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <MoodCheckIn
        initial={
          todayMood
            ? { valence: todayMood.valence, emotions: todayMood.emotions }
            : null
        }
        onSave={async (valence, emotions) => {
          await saveMood(valence, emotions);
        }}
        onClose={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
