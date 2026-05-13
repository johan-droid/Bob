document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const navDrawer = document.getElementById('nav-drawer');
    const saveButton = document.getElementById('global-save-btn');
    const syncButton = document.getElementById('force-sync-btn');
    const syncStatus = document.querySelector('.sync-text');
    const inputs = [
        document.getElementById('slack-webhook'),
        document.getElementById('discord-webhook'),
        document.getElementById('rule-label-conflict'),
        document.getElementById('rule-tag-author'),
    ].filter(Boolean);

    const snapshotState = () => ({
        slackWebhook: document.getElementById('slack-webhook')?.value || '',
        discordWebhook: document.getElementById('discord-webhook')?.value || '',
        autoLabelConflict: document.getElementById('rule-label-conflict')?.checked || false,
        tagAuthorOnFail: document.getElementById('rule-tag-author')?.checked || false,
    });

    let initialState = snapshotState();

    const setSaveState = () => {
        const isDirty = JSON.stringify(snapshotState()) !== JSON.stringify(initialState);
        saveButton.disabled = !isDirty;
        saveButton.textContent = isDirty ? 'Save Changes' : 'Save Changes';
    };

    if (menuToggle && navDrawer) {
        menuToggle.addEventListener('click', () => {
            navDrawer.classList.toggle('open');
        });

        document.addEventListener('click', (event) => {
            if (window.innerWidth <= 900 && !navDrawer.contains(event.target) && !menuToggle.contains(event.target)) {
                navDrawer.classList.remove('open');
            }
        });
    }

    inputs.forEach((input) => {
        input.addEventListener('input', setSaveState);
        input.addEventListener('change', setSaveState);
    });

    saveButton.addEventListener('click', () => {
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        const payload = snapshotState();
        console.info('Saving org settings payload', payload);

        window.setTimeout(() => {
            initialState = snapshotState();
            saveButton.textContent = 'Saved';
            window.setTimeout(() => {
                setSaveState();
            }, 1200);
        }, 800);
    });

    syncButton.addEventListener('click', () => {
        const original = syncButton.textContent;
        syncButton.disabled = true;
        syncButton.textContent = 'Syncing...';

        if (syncStatus) {
            const statusLine = syncStatus.querySelector('strong');
            const detailLine = syncStatus.querySelector('span');
            if (statusLine) statusLine.textContent = 'Sync Requested';
            if (detailLine) detailLine.textContent = 'Awaiting the GitHub App sync worker.';
        }

        window.setTimeout(() => {
            syncButton.disabled = false;
            syncButton.textContent = original;
        }, 1200);
    });

    setSaveState();
});