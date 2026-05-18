import { SiteHeader } from '@/components/site-header';
import { DashboardView } from '@/components/dashboard-view';

export default function OrgDashboardPage() {
  return (
    <>
      <SiteHeader minimal />
      <main className="page">
        <DashboardView mode="org" />
      </main>
    </>
  );
}