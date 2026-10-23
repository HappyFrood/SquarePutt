'use client';

import React from 'react';
import { QuinticGrade } from '@/lib/types';
import { QUINTIC_TIERS } from '@/lib/calculations';

interface QuinticBadgeProps {
  grade: QuinticGrade;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const QuinticBadge: React.FC<QuinticBadgeProps> = ({
  grade,
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  const info = QUINTIC_TIERS[grade] || QUINTIC_TIERS.par;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  }[size];

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border transition-all ${sizeClasses} ${className}`}
      style={{
        backgroundColor: info.bgRgba,
        borderColor: info.borderHex,
        color: info.color,
      }}
      title={info.description}
    >
      <span
        className={`rounded-full shadow-sm animate-pulse ${dotSizes}`}
        style={{ backgroundColor: info.color }}
      />
      {showLabel && <span>{info.label.split(' ')[0]}</span>}
    </span>
  );
};
