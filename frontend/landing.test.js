/**
 * @jest-environment jsdom
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, './landing.html'), 'utf8');
const js = fs.readFileSync(path.resolve(__dirname, './landing.js'), 'utf8');

describe('Bob Landing Page - Mobile Drawer Logic', () => {
    beforeEach(() => {
        document.documentElement.innerHTML = html.toString();
        eval(js);
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    test('Mobile drawer opens and closes when triggered', () => {
        const toggleBtn = document.getElementById('mobile-menu-toggle');
        const closeBtn = document.getElementById('close-drawer');
        const drawer = document.getElementById('mobile-drawer');
        const overlay = document.getElementById('drawer-overlay');

        expect(drawer.classList.contains('open')).toBe(false);

        toggleBtn.click();
        expect(drawer.classList.contains('open')).toBe(true);
        expect(overlay.classList.contains('active')).toBe(true);
        expect(document.body.style.overflow).toBe('hidden');

        closeBtn.click();
        expect(drawer.classList.contains('open')).toBe(false);
        expect(document.body.style.overflow).toBe('');
    });
});