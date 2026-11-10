import { LegalDoc } from '../../components/LegalDoc';
import { useStrings } from '../../lib/i18n';

/**
 * Why We Built This — separate screen (not a popup).
 * Same text the old popup showed, on the shared legal-doc screen.
 */
export default function WhyScreen() {
  const { t } = useStrings();
  return (
    <LegalDoc
      title={t('settings.whyBuilt')}
      updated=""
      sections={[{ body: t('settings.whyBuiltBody') }]}
    />
  );
}
