import { redirect } from 'next/navigation';

export default function SettingsPage() {
  // Redirect to preferences page as the default settings page
  redirect('/app/settings/preferences');
}
