import React from 'react';
import { Bid } from '../types/rfq';
import { formatDisplayTime } from '../utils/date';

interface BidLeaderboardProps {
  bids: Bid[];
}

export const BidLeaderboard: React.FC<BidLeaderboardProps> = ({ bids }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  const getRankBadge = (rank?: string) => {
    switch (rank) {
      case 'L1':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-900 text-white">
            L1
          </span>
        );
      case 'L2':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            L2
          </span>
        );
      case 'L3':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            L3
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200">
            {rank || '—'}
          </span>
        );
    }
  };

  if (!bids || bids.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-500 shadow-sm">
        <p className="text-xs text-slate-500">No bids submitted yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
          Bids
        </h3>
        <span className="text-xs text-slate-500 font-mono tabular-nums">
          {bids.length} {bids.length === 1 ? 'bid' : 'bids'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
              <th className="py-2.5 px-4">Rank</th>
              <th className="py-2.5 px-4">Carrier</th>
              <th className="py-2.5 px-3 text-right">Freight</th>
              <th className="py-2.5 px-3 text-right">Origin</th>
              <th className="py-2.5 px-3 text-right">Destination</th>
              <th className="py-2.5 px-4 text-right font-bold text-slate-700">Total</th>
              <th className="py-2.5 px-3 text-center">Transit</th>
              <th className="py-2.5 px-3">Validity</th>
              <th className="py-2.5 px-4">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-xs">
            {bids.map((bid) => {
              const isL1 = bid.rank === 'L1';
              const submitTime = formatDisplayTime(bid.created_at);

              return (
                <tr
                  key={bid.id}
                  className={`transition-colors hover:bg-slate-50 ${
                    isL1 ? 'bg-emerald-50/30' : ''
                  }`}
                >
                  <td className="py-3 px-4 whitespace-nowrap">
                    {getRankBadge(bid.rank)}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap font-sans font-medium text-slate-900">
                    {bid.carrier_name}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600 tabular-nums">
                    {formatCurrency(bid.freight_charges)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600 tabular-nums">
                    {formatCurrency(bid.origin_charges)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-600 tabular-nums">
                    {formatCurrency(bid.destination_charges)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold whitespace-nowrap tabular-nums text-sm">
                    <span className={isL1 ? 'text-emerald-700' : 'text-slate-900'}>
                      {formatCurrency(bid.total_amount)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-sans text-slate-600">
                    {bid.transit_time_days}d
                  </td>
                  <td className="py-3 px-3 font-sans text-slate-600">
                    {bid.quote_validity_date}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                    <div className="text-slate-800 text-xs font-mono">{submitTime.local}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{submitTime.utc}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
