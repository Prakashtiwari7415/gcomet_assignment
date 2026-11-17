import React, { useState, useEffect } from 'react';
import { RFQDetail, CreateBidInput, BidSubmissionResult } from '../types/rfq';
import { fetchRFQDetail, submitBid } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { CountdownTimer } from '../components/CountdownTimer';
import { BidLeaderboard } from '../components/BidLeaderboard';
import { ActivityLogFeed } from '../components/ActivityLogFeed';
import { formatDisplayTime } from '../utils/date';
import {
  ArrowLeft,
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Send,
  ShieldAlert,
} from 'lucide-react';

interface AuctionDetailPageProps {
  rfqId: number;
  onBack: () => void;
}

export const AuctionDetailPage: React.FC<AuctionDetailPageProps> = ({ rfqId, onBack }) => {
  const [rfq, setRfq] = useState<RFQDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'info'; message: string } | null>(null);

  const [carrierName, setCarrierName] = useState('');
  const [freightCharges, setFreightCharges] = useState<number | ''>('');
  const [originCharges, setOriginCharges] = useState<number | ''>(2000);
  const [destinationCharges, setDestinationCharges] = useState<number | ''>(2000);
  const [transitTimeDays, setTransitTimeDays] = useState<number | ''>(3);
  const [validityDate, setValidityDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadDetail = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const data = await fetchRFQDetail(rfqId);
      setRfq(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load RFQ');
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDetail();
    const interval = setInterval(() => {
      loadDetail(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [rfqId]);

  const numFreight = typeof freightCharges === 'number' ? freightCharges : 0;
  const numOrigin = typeof originCharges === 'number' ? originCharges : 0;
  const numDest = typeof destinationCharges === 'number' ? destinationCharges : 0;
  const calculatedTotal = Math.round((numFreight + numOrigin + numDest) * 100) / 100;

  const currentL1Amount = rfq && rfq.bids.length > 0 ? rfq.bids[0].total_amount : null;
  const willBecomeL1 = currentL1Amount !== null ? calculatedTotal > 0 && calculatedTotal < currentL1Amount : calculatedTotal > 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);


  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!rfq || rfq.status !== 'ACTIVE') {
      setFormError('Bidding is closed for this RFQ.');
      return;
    }
    if (!carrierName.trim()) {
      setFormError('Carrier name is required.');
      return;
    }
    if (calculatedTotal <= 0) {
      setFormError('Total quote amount must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateBidInput = {
        carrier_name: carrierName.trim(),
        freight_charges: numFreight,
        origin_charges: numOrigin,
        destination_charges: numDest,
        transit_time_days: Number(transitTimeDays) || 1,
        quote_validity_date: validityDate,
      };

      const result: BidSubmissionResult = await submitBid(rfq.id, payload);

      setNotification({
        type: result.extension_triggered ? 'success' : 'info',
        message: result.message,
      });

      setFreightCharges('');
      loadDetail(true);
      setTimeout(() => setNotification(null), 8000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit quote');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !rfq) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center justify-center space-y-2 text-slate-500">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
        <p className="text-xs">Loading RFQ #{rfqId}...</p>
      </div>
    );
  }

  if (error || !rfq) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-3">
          <AlertCircle className="h-8 w-8 text-rose-600 mx-auto" />
          <h2 className="text-sm font-bold text-slate-900">RFQ Not Found</h2>
          <p className="text-xs text-slate-500">{error || 'Unable to retrieve RFQ details.'}</p>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to RFQs</span>
          </button>
        </div>
      </div>
    );
  }

  const isAuctionActive = rfq.status === 'ACTIVE';
  const closeTimes = formatDisplayTime(rfq.bid_close_time);
  const forcedTimes = formatDisplayTime(rfq.forced_close_time);
  const startTimes = formatDisplayTime(rfq.bid_start_time);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md transition-colors shadow-2xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to RFQs</span>
        </button>

        <button
          onClick={() => loadDetail(true)}
          title="Refresh"
          className="p-1.5 text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors shadow-2xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-slate-900' : ''}`} />
        </button>
      </div>

      {notification && (
        <div
          className={`p-3 rounded-md border text-xs flex items-center justify-between shadow-2xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 uppercase tracking-wider ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                {rfq.reference_id}
              </span>
              <StatusBadge status={rfq.status} size="md" />
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Pickup: {rfq.pickup_date}</span>
              </div>
            </div>

            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {rfq.title}
            </h1>
          </div>

          <div className="shrink-0">
            <CountdownTimer
              bidStartTime={rfq.bid_start_time}
              bidCloseTime={rfq.bid_close_time}
              forcedCloseTime={rfq.forced_close_time}
              triggerWindowMins={rfq.trigger_window_mins}
              extensionDurationMins={rfq.extension_duration_mins}
              status={rfq.status}
              variant="hero"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          <BidLeaderboard bids={rfq.bids} />
          <ActivityLogFeed logs={rfq.logs} />
        </div>

        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-slate-700" />
                <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                  Submit Quote
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                  isAuctionActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {isAuctionActive ? 'ACTIVE' : rfq.status}
              </span>
            </div>

            <form onSubmit={handleQuoteSubmit} className="p-4 space-y-3">
              {!isAuctionActive && (
                <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700" />
                  <span>
                    {rfq.status === 'UPCOMING'
                      ? 'RFQ has not started yet.'
                      : 'Bidding is closed for this RFQ.'}
                  </span>
                </div>
              )}

              {formError && (
                <div className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Carrier Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAuctionActive || isSubmitting}
                  placeholder="e.g. Swift Cargo Logistics"
                  value={carrierName}
                  onChange={(e) => setCarrierName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Charges (₹) *
                </label>

                <div>
                  <div className="text-[10px] text-slate-500 mb-0.5">Freight</div>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    disabled={!isAuctionActive || isSubmitting}
                    placeholder="e.g. 48000"
                    value={freightCharges}
                    onChange={(e) => setFreightCharges(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-slate-500 mb-0.5">Origin Charges</div>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      disabled={!isAuctionActive || isSubmitting}
                      value={originCharges}
                      onChange={(e) => setOriginCharges(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:border-slate-900 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500 mb-0.5">Destination Charges</div>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      disabled={!isAuctionActive || isSubmitting}
                      value={destinationCharges}
                      onChange={(e) => setDestinationCharges(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:border-slate-900 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Transit (Days) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    disabled={!isAuctionActive || isSubmitting}
                    value={transitTimeDays}
                    onChange={(e) => setTransitTimeDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:border-slate-900 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Validity *</label>
                  <input
                    type="date"
                    required
                    disabled={!isAuctionActive || isSubmitting}
                    value={validityDate}
                    onChange={(e) => setValidityDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block tracking-wider">
                    Total
                  </span>
                  <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                    {formatCurrency(calculatedTotal)}
                  </span>
                </div>

                <div className="text-right">
                  {currentL1Amount !== null ? (
                    <div>
                      <span className="text-[10px] text-slate-500 block">
                        L1: <strong className="text-slate-800 font-mono tabular-nums">{formatCurrency(currentL1Amount)}</strong>
                      </span>
                      {willBecomeL1 ? (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          New L1
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Above L1</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-600 font-medium">Opening quote</span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!isAuctionActive || isSubmitting || calculatedTotal <= 0}
                className="w-full py-2 px-3 rounded-md text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-2xs flex items-center justify-center gap-1.5"
              >
                <Send className="h-3 w-3" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Quote'}</span>
              </button>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm text-xs space-y-3">
            <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider pb-2 border-b border-slate-100">
              Auction Rules
            </h4>

            <div className="space-y-2.5">
              <div>
                <span className="text-[11px] text-slate-500 block">Extension Rule</span>
                <span className="font-mono text-slate-900 font-semibold tabular-nums">
                  Last {rfq.trigger_window_mins}m ➔ +{rfq.extension_duration_mins}m
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block">Trigger Mode</span>
                <span className="font-mono text-slate-800 font-semibold">{rfq.trigger_type}</span>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div>
                  <span className="text-[11px] text-slate-500 block">Close Time</span>
                  <div className="font-mono text-slate-900 font-medium tabular-nums">{closeTimes.local}</div>
                  <div className="text-[10px] font-mono text-slate-400 tabular-nums">{closeTimes.utc}</div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Forced Cap</span>
                  <div className="font-mono text-slate-900 font-medium tabular-nums">{forcedTimes.local}</div>
                  <div className="text-[10px] font-mono text-slate-400 tabular-nums">{forcedTimes.utc}</div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Start Time</span>
                  <div className="font-mono text-slate-700 tabular-nums">{startTimes.local}</div>
                  <div className="text-[10px] font-mono text-slate-400 tabular-nums">{startTimes.utc}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
