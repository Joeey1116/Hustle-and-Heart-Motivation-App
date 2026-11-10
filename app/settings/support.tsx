import { LegalDoc } from '../../components/LegalDoc';
import { useStrings } from '../../lib/i18n';

/**
 * Support Resources — separate screen (not a popup).
 * Same text the old popup showed, on the shared legal-doc screen.
 */
export default function SupportScreen() {
  const { t } = useStrings();
  return (
    <LegalDoc
      title={t('settings.supportResources')}
      updated=""
      sections={[{ body: t('settings.supportBody') }]}
    />
  );
}
