require('dotenv').config();
const { PRHealthScanner, runScanForUser } = require('../lib/scanner');
const db = require('../lib/db');

async function main() {
  const token = process.env.ORG_PAT || process.env.GITHUB_TOKEN;
  const rawRepos = process.env.INPUT_REPO || process.env.TARGET_REPOS || '';
  const repos = rawRepos.split(',').map(r => r.trim()).filter(Boolean);
  const assignee = process.env.ASSIGNEE_USERNAME || 'jules';

  const dbUrl = process.env.DATABASE_URL;

  // Mode 1: DB Sync Mode (if DATABASE_URL is available)
  if (dbUrl) {
    console.log('> Running in Database Sync Mode...');
    try {
      await db.initDatabase();
      const users = await db.query('SELECT id, username FROM users');
      
      if (users.length === 0) {
        console.log('> No users found in database. Exiting.');
        return;
      }

      for (const u of users) {
        console.log(`> Scanning for user: ${u.username} (ID: ${u.id})`);
        await runScanForUser(u.id);
      }
      console.log('> Database scan completed successfully.');
    } catch (err) {
      console.error('> Database sync mode error:', err);
      process.exit(1);
    }
    return;
  }

  // Mode 2: Standalone CLI Mode (directly scanning repos via GitHub API)
  console.log('> Running in Standalone CLI Mode...');
  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable is required.');
    process.exit(1);
  }

  let reposToScan = [...repos];
  if (reposToScan.length === 0) {
    console.log('> TARGET_REPOS not set. Fetching authenticated user\'s repositories dynamically...');
    try {
      const res = await fetch('https://api.github.com/user/repos?per_page=100', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Bob-PR-Health-Scanner'
        }
      });
      if (res.ok) {
        const data = await res.json();
        reposToScan = data.map(repo => repo.full_name).filter(Boolean);
        console.log(`> Discovered ${reposToScan.length} repositories: ${reposToScan.join(', ')}`);
      } else {
        const text = await res.text();
        console.error(`> Failed to fetch repositories: HTTP ${res.status} - ${text}`);
      }
    } catch (err) {
      console.error('> Error fetching repositories dynamically:', err);
    }
  }

  if (reposToScan.length === 0) {
    console.error('Error: No repositories to scan. Set TARGET_REPOS or grant repository access.');
    process.exit(1);
  }

  try {
    const scanner = new PRHealthScanner(token, reposToScan, assignee, true, false);
    const results = await scanner.scanAllRepos();
    
    for (const r of results) {
      console.log(`\n${r.repo}: ${r.total_prs} PRs, ` +
        `${r.conflicting_prs.length} conflicts, ` +
        `${r.workflow_failures.length} CI failures, ` +
        `${r.review_issues.length} review issues, ` +
        `${r.stale_prs.length} stale PRs, ` +
        `${r.oversized_prs.length} oversized PRs`
      );
    }
    console.log('\n> Standalone scan finished successfully.');
  } catch (err) {
    console.error('> Scan failed:', err);
    process.exit(1);
  }
}

main();
