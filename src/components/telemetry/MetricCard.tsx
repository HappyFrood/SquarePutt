'use client';

import React from 'react';
import { QuinticGrade } from '@/lib/types';
import { QuinticBadge } from '@/components/ui/QuinticBadge';
import { QUINTIC_TIERS } from '@/lib/calculations';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  idealRange?: string;
  grade?: QuinticGrade;
  subtext?: string;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  idealRange,
  grade = 'birdie',
  subtext,
  icon,
}) => {
  const tier = QUINTIC_TIERS[grade] || QUINTIC_TIERS.par;

  return (
    <div
      className={`sp-card p-3.5 relative overflow-hidden flex flex-col justify-between transition-all`}
      style={{
        borderTop: `2px solid ${tier.color}`,
      }}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
        </span>
        <QuinticBadge grade={grade} size="sm" showLabel={false} />
      </div>

      <div className="my-1 flex items-baseline gap-1.5">
        <span className="sp-mono text-2xl font-black tracking-tight text-slate-100">
          {value}
        </span>
        {unit && <span className="text-xs font-medium text-slate-400">{unit}</span>}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 border-t border-slate-800/80 pt-1.5">
        {idealRange ? (
          <span className="text-slate-500">
            Target: <span className="text-emerald-400/90 font-mono font-medium">{idealRange}</span>
          </span>
        ) : (
          <span>{subtext || 'Telemetry'}</span>
        )}
        <span className="font-semibold text-right" style={{ color: tier.color }}>
          {tier.label.split(' ')[0]}
        </span>
      </div>
    </div>
  );
};
