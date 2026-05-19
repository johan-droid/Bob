import { SiteHeader } from '@/components/site-header';
import { SetupFlow } from '@/components/setup-flow';

export default function PermissionsPage() {
  return (
    <>
      <SiteHeader minimal />
      <main className="page" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <SetupFlow portal="org" />
      </main>
    </>
  );
}