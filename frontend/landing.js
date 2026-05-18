document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('navbar');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const closeDrawerBtn = document.getElementById('close-drawer');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const authCard = document.querySelector('.auth-panel');

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

    if (authCard && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        authCard.addEventListener('mousemove', (event) => {
            const rect = authCard.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            authCard.style.transform = `rotateX(${y * -4}deg) rotateY(${x * 5}deg)`;
        });

        authCard.addEventListener('mouseleave', () => {
            authCard.style.transform = '';
        });
    }

    setNavState();
    window.addEventListener('scroll', setNavState, { passive: true });
});
