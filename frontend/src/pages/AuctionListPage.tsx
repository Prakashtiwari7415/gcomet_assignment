import React, { useState, useEffect } from 'react';
import { RFQSummary } from '../types/rfq';
import { fetchRFQs } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { CountdownTimer } from '../components/CountdownTimer';
import { formatDisplayTime } from '../utils/date';
import {
  Search,
  RefreshCw,
  Calendar,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

interface AuctionListPageProps {
  onSelectRFQ: (id: number) => void;
  onOpenCreateModal: () => void;
}

export const AuctionListPage: React.FC<AuctionListPageProps> = ({
  onSelectRFQ,
  onOpenCreateModal,
}) => {
  const [rfqs, setRfqs] = useState<RFQSummary[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadRFQs = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    setError(null);
    try {
      const data = await fetchRFQs(selectedStatus, searchQuery);
      setRfqs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch RFQs');
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadRFQs();
    const interval = setInterval(() => {
      loadRFQs(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedStatus, searchQuery]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  const activeCount = rfqs.filter((r) => r.status === 'ACTIVE').length;
  const upcomingCount = rfqs.filter((r) => r.status === 'UPCOMING').length;
  const closedCount = rfqs.filter((r) => r.status === 'CLOSED' || r.status === 'FORCE_CLOSED').length;

  const tabs = [
    { id: 'ALL', label: 'All', count: rfqs.length },
    { id: 'ACTIVE', label: 'Active', count: activeCount },
    { id: 'UPCOMING', label: 'Upcoming', count: upcomingCount },
    { id: 'CLOSED', label: 'Closed', count: closedCount },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      {/* Sub-header without duplicate Create button */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">RFQs</h1>
        <p className="text-xs text-slate-500 mt-0.5">Freight procurement reverse auctions</p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                selectedStatus === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums ${
                  selectedStatus === tab.id ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search route or reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white"
            />
          </div>

          <button
            onClick={() => loadRFQs(true)}
            title="Refresh"
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-slate-900' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && rfqs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
          <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
          <p className="text-xs">Loading auctions...</p>
        </div>
      ) : rfqs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-slate-500 space-y-2">
          <p className="text-xs font-semibold text-slate-700">No RFQs found</p>
          <button
            onClick={onOpenCreateModal}
            className="mt-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-md"
          >
            Create RFQ
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-2.5 px-4">Route / Ref</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4">Lowest Bid (L1)</th>
                  <th className="py-2.5 px-3">Remaining</th>
                  <th className="py-2.5 px-4">Close Time</th>
                  <th className="py-2.5 px-4">Forced Cap</th>
                  <th className="py-2.5 px-3">Extension Rule</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rfqs.map((rfq) => {
                  const closeTime = formatDisplayTime(rfq.bid_close_time);
                  const forcedTime = formatDisplayTime(rfq.forced_close_time);

                  return (
                    <tr
                      key={rfq.id}
                      onClick={() => onSelectRFQ(rfq.id)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                            {rfq.reference_id}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                            {rfq.bid_count} {rfq.bid_count === 1 ? 'bid' : 'bids'}
                          </span>
                        </div>
                        <div className="font-medium text-slate-900 group-hover:text-slate-700 line-clamp-1">
                          {rfq.title}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          <span>Pickup: {rfq.pickup_date}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusBadge status={rfq.status} size="sm" />
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {rfq.current_l1_bid ? (
                          <div>
                            <div className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                              {formatCurrency(rfq.current_l1_bid.total_amount)}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[130px]">
                              {rfq.current_l1_bid.carrier_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                              {rfq.current_l1_bid.transit_time_days}d transit
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No bids</span>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <CountdownTimer
                          bidStartTime={rfq.bid_start_time}
                          bidCloseTime={rfq.bid_close_time}
                          forcedCloseTime={rfq.forced_close_time}
                          triggerWindowMins={rfq.trigger_window_mins}
                          extensionDurationMins={rfq.extension_duration_mins}
                          status={rfq.status}
                          variant="compact"
                        />
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div
                          className="font-mono text-slate-900 text-xs tabular-nums"
                          title={`UTC: ${closeTime.utc}`}
                        >
                          {closeTime.local}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                          {closeTime.utc}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div
                          className="font-mono text-slate-700 text-xs tabular-nums"
                          title={`Hard cap: ${forcedTime.utc}`}
                        >
                          {forcedTime.local}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                          {forcedTime.utc}
                        </div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="text-[11px] font-mono text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                          {rfq.trigger_type} ({rfq.trigger_window_mins}m / +{rfq.extension_duration_mins}m)
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all">
                          <span>View</span>
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
