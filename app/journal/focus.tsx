import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { FocusTimer } from '../../components/FocusTimer';

/**
 * Focus Timer — separate screen (not a popup), same pattern as Breathe:
 * its ✕ closes back to Journal.
 */
export default function FocusScreen() {
  return (
    <Screen>
      <FocusTimer onClose={() => router.back()} />
    </Screen>
  );
}
