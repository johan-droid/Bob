"use client";

import type { ReactNode } from 'react';

type Props = {
  activeTab?: 'pipeline' | 'activity' | 'settings';
  userName?: string;
  rightSlot?: ReactNode;
};

const navLinks = [
  { href: '/org/dashboard', hash: '#pipeline-health', key: 'pipeline', label: 'Pipeline Health' },
  { href: '/org/dashboard', hash: '#team-velocity', key: 'activity', label: 'Activity Feed' },
  { href: '/org/settings', hash: '', key: 'settings', label: 'Repo Settings' },
] as const;

export function AppNav({ activeTab, userName, rightSlot }: Props) {
  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md w-full">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <a href="/org/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand to-emerald-400 flex items-center justify-center font-bold text-white shadow-lg shadow-brand/20 group-hover:scale-105 transition-transform">
              B
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Bob Org
            </span>
          </a>
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = activeTab === link.key;
              const href = link.hash ? `${link.href}${link.hash}` : link.href;
              return (
                <a
                  key={link.key}
                  href={href}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                    isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {rightSlot}
          <div
            className="w-8 h-8 rounded-full bg-zinc-800 border border-border flex items-center justify-center font-bold text-sm text-brand"
            title={userName || ''}
          >
            {(userName || 'U')[0].toUpperCase()}
          </div>
        </div>
      </div>
    </nav>
  );
}
