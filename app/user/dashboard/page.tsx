import { SiteHeader } from '@/components/site-header';
import { DashboardView } from '@/components/dashboard-view';

export default function UserDashboardPage() {
  return (
    <>
      <SiteHeader minimal />
      <main className="page">
        <DashboardView mode="user" />
      </main>
    </>
  );
}