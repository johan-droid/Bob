document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('navbar');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const closeDrawerBtn = document.getElementById('close-drawer');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const demoCard = document.querySelector('[data-tilt-card]');
    const segmentButtons = Array.from(document.querySelectorAll('[data-demo]'));
    const queryText = document.getElementById('demo-query');
    const metricOpen = document.getElementById('metric-open');
    const metricAge = document.getElementById('metric-age');
    const metricOwners = document.getElementById('metric-owners');
    const signalList = document.getElementById('signal-list');

    const demoStates = {
        conflicts: {
            query: 'show merge conflicts across active repos',
            open: '8',
            age: '31m',
            owners: '6',
            rows: [
                ['blue', 'platform/auth', 'PR #482 has a base branch conflict', 'Needs owner', 'warning'],
                ['yellow', 'mobile/release', 'PR #119 is blocked by changed lockfiles', 'Reviewing', 'warning'],
                ['green', 'api/scanner', 'Conflict cleared and ready to merge', 'Ready', 'success'],
            ],
        },
        ci: {
            query: 'group failing workflows by owner and repo',
            open: '13',
            age: '18m',
            owners: '9',
            rows: [
                ['red', 'web/dashboard', 'Workflow failed after dependency install', 'Failing CI', 'danger'],
                ['yellow', 'data/jobs', 'Scheduled scan timed out on deploy preview', 'Retrying', 'warning'],
                ['blue', 'infra/render', 'Build passed after Python pin update', 'Recovered', 'success'],
            ],
        },
        ready: {
            query: 'show clean pull requests waiting on merge',
            open: '21',
            age: '7m',
            owners: '12',
            rows: [
                ['green', 'api/scanner', 'All checks green and ready to merge', 'Ready', 'success'],
                ['blue', 'frontend/auth', 'OAuth route fix verified in preview', 'Ready', 'success'],
                ['yellow', 'docs/setup', 'Review approved, waiting on final owner', 'Queued', 'warning'],
            ],
        },
    };

    const toggleDrawer = (isOpen) => {
        if (!mobileDrawer || !drawerOverlay) {
            return;
        }

        mobileDrawer.classList.toggle('open', isOpen);
        drawerOverlay.classList.toggle('active', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    const setNavState = () => {
        if (!nav) {
            return;
        }

        nav.classList.toggle('scrolled', window.scrollY > 24);
    };

    const renderRows = (rows) => {
        if (!signalList) {
            return;
        }

        signalList.innerHTML = rows.map((row, index) => {
            const [color, repo, detail, status, tone] = row;
            return `
                <article class="signal-row ${index === 0 ? 'active' : ''}">
                    <span class="repo-dot ${color}"></span>
                    <div>
                        <strong>${repo}</strong>
                        <p>${detail}</p>
                    </div>
                    <span class="status ${tone}">${status}</span>
                </article>
            `;
        }).join('');
    };

    const updateDemo = (mode) => {
        const state = demoStates[mode] || demoStates.conflicts;

        segmentButtons.forEach((button) => {
            const isActive = button.dataset.demo === mode;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });

        if (queryText) queryText.textContent = state.query;
        if (metricOpen) metricOpen.textContent = state.open;
        if (metricAge) metricAge.textContent = state.age;
        if (metricOwners) metricOwners.textContent = state.owners;
        renderRows(state.rows);
    };

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => toggleDrawer(true));
    }

    if (closeDrawerBtn) {
        closeDrawerBtn.addEventListener('click', () => toggleDrawer(false));
    }

    if (drawerOverlay) {
        drawerOverlay.addEventListener('click', () => toggleDrawer(false));
    }

    mobileDrawer?.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => toggleDrawer(false));
    });

    segmentButtons.forEach((button) => {
        button.addEventListener('click', () => updateDemo(button.dataset.demo));
    });

    if (demoCard && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        demoCard.addEventListener('mousemove', (event) => {
            const rect = demoCard.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            demoCard.style.transform = `rotateX(${y * -4}deg) rotateY(${x * 5}deg)`;
        });

        demoCard.addEventListener('mouseleave', () => {
            demoCard.style.transform = '';
        });
    }

    setNavState();
    updateDemo('conflicts');
    window.addEventListener('scroll', setNavState, { passive: true });
});
