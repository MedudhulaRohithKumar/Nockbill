import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className = '',
  size = 'md',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const selectedOption = options.find((o) => o.value === value);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Scroll active option into view
  useEffect(() => {
    if (isOpen && listRef.current && highlightIdx >= 0) {
      const items = listRef.current.children;
      if (items[highlightIdx]) {
        (items[highlightIdx] as HTMLLIElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIdx, isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlightIdx(idx >= 0 ? idx : 0);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        const idx = options.findIndex((o) => o.value === value);
        setHighlightIdx(idx >= 0 ? idx : 0);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((prev) => Math.min(prev + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightIdx >= 0 && highlightIdx < options.length) {
          handleSelect(options[highlightIdx].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1.5 text-xs'
    : 'px-3 py-2 text-sm';

  const optionSizeClasses = size === 'sm'
    ? 'px-2.5 py-1.5 text-xs'
    : 'px-3 py-2 text-sm';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full ${sizeClasses} border border-slate-300 rounded-lg bg-white text-left flex items-center justify-between gap-2 transition-all
          focus:ring-2 focus:ring-emerald-500 focus:outline-none
          hover:border-emerald-400
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isOpen ? 'ring-2 ring-emerald-500 border-emerald-400' : ''}
        `}
      >
        <span className={`truncate ${selectedOption ? 'text-slate-900' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/60 py-1 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isHighlighted = idx === highlightIdx;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={`${optionSizeClasses} cursor-pointer flex items-center justify-between gap-2 transition-colors
                  ${isHighlighted ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700 hover:bg-slate-50'}
                  ${isSelected ? 'font-semibold' : 'font-normal'}
                `}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
