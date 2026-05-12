/* settings.js — Bob settings page */
const CSRF = document.querySelector('meta[name="csrf-token"]')?.content || '';
let excludedRepos = [];

async function apiFetch(url, opts = {}) {
    const r = await fetch(url, {
        ...opts,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF, ...(opts.headers || {}) },
    });
    if (!r.ok) throw new Error((await r.json().catch(()=>({}))).error || `HTTP ${r.status}`);
    return r.json();
}

function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `s-toast ${type}`;
    el.innerHTML = `<span>${type==='success'?'✅':'❌'}</span><span>${msg}</span>`;
    document.getElementById('toast-container').prepend(el);
    setTimeout(() => el.remove(), 3500);
}

function renderExcluded() {
    const el = document.getElementById('excluded-list');
    el.innerHTML = excludedRepos.map((r, i) =>
        `<span class="s-excluded-tag">${r}<button onclick="removeExcluded(${i})">✕</button></span>`
    ).join('');
}

function addExcluded() {
    const inp = document.getElementById('excluded-input');
    const val = inp.value.trim();
    if (val && val.includes('/') && !excludedRepos.includes(val)) {
        excludedRepos.push(val);
        renderExcluded();
    }
    inp.value = '';
}

function removeExcluded(i) {
    excludedRepos.splice(i, 1);
    renderExcluded();
}

async function handlePushToggle(checkbox) {
    if (!checkbox.checked) return;
    if (!('Notification' in window)) {
        toast('Browser notifications not supported', 'error');
        checkbox.checked = false;
        return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
        toast('Notification permission denied', 'error');
        checkbox.checked = false;
    }
}

async function saveSettings() {
    try {
        await apiFetch('/api/settings', {
            method: 'POST',
            body: JSON.stringify({
                scan_interval:  parseInt(document.getElementById('scan-interval').value),
                excluded_repos: excludedRepos,
                notify_in_app:  document.getElementById('notify-in-app').checked,
            }),
        });
        toast('Settings saved!', 'success');
    } catch (e) {
        toast(`Save failed: ${e.message}`, 'error');
    }
}

// Load on page start
(async () => {
    try {
        const data = await apiFetch('/api/settings');
        document.getElementById('notify-in-app').checked = data.notify_in_app ?? true;
        document.getElementById('scan-interval').value = String(data.scan_interval ?? 300);
        excludedRepos = data.excluded_repos || [];
        renderExcluded();
        document.getElementById('notify-push').checked = Notification.permission === 'granted';
    } catch (e) {
        toast(`Could not load settings: ${e.message}`, 'error');
    }
})();
