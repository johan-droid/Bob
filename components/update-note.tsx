'use client';

import { useState, useEffect, useRef } from 'react';

export function UpdateNote() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const isHoveredRef = useRef<boolean>(false);
  const duration = 10000; // 10 seconds

  useEffect(() => {
    // Check if user has already dismissed this update note
    const dismissed = localStorage.getItem('bob_update_v2_dismissed');
    if (dismissed) return;

    // Show after a small delay
    const t = setTimeout(() => {
      setVisible(true);
      startTimeRef.current = Date.now();
      startTimer();
    }, 1000);

    return () => {
      clearTimeout(t);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now() - elapsedRef.current;
    
    timerRef.current = setInterval(() => {
      if (isHoveredRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      elapsedRef.current = elapsed;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (elapsed >= duration) {
        handleDismiss();
      }
    }, 50);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('bob_update_v2_dismissed', 'true');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    startTimeRef.current = Date.now() - elapsedRef.current;
  };

  if (!visible) return null;

  return (
    <div
      className="update-toast-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="update-toast-header">
        <span className="material-symbols-outlined update-toast-icon">verified</span>
        <div className="update-toast-title-area">
          <strong className="update-toast-title">What's New in Bob v2.0</strong>
          <span className="update-toast-tag">Release Note</span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="update-toast-close"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="update-toast-body">
        <p className="update-toast-desc">
          We've eliminated legacy Flask/Python constraints for a unified stack!
        </p>
        <ul className="update-toast-list">
          <li>
            <span className="material-symbols-outlined">devices</span>
            <div className="update-toast-li-text">
              <strong>Mobile-First Dashboard:</strong> Touch swipe actions, bottom dock & layout optimized for one hand.
            </div>
          </li>
          <li>
            <span className="material-symbols-outlined">bolt</span>
            <div className="update-toast-li-text">
              <strong>Parallel Setup Sync:</strong> Workspace repos discovery and invitations run in parallel (up to 10x faster).
            </div>
          </li>
          <li>
            <span className="material-symbols-outlined">memory</span>
            <div className="update-toast-li-text">
              <strong>Offline-First Caching:</strong> Instant dashboard loads utilizing intelligent client-side database caching.
            </div>
          </li>
        </ul>
      </div>
      <div className="update-toast-timer-bg">
        <div className="update-toast-timer-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
