import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Breathe } from '../../components/Breathe';
import { logBreatheSession } from '../../lib/storage';

/**
 * Breathe — separate screen (not a popup). Same component as the old
 * sheet, on a full screen: its ✕ closes back to Journal.
 */
export default function BreatheScreen() {
  return (
    <Screen>
      <Breathe
        onComplete={async (exerciseId, minutes) => {
          await logBreatheSession(exerciseId, minutes);
        }}
        onClose={() => router.back()}
      />
    </Screen>
  );
}
