import React, { useState, useEffect } from 'react';

export interface OrbitalLoaderProps {
  progress?: number;
  label?: string;
  subtext?: string;
  fullscreen?: boolean;
}

export const OrbitalLoader: React.FC<OrbitalLoaderProps> = ({
  progress: externalProgress,
  label = 'Loading NockBill OS...',
  subtext = 'Initializing fast-counter modules & secure grid...',
  fullscreen = true,
}) => {
  const [internalProgress, setInternalProgress] = useState<number>(14);

  useEffect(() => {
    if (externalProgress !== undefined) return;
    const interval = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev >= 98) return 98;
        const jump = Math.floor(Math.random() * 8) + 4;
        return Math.min(prev + jump, 98);
      });
    }, 160);
    return () => clearInterval(interval);
  }, [externalProgress]);

  const displayProgress = externalProgress !== undefined ? externalProgress : internalProgress;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center select-none ${
        fullscreen
          ? 'fixed inset-0 z-50 min-h-screen w-full bg-[#031c10] text-white px-4'
          : 'w-full py-12 text-white'
      }`}
    >
      {/* ─── ORBITAL ROTATING RINGS SYSTEM ─────────────────────────────────── */}
      <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center">
        {/* Outer Orbit Track */}
        <div className="absolute inset-0 rounded-full border border-emerald-500/20 border-dashed animate-[spin_16s_linear_infinite]" />

        {/* Orbit Ring 1 (Emerald Satellites - Clockwise) */}
        <div className="absolute inset-2 rounded-full border border-emerald-400/35 animate-[spin_7s_linear_infinite]">
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />
        </div>

        {/* Orbit Ring 2 (Teal Satellites - Counter-Clockwise, Tilted) */}
        <div
          className="absolute inset-6 rounded-full border border-teal-300/40 animate-[spin_4.5s_linear_infinite_reverse]"
          style={{ transform: 'rotate(45deg)' }}
        >
          <span className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-teal-300 shadow-[0_0_10px_#5eead4]" />
          <span className="absolute top-1/2 -right-1 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-teal-200" />
        </div>

        {/* Orbit Ring 3 (Inner Amber Orbit) */}
        <div className="absolute inset-11 rounded-full border border-amber-300/40 border-dotted animate-[spin_3s_linear_infinite]">
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" />
        </div>

        {/* Pulsing Core Aura */}
        <div className="absolute w-20 h-20 rounded-full bg-emerald-500/25 blur-xl animate-pulse" />

        {/* Center Progress Telemetry */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center">
          <div className="font-mono text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {Math.round(displayProgress)}
            <span className="text-emerald-400 text-sm ml-0.5 font-bold">%</span>
          </div>
          <span className="text-[9px] uppercase tracking-widest text-emerald-300 font-mono font-bold mt-0.5">
            SYNCING
          </span>
        </div>
      </div>

      {/* ─── TEXT TELEMETRY ─────────────────────────────────────────────────── */}
      <div className="mt-6 text-center space-y-1 px-4 max-w-sm">
        <h3 className="font-['Grandstander'] text-lg sm:text-xl font-black text-white tracking-tight drop-shadow-sm">
          {label}
        </h3>
        <p className="font-mono text-xs text-emerald-200/80 leading-relaxed">
          {subtext}
        </p>
      </div>

      {/* Progress Bar Indicator */}
      <div className="w-48 sm:w-56 h-1.5 bg-emerald-950/80 rounded-full overflow-hidden mt-5 border border-emerald-800/60">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 transition-all duration-300 rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, displayProgress))}%` }}
        />
      </div>
    </div>
  );
};
