import { DashboardView } from '@/components/dashboard-view';

const demoData = {
  pending: [
    { id: 1, repo: 'acme/frontend', title: 'Fix vulnerability in dependency', branch: 'fix/security', pr_number: 412, type: 'pr_risk', status: 'pending' },
    { id: 2, repo: 'acme/backend', title: 'Resolve merge conflict in main', branch: 'feature/merge', pr_number: 98, type: 'merge_conflict', status: 'pending' }
  ],
  in_progress: [
    { id: 3, repo: 'acme/mobile', title: 'CI failing on iOS tests', branch: 'ci-fix', pr_number: 221, type: 'ci_failure', status: 'in_progress' }
  ],
  failed: [
    { id: 4, repo: 'acme/tools', title: 'Broken release workflow', branch: 'release', pr_number: 13, type: 'ci_failure', status: 'failed' }
  ],
  resolved: [
    { id: 5, repo: 'acme/docs', title: 'Docs PR merged', branch: 'docs-update', pr_number: 4, type: 'pr_risk', status: 'resolved' }
  ],
  repos: [
    { full_name: 'acme/frontend', language: 'TypeScript', permission: 'admin', issue_count: 2, is_active: true },
    { full_name: 'acme/backend', language: 'Python', permission: 'write', issue_count: 1, is_active: true },
    { full_name: 'acme/mobile', language: 'Swift', permission: 'write', issue_count: 1, is_active: true },
    { full_name: 'acme/tools', language: 'Go', permission: 'read', issue_count: 1, is_active: false }
  ]
};

export default function DemoDashboardPage() {
  return <DashboardView mode="org" demo demoData={demoData} />;
}
