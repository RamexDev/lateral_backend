// Branded splash screen — "Two paths converging" metaphor.
// Two dots (representing two employees at the same bank) travel along curved
// paths from opposite edges of the screen, leave faint trails, and converge
// at center where they form the Zwuwur mark. As they meet, a subtle pulse
// radiates outward — the "match" moment.
//
// Shown once per session (gated by sessionStorage flag).
// Respects prefers-reduced-motion.

import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n';

interface SplashScreenProps {
  onDone: () => void;
}

const SPLASH_DURATION_MS = 2500;

export function SplashScreen({ onDone }: SplashScreenProps) {
  const t = useT();
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), SPLASH_DURATION_MS - 300);
    const doneTimer = setTimeout(onDone, SPLASH_DURATION_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-brand"
      style={{
        animation: fadingOut ? 'splash-fade-out 300ms ease-out forwards' : undefined
      }}
    >
      <div className="relative flex h-64 w-64 items-center justify-center">
        {/* Pulse rings emanating from center */}
        <div
          className="absolute h-24 w-24 rounded-full border-2 border-white/40"
          style={{ animation: 'splash-pulse 2.5s ease-out infinite' }}
        />
        <div
          className="absolute h-24 w-24 rounded-full border-2 border-white/30"
          style={{ animation: 'splash-pulse 2.5s ease-out infinite', animationDelay: '0.8s' }}
        />

        {/* Left dot — travels from top-left along a curved path to center */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 256 256"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Define curved paths for the two dots */}
          <defs>
            <path
              id="splash-path-left"
              d="M 16 64 Q 64 16, 128 128"
              fill="none"
            />
            <path
              id="splash-path-right"
              d="M 240 64 Q 192 16, 128 128"
              fill="none"
            />
          </defs>

          {/* Faint trail of the paths */}
          <use href="#splash-path-left" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <use href="#splash-path-right" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

          {/* Left dot */}
          <circle r="6" fill="white" style={{ offsetPath: "path('M 16 64 Q 64 16, 128 128')", animation: 'splash-dot-left 1.2s var(--ease-out) forwards' }} />
          {/* Right dot */}
          <circle r="6" fill="white" style={{ offsetPath: "path('M 240 64 Q 192 16, 128 128')", animation: 'splash-dot-right 1.2s var(--ease-out) forwards' }} />
        </svg>

        {/* Zwuwur mark — fades in after dots converge */}
        <div
          className="relative z-10 flex flex-col items-center"
          style={{ animation: 'splash-logo-in 2.5s ease-out forwards' }}
        >
          {/* Logo: two arrows converging into a square */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Left arrow pointing right */}
              <path d="M 4 11 L 14 11 L 14 7 L 22 14 L 14 21 L 14 17 L 4 17 Z" fill="#047857" />
              {/* Right arrow pointing left */}
              <path d="M 28 21 L 18 21 L 18 25 L 10 18 L 18 11 L 18 15 L 28 15 Z" fill="#047857" opacity="0.7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Wordmark + tagline */}
      <div
        className="mt-6 flex flex-col items-center gap-1"
        style={{ animation: 'splash-logo-in 2.5s ease-out forwards' }}
      >
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Zwuwur</h1>
        <p className="text-sm text-white/70">{t('splash.tagline')}</p>
      </div>
    </div>
  );
}
