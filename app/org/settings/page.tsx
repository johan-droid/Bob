import { SiteHeader } from '@/components/site-header';
import { SettingsForm } from '@/components/settings-form';

export default function OrgSettingsPage() {
  return (
    <>
      <SiteHeader minimal />
      <main className="page settings-page">
        <SettingsForm />
      </main>
    </>
  );
}