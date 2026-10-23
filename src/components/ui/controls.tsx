'use client';

import React from 'react';
import { QuinticGrade } from '@/lib/types';

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" className="inline-flex w-full rounded-lg bg-club-950/70 p-1 ring-1 ring-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-md font-semibold transition-colors ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
              active ? 'bg-chalk text-club-950 shadow-sm' : 'text-mist hover:text-chalk'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium text-chalk">{label}</span>
        {hint && <span className="block text-xs text-fog">{hint}</span>}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? 'bg-flag' : 'bg-club-700'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-club-950 transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

export function Field({ label, value, children }: { label: string; value?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-mist">{label}</span>
        {value !== undefined && <span className="num text-lg font-semibold text-chalk">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export const GRADE_META: Record<QuinticGrade, { label: string; cls: string; dot: string }> = {
  eagle: { label: 'Eagle', cls: 'text-eagle', dot: 'bg-eagle' },
  birdie: { label: 'Birdie', cls: 'text-birdie', dot: 'bg-birdie' },
  par: { label: 'Par', cls: 'text-par', dot: 'bg-par' },
  bogey: { label: 'Bogey', cls: 'text-bogey', dot: 'bg-bogey' },
};

export function Grade({ grade, className = '' }: { grade: QuinticGrade; className?: string }) {
  const g = GRADE_META[grade];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${g.cls} ${className}`}>
      <span className={`h-2 w-2 rounded-full ${g.dot}`} />
      {g.label}
    </span>
  );
}

export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-club-900/90 ring-1 ring-line ${className}`}>{children}</section>;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'quiet';
  className?: string;
  disabled?: boolean;
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40';
  const v = variant === 'primary' ? 'bg-flag text-flag-ink hover:bg-[#ffd765]' : 'bg-club-800 text-chalk ring-1 ring-line hover:bg-club-700';
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${v} ${className}`}>
      {children}
    </button>
  );
}

export const signed = (v: number, digits = 1) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;
