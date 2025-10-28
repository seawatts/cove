import { H2, Text } from '@cove/ui/custom/typography';

export default function SettingsPage() {
  return (
    <div className="grid gap-6 p-6">
      <div className="grid gap-2">
        <H2>Settings</H2>
        <Text variant="muted">Manage your Cove home automation settings</Text>
      </div>

      <div className="text-center text-muted-foreground py-8">
        Settings coming soon
      </div>
    </div>
  );
}
