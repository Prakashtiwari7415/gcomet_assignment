import {
  RFQSummary,
  RFQDetail,
  CreateRFQInput,
  CreateBidInput,
  BidSubmissionResult,
} from '../types/rfq';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

export async function fetchRFQs(status?: string, search?: string): Promise<RFQSummary[]> {
  const params = new URLSearchParams();
  if (status && status !== 'ALL') {
    params.append('status', status);
  }
  if (search && search.trim()) {
    params.append('search', search.trim());
  }

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE}/rfqs${queryString}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch RFQs');
  }
  return response.json();
}

export async function fetchRFQDetail(rfqId: number): Promise<RFQDetail> {
  const response = await fetch(`${API_BASE}/rfqs/${rfqId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch RFQ #${rfqId}`);
  }
  return response.json();
}

export async function createRFQ(input: CreateRFQInput): Promise<RFQDetail> {
  const response = await fetch(`${API_BASE}/rfqs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let msg = errorData.detail;
    if (Array.isArray(msg)) {
      msg = msg.map((m: any) => m.msg || m.message).join(', ');
    }
    throw new Error(msg || 'Failed to create RFQ');
  }
  return response.json();
}

export async function submitBid(rfqId: number, input: CreateBidInput): Promise<BidSubmissionResult> {
  const response = await fetch(`${API_BASE}/rfqs/${rfqId}/bids`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let msg = errorData.detail;
    if (Array.isArray(msg)) {
      msg = msg.map((m: any) => m.msg || m.message).join(', ');
    }
    throw new Error(msg || 'Failed to submit quote');
  }
  return response.json();
}
