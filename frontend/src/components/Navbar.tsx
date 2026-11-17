import React, { useState, useEffect } from 'react';
import { Truck, Clock, Plus, RefreshCw } from 'lucide-react';

interface NavbarProps {
  onOpenCreateModal: () => void;
  onRefresh?: () => void;
  onNavigateHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCreateModal,
  onRefresh,
  onNavigateHome,
}) => {
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().replace('GMT', 'UTC'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          <div
            onClick={onNavigateHome}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="h-7 w-7 rounded bg-slate-900 flex items-center justify-center text-white">
              <Truck className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm text-slate-900 tracking-tight">
              RFQ Auctions
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-mono tabular-nums">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-400 font-sans">UTC:</span>
            <span className="text-slate-700 font-medium">{utcTime || 'Syncing...'}</span>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Refresh"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors border border-slate-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create RFQ</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
