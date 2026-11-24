import React, { useState, useRef, useEffect } from 'react';
import { Info, X } from 'lucide-react';

export interface MetricInfoTooltipProps {
  title: string;
  description: string;
  formula?: string;
  tip?: string;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export const MetricInfoTooltip: React.FC<MetricInfoTooltipProps> = ({
  title,
  description,
  formula,
  tip,
  className = '',
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const alignmentClasses =
    align === 'right'
      ? 'right-0'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : 'left-0 sm:left-auto';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        aria-label={`Info about ${title}`}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="inline-flex items-center justify-center p-0.5 rounded-full text-slate-400 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors cursor-help"
      >
        <Info className="w-3.5 h-3.5 stroke-[2.2]" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className={`absolute top-full mt-1.5 z-50 w-72 sm:w-80 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl backdrop-blur-md text-left text-xs transition-all animate-in fade-in zoom-in-95 duration-150 ${alignmentClasses}`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              <h4 className="font-bold text-slate-900 dark:text-white text-xs tracking-tight">
                {title}
              </h4>
            </div>
            <button
              type="button"
              aria-label="Close tooltip"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Description */}
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {description}
          </p>

          {/* Formula / Calculation */}
          {formula && (
            <div className="mt-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-700 dark:text-slate-300">
              <span className="font-sans font-bold text-slate-500 dark:text-slate-400 block text-[9px] uppercase tracking-wider mb-0.5">
                Calculation / Rule
              </span>
              {formula}
            </div>
          )}

          {/* Tip / Business Guidance */}
          {tip && (
            <div className="mt-2 text-[10px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/80 px-2.5 py-1.5 rounded-xl font-medium">
              💡 {tip}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
