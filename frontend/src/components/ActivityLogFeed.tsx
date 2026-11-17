import React from 'react';
import { AuctionLog } from '../types/rfq';
import { Clock, ArrowRight } from 'lucide-react';
import { formatDisplayTime } from '../utils/date';

interface ActivityLogFeedProps {
  logs: AuctionLog[];
}

export const ActivityLogFeed: React.FC<ActivityLogFeedProps> = ({ logs }) => {
  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'TIME_EXTENDED':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'BID_SUBMITTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'FORCE_CLOSED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'RFQ_CREATED':
      default:
        return 'bg-sky-50 text-sky-700 border-sky-200';
    }
  };

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'TIME_EXTENDED':
        return 'bg-amber-500 ring-4 ring-amber-50';
      case 'BID_SUBMITTED':
        return 'bg-emerald-500 ring-4 ring-emerald-50';
      case 'FORCE_CLOSED':
        return 'bg-rose-500 ring-4 ring-rose-50';
      case 'RFQ_CREATED':
      default:
        return 'bg-sky-500 ring-4 ring-sky-50';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
          Activity Log
        </h3>
        <span className="text-xs text-slate-500 font-mono tabular-nums">
          {logs.length} {logs.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      <div className="p-5">
        {logs.length === 0 ? (
          <p className="text-slate-400 text-xs italic">No activity recorded yet.</p>
        ) : (
          <div className="relative border-l border-slate-200 ml-2.5 space-y-5">
            {logs.map((log) => {
              const isExtended = log.event_type === 'TIME_EXTENDED';
              const createdTimes = formatDisplayTime(log.created_at);
              const oldClose = formatDisplayTime(log.old_close_time);
              const newClose = formatDisplayTime(log.new_close_time);

              return (
                <div key={log.id} className="relative pl-6">
                  <div
                    className={`absolute -left-1.5 top-1 h-3 w-3 rounded-full ${getMarkerColor(
                      log.event_type
                    )}`}
                  />

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${getEventBadgeClass(
                          log.event_type
                        )}`}
                      >
                        {log.event_type}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono tabular-nums" title={`UTC: ${createdTimes.utc}`}>
                        {createdTimes.local}
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 mt-0.5 leading-relaxed font-sans">
                      {log.message}
                    </p>

                    {isExtended && log.old_close_time && log.new_close_time && (
                      <div className="mt-1.5 inline-flex items-center gap-2 text-xs bg-amber-50/70 border border-amber-200 text-amber-900 px-2.5 py-1 rounded font-mono tabular-nums w-fit">
                        <Clock className="h-3 w-3 text-amber-700 shrink-0" />
                        <span className="line-through text-slate-400" title={`UTC: ${oldClose.utc}`}>
                          {oldClose.local}
                        </span>
                        <ArrowRight className="h-3 w-3 text-amber-700 shrink-0" />
                        <span className="font-bold text-amber-900" title={`UTC: ${newClose.utc}`}>
                          {newClose.local}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
