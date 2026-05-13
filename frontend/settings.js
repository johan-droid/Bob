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
    if (!excludedRepos.length) {
        el.innerHTML = '<span style="font-size:.8rem;color:var(--text-3);padding:4px 0">No repositories excluded yet</span>';
        return;
    }
    el.innerHTML = excludedRepos.map((r, i) =>
        `<span class="s-tag">${r}<button class="s-tag-x" onclick="removeExcluded(${i})" title="Remove">✕</button></span>`
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
    const btn = document.getElementById('save-btn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="10" style="animation:spin .7s linear infinite"/></svg> Saving…';
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
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
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
