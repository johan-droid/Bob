'use client';

import { useEffect } from 'react';

export function LandingClientLogic() {
  useEffect(() => {
    const nav = document.getElementById('navbar');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const closeDrawerBtn = document.getElementById('close-drawer');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const authCard = document.querySelector('.auth-panel') as HTMLElement;
    const typedWordsEl = document.getElementById('typed-words');
    const statNums = document.querySelectorAll('.stat-num');

    // Drawer Logic
    const toggleDrawer = (isOpen: boolean) => {
      if (!mobileDrawer || !drawerOverlay) return;
      mobileDrawer.classList.toggle('open', isOpen);
      drawerOverlay.classList.toggle('active', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    if (mobileMenuToggle) mobileMenuToggle.addEventListener('click', () => toggleDrawer(true));
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', () => toggleDrawer(false));
    if (drawerOverlay) drawerOverlay.addEventListener('click', () => toggleDrawer(false));
    
    mobileDrawer?.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => toggleDrawer(false));
    });

    // Nav scroll state
    const setNavState = () => {
      if (!nav) return;
      nav.classList.toggle('scrolled', window.scrollY > 24);
    };
    setNavState();
    window.addEventListener('scroll', setNavState, { passive: true });

    // Auth Card 3D effect
    if (authCard && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const handleMouseMove = (event: MouseEvent) => {
        const rect = authCard.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        authCard.style.transform = `perspective(1000px) rotateX(${y * -10}deg) rotateY(${x * 10}deg)`;
      };

      const handleMouseLeave = () => {
        authCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
        authCard.style.transition = 'transform 0.5s ease';
        setTimeout(() => { authCard.style.transition = ''; }, 500);
      };

      authCard.addEventListener('mousemove', handleMouseMove);
      authCard.addEventListener('mouseleave', handleMouseLeave);
    }

    // Typing Animation
    let typeTimeout: NodeJS.Timeout;
    if (typedWordsEl) {
      const words = ['always alive.', 'ready to act.', 'in one place.', 'without the noise.'];
      let wordIndex = 0;
      let charIndex = 0;
      let isDeleting = false;
      
      const type = () => {
        const currentWord = words[wordIndex];
        
        if (isDeleting) {
          typedWordsEl.textContent = currentWord.substring(0, charIndex - 1);
          charIndex--;
        } else {
          typedWordsEl.textContent = currentWord.substring(0, charIndex + 1);
          charIndex++;
        }
        
        let typeSpeed = isDeleting ? 50 : 100;
        
        if (!isDeleting && charIndex === currentWord.length) {
          typeSpeed = 2000;
          isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
          isDeleting = false;
          wordIndex = (wordIndex + 1) % words.length;
          typeSpeed = 500;
        }
        
        typeTimeout = setTimeout(type, typeSpeed);
      };
      
      typeTimeout = setTimeout(type, 1000);
    }

    // Number Counter Animation
    const animateValue = (obj: Element, start: number, end: number, duration: number) => {
      let startTimestamp: number | null = null;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toString();
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };
      window.requestAnimationFrame(step);
    };

    let observer: IntersectionObserver;
    if (statNums.length > 0) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const targetAttr = entry.target.getAttribute('data-target');
            if (targetAttr) {
              const target = parseInt(targetAttr, 10);
              animateValue(entry.target, 0, target, 2000);
              observer.unobserve(entry.target);
            }
          }
        });
      }, { threshold: 0.5 });
      
      statNums.forEach(num => observer.observe(num));
    }

    return () => {
      window.removeEventListener('scroll', setNavState);
      if (typeTimeout) clearTimeout(typeTimeout);
      if (observer) observer.disconnect();
    };
  }, []);

  return null;
}
