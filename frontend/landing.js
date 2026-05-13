document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const closeDrawerBtn = document.getElementById('close-drawer');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');

    const toggleDrawer = (isOpen) => {
        if (!mobileDrawer || !drawerOverlay) {
            return;
        }

        if (isOpen) {
            mobileDrawer.classList.add('open');
            drawerOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            return;
        }

        mobileDrawer.classList.remove('open');
        drawerOverlay.classList.remove('active');
        document.body.style.overflow = '';
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
});
