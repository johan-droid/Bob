import { SiteHeader } from '@/components/site-header';
import { SetupFlow } from '@/components/setup-flow';

export default function PermissionsPage() {
  return (
    <>
      <SiteHeader minimal />
      <main className="page">
        <section className="section">
          <div className="section__head">
            <div>
              <div className="kicker">GitHub verification</div>
              <h2>Permissions and provisioning</h2>
            </div>
          </div>
          <SetupFlow portal="org" />
        </section>
      </main>
    </>
  );
}