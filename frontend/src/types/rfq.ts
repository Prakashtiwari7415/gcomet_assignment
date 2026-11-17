export type TriggerType = 'BID_RECEIVED' | 'ANY_RANK_CHANGE' | 'L1_CHANGE';

export type EventType = 'RFQ_CREATED' | 'BID_SUBMITTED' | 'TIME_EXTENDED' | 'FORCE_CLOSED';

export type RFQStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED' | 'FORCE_CLOSED';

export interface CurrentL1BidSummary {
  carrier_name: string;
  total_amount: number;
  transit_time_days: number;
  submitted_at: string;
}

export interface Bid {
  id: number;
  rfq_id: number;
  carrier_name: string;
  freight_charges: number;
  origin_charges: number;
  destination_charges: number;
  total_amount: number;
  transit_time_days: number;
  quote_validity_date: string;
  rank?: string;
  created_at: string;
}

export interface AuctionLog {
  id: number;
  rfq_id: number;
  event_type: EventType;
  message: string;
  old_close_time?: string | null;
  new_close_time?: string | null;
  created_at: string;
}

export interface RFQSummary {
  id: number;
  reference_id: string;
  title: string;
  pickup_date: string;
  bid_start_time: string;
  bid_close_time: string;
  forced_close_time: string;
  trigger_window_mins: number;
  extension_duration_mins: number;
  trigger_type: TriggerType;
  status: RFQStatus;
  bid_count: number;
  current_l1_bid?: CurrentL1BidSummary | null;
  created_at: string;
}

export type RFQListItem = RFQSummary;

export interface RFQDetail {
  id: number;
  reference_id: string;
  title: string;
  pickup_date: string;
  bid_start_time: string;
  bid_close_time: string;
  forced_close_time: string;
  trigger_window_mins: number;
  extension_duration_mins: number;
  trigger_type: TriggerType;
  status: RFQStatus;
  bids: Bid[];
  logs: AuctionLog[];
  created_at: string;
}

export interface CreateRFQInput {
  title: string;
  pickup_date: string;
  bid_start_time: string;
  bid_close_time: string;
  forced_close_time: string;
  trigger_window_mins: number;
  extension_duration_mins: number;
  trigger_type: TriggerType;
}

export interface CreateBidInput {
  carrier_name: string;
  freight_charges: number;
  origin_charges: number;
  destination_charges: number;
  transit_time_days: number;
  quote_validity_date: string;
}

export interface BidSubmissionResult {
  bid: Bid;
  extension_triggered: boolean;
  old_close_time?: string | null;
  new_close_time?: string | null;
  message: string;
}
