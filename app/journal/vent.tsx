import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { VentSpace } from '../../components/VentSpace';
import {
  deleteVent,
  getVentEntries,
  saveVent,
  type VentEntry,
} from '../../lib/storage';
import { useTheme } from '../../lib/themeContext';

/**
 * Vent Space — separate screen (not a popup). Same component as the
 * old sheet, on a full screen: it loads its entries itself, and its
 * ✕ closes back to Journal.
 */
export default function VentScreen() {
  const { palette } = useTheme();
  const [entries, setEntries] = useState<VentEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setEntries(await getVentEntries());
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
      <VentSpace
        entries={entries}
        onSave={async (v) => {
          await saveVent(v);
          load();
        }}
        onDelete={async (id) => {
          await deleteVent(id);
          load();
        }}
        onClose={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
