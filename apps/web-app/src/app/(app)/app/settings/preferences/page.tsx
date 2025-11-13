import { H2, Text } from '@cove/ui/custom/typography';
import { PreferencesForm } from './_components/preferences-form';

export default function PreferencesPage() {
  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-2">
        <H2>Preferences</H2>
        <Text variant="muted">
          Customize your Cove experience with these preferences
        </Text>
      </div>

      <PreferencesForm />
    </div>
  );
}
