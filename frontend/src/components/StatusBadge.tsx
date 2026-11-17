import React from 'react';
import { RFQStatus } from '../types/rfq';

interface StatusBadgeProps {
  status: RFQStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-0.5 font-medium',
    lg: 'text-xs px-3 py-1 font-semibold',
  }[size];

  switch (status) {
    case 'ACTIVE':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          <span>Active</span>
        </span>
      );

    case 'UPCOMING':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 ${sizeClasses}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />
          <span>Upcoming</span>
        </span>
      );

    case 'FORCE_CLOSED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 ${sizeClasses}`}
          title="Auction reached maximum forced close ceiling"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
          <span>Force Closed</span>
        </span>
      );

    case 'CLOSED':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          <span>Closed</span>
        </span>
      );
  }
};
