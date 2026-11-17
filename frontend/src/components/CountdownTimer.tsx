import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { RFQStatus } from '../types/rfq';
import { parseUTC } from '../utils/date';

interface CountdownTimerProps {
  bidStartTime: string;
  bidCloseTime: string;
  forcedCloseTime?: string;
  triggerWindowMins: number;
  extensionDurationMins?: number;
  status: RFQStatus;
  variant?: 'compact' | 'detail' | 'hero';
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  bidStartTime,
  bidCloseTime,
  triggerWindowMins,
  extensionDurationMins,
  status,
  variant = 'compact',
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
    isInTriggerWindow: boolean;
    isUpcoming: boolean;
    isEnded: boolean;
  }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalSeconds: 0,
    isInTriggerWindow: false,
    isUpcoming: false,
    isEnded: false,
  });

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const start = parseUTC(bidStartTime).getTime();
      const close = parseUTC(bidCloseTime).getTime();

      if (now < start) {
        const diff = Math.max(0, Math.floor((start - now) / 1000));
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        setTimeLeft({
          hours,
          minutes,
          seconds,
          totalSeconds: diff,
          isInTriggerWindow: false,
          isUpcoming: true,
          isEnded: false,
        });
      } else if (now < close) {
        const diff = Math.max(0, Math.floor((close - now) / 1000));
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        const triggerWindowSeconds = triggerWindowMins * 60;
        const inWindow = diff > 0 && diff <= triggerWindowSeconds;

        setTimeLeft({
          hours,
          minutes,
          seconds,
          totalSeconds: diff,
          isInTriggerWindow: inWindow,
          isUpcoming: false,
          isEnded: false,
        });
      } else {
        setTimeLeft({
          hours: 0,
          minutes: 0,
          seconds: 0,
          totalSeconds: 0,
          isInTriggerWindow: false,
          isUpcoming: false,
          isEnded: true,
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [bidStartTime, bidCloseTime, triggerWindowMins]);

  const pad = (n: number) => String(n).padStart(2, '0');

  if (status === 'CLOSED' || status === 'FORCE_CLOSED' || timeLeft.isEnded) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-slate-500 font-mono tabular-nums ${variant !== 'compact' ? 'text-sm' : 'text-xs'}`}>
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span>Closed</span>
      </div>
    );
  }

  if (timeLeft.isUpcoming) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-sky-700 font-mono tabular-nums ${variant !== 'compact' ? 'text-sm' : 'text-xs'}`}>
        <Clock className="h-3.5 w-3.5 text-sky-500" />
        <span>Starts in {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}</span>
      </div>
    );
  }

  if (variant === 'detail' || variant === 'hero') {
    return (
      <div className="flex flex-col gap-1.5">
        <div
          className={`flex items-center gap-3 px-3.5 py-2 rounded-lg border transition-colors ${
            timeLeft.isInTriggerWindow
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <Clock className={`h-4 w-4 ${timeLeft.isInTriggerWindow ? 'text-amber-600' : 'text-slate-400'}`} />
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              {timeLeft.isInTriggerWindow ? 'Trigger Window Active' : 'Time Remaining'}
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {pad(timeLeft.hours)}h {pad(timeLeft.minutes)}m {pad(timeLeft.seconds)}s
            </div>
          </div>
        </div>

        {timeLeft.isInTriggerWindow && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
            <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
            <span>
              Inside {triggerWindowMins}m window. Qualifying bids extend by +{extensionDurationMins || 10}m.
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono tabular-nums border ${
        timeLeft.isInTriggerWindow
          ? 'bg-amber-50 border-amber-200 text-amber-900 font-medium'
          : 'bg-slate-100 border-slate-200 text-slate-700'
      }`}
    >
      <Clock className="h-3 w-3 text-slate-400" />
      <span>
        {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
      </span>
      {timeLeft.isInTriggerWindow && (
        <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-100 px-1 rounded">
          Window
        </span>
      )}
    </div>
  );
};
