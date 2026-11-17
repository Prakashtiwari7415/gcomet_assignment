import React, { useState } from 'react';
import { CreateRFQInput, RFQDetail, TriggerType } from '../types/rfq';
import { createRFQ } from '../services/api';
import { X, AlertCircle } from 'lucide-react';

interface CreateRFQModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (rfq: RFQDetail) => void;
}

export const CreateRFQModal: React.FC<CreateRFQModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const formatDatetimeLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const getInitialTimes = () => {
    const now = new Date();
    return {
      start: formatDatetimeLocal(now),
      close: formatDatetimeLocal(new Date(now.getTime() + 15 * 60 * 1000)),
      forced: formatDatetimeLocal(new Date(now.getTime() + 60 * 60 * 1000)),
    };
  };

  const initialTimes = getInitialTimes();

  const [title, setTitle] = useState('');
  const [pickupDate, setPickupDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [bidStartTime, setBidStartTime] = useState(initialTimes.start);
  const [bidCloseTime, setBidCloseTime] = useState(initialTimes.close);
  const [forcedCloseTime, setForcedCloseTime] = useState(initialTimes.forced);
  const [triggerWindowMins, setTriggerWindowMins] = useState<number>(10);
  const [extensionDurationMins, setExtensionDurationMins] = useState<number>(10);
  const [triggerType, setTriggerType] = useState<TriggerType>('L1_CHANGE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const fillSampleTimes = () => {
    const now = new Date();
    setTitle((prev) => prev || 'FTL 32ft Container: Mumbai to Delhi');
    setBidStartTime(formatDatetimeLocal(new Date(now.getTime() - 30 * 1000)));
    setBidCloseTime(formatDatetimeLocal(new Date(now.getTime() + 3 * 60 * 1000)));
    setForcedCloseTime(formatDatetimeLocal(new Date(now.getTime() + 6 * 60 * 1000)));
    setTriggerWindowMins(3);
    setExtensionDurationMins(1);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const start = new Date(bidStartTime).getTime();
    const close = new Date(bidCloseTime).getTime();
    const forced = new Date(forcedCloseTime).getTime();

    if (close <= start) {
      setError('Close time must be greater than start time.');
      return;
    }
    if (forced <= close) {
      setError('Forced close ceiling must be greater than close time.');
      return;
    }
    if (triggerWindowMins <= 0 || extensionDurationMins <= 0) {
      setError('Trigger window and extension duration must be at least 1 minute.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateRFQInput = {
        title: title.trim(),
        pickup_date: pickupDate,
        bid_start_time: new Date(bidStartTime).toISOString(),
        bid_close_time: new Date(bidCloseTime).toISOString(),
        forced_close_time: new Date(forcedCloseTime).toISOString(),
        trigger_window_mins: Number(triggerWindowMins),
        extension_duration_mins: Number(extensionDurationMins),
        trigger_type: triggerType,
      };

      const created = await createRFQ(payload);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create RFQ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerDescriptions: Record<TriggerType, string> = {
    L1_CHANGE: 'Extends close time only when a new lowest quote is submitted.',
    BID_RECEIVED: 'Extends close time when any valid quote is submitted.',
    ANY_RANK_CHANGE: 'Extends close time when any quote changes carrier ranks.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Create RFQ</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5">
          {error && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Title / Route *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. FTL 32ft MXL: Mumbai to Pune"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Pickup Date *
            </label>
            <input
              type="date"
              required
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700">Schedule *</span>
              <button
                type="button"
                onClick={fillSampleTimes}
                className="text-[11px] text-slate-400 hover:text-slate-700 underline"
              >
                Fill sample times
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Start Time</label>
                <input
                  type="datetime-local"
                  required
                  value={bidStartTime}
                  onChange={(e) => setBidStartTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Close Time</label>
                <input
                  type="datetime-local"
                  required
                  value={bidCloseTime}
                  onChange={(e) => setBidCloseTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Forced Cap</label>
                <input
                  type="datetime-local"
                  required
                  value={forcedCloseTime}
                  onChange={(e) => setForcedCloseTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trigger Window (X mins) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={triggerWindowMins}
                onChange={(e) => setTriggerWindowMins(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Extension (Y mins) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={extensionDurationMins}
                onChange={(e) => setExtensionDurationMins(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trigger Mode *
              </label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as TriggerType)}
                className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              >
                <option value="L1_CHANGE">L1_CHANGE</option>
                <option value="BID_RECEIVED">BID_RECEIVED</option>
                <option value="ANY_RANK_CHANGE">ANY_RANK_CHANGE</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
            {triggerDescriptions[triggerType]}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-md transition-colors shadow-xs"
            >
              {isSubmitting ? 'Creating...' : 'Create RFQ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
