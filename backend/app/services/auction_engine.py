import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from ..models import RFQ, Bid, AuctionLog, RFQStatus, TriggerType, EventType
from ..schemas import BidCreate, BidResponse, CurrentL1BidSummary


def normalize_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def generate_reference_id() -> str:
    short_code = uuid.uuid4().hex[:6].upper()
    return f"RFQ-{datetime.now(timezone.utc).year}-{short_code}"


def derive_rfq_status(rfq: RFQ, current_time: Optional[datetime] = None) -> RFQStatus:
    now = normalize_utc(current_time or datetime.now(timezone.utc))
    start_time = normalize_utc(rfq.bid_start_time)
    close_time = normalize_utc(rfq.bid_close_time)
    forced_time = normalize_utc(rfq.forced_close_time)

    if now < start_time:
        return RFQStatus.UPCOMING
    if start_time <= now < close_time:
        return RFQStatus.ACTIVE
    if now >= close_time and close_time >= forced_time:
        return RFQStatus.FORCE_CLOSED
    return RFQStatus.CLOSED


def rank_bids(bids: List[Bid]) -> List[BidResponse]:
    # Lowest total price first; earlier submission breaks exact price ties
    sorted_bids = sorted(
        bids,
        key=lambda b: (
            b.total_amount,
            normalize_utc(b.created_at) if b.created_at else datetime.min.replace(tzinfo=timezone.utc),
            b.id or 0,
        ),
    )

    ranked_list: List[BidResponse] = []
    for idx, bid in enumerate(sorted_bids, start=1):
        bid_resp = BidResponse(
            id=bid.id,
            rfq_id=bid.rfq_id,
            carrier_name=bid.carrier_name,
            freight_charges=bid.freight_charges,
            origin_charges=bid.origin_charges,
            destination_charges=bid.destination_charges,
            total_amount=bid.total_amount,
            transit_time_days=bid.transit_time_days,
            quote_validity_date=bid.quote_validity_date,
            rank=f"L{idx}",
            created_at=normalize_utc(bid.created_at) or datetime.now(timezone.utc),
        )
        ranked_list.append(bid_resp)
    return ranked_list


def get_current_l1_bid(bids: List[Bid]) -> Optional[CurrentL1BidSummary]:
    if not bids:
        return None
    ranked = rank_bids(bids)
    if not ranked:
        return None
    l1 = ranked[0]
    return CurrentL1BidSummary(
        carrier_name=l1.carrier_name,
        total_amount=l1.total_amount,
        transit_time_days=l1.transit_time_days,
        submitted_at=l1.created_at,
    )


def evaluate_extension_trigger(
    rfq: RFQ,
    existing_bids: List[Bid],
    new_bid_total: float,
    submission_time: datetime,
) -> bool:
    now = normalize_utc(submission_time)
    close_time = normalize_utc(rfq.bid_close_time)

    remaining_seconds = (close_time - now).total_seconds()
    trigger_window_seconds = rfq.trigger_window_mins * 60

    if remaining_seconds <= 0 or remaining_seconds > trigger_window_seconds:
        return False

    if rfq.trigger_type == TriggerType.BID_RECEIVED:
        return True

    if rfq.trigger_type == TriggerType.L1_CHANGE:
        if not existing_bids:
            return True
        ranked = rank_bids(existing_bids)
        return new_bid_total < ranked[0].total_amount

    if rfq.trigger_type == TriggerType.ANY_RANK_CHANGE:
        if not existing_bids:
            return True
        worst_existing_amount = max(b.total_amount for b in existing_bids)
        return new_bid_total < worst_existing_amount

    return False


def calculate_new_close_time(
    current_close_time: datetime,
    forced_close_time: datetime,
    extension_duration_mins: int,
) -> datetime:
    curr_close = normalize_utc(current_close_time)
    forced_close = normalize_utc(forced_close_time)
    potential_close = curr_close + timedelta(minutes=extension_duration_mins)
    return min(potential_close, forced_close)


def process_bid_submission(
    db: Session,
    rfq_id: int,
    bid_in: BidCreate,
    submission_time: Optional[datetime] = None,
) -> Tuple[BidResponse, bool, Optional[datetime], Optional[datetime], str]:
    now = normalize_utc(submission_time or datetime.now(timezone.utc))

    rfq = db.query(RFQ).filter(RFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"RFQ with ID {rfq_id} not found.",
        )

    current_status = derive_rfq_status(rfq, now)
    if current_status == RFQStatus.UPCOMING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Auction is upcoming and not open for bidding.",
        )
    if current_status in (RFQStatus.CLOSED, RFQStatus.FORCE_CLOSED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Auction has ended. Bidding is closed.",
        )

    total_amount = round(
        bid_in.freight_charges + bid_in.origin_charges + bid_in.destination_charges, 2
    )

    existing_bids = db.query(Bid).filter(Bid.rfq_id == rfq_id).all()
    should_extend = evaluate_extension_trigger(
        rfq=rfq,
        existing_bids=existing_bids,
        new_bid_total=total_amount,
        submission_time=now,
    )

    extension_applied = False
    old_close_time = None
    new_close_time = None
    message_note = "Bid submitted successfully."

    if should_extend:
        potential_new_close = calculate_new_close_time(
            current_close_time=rfq.bid_close_time,
            forced_close_time=rfq.forced_close_time,
            extension_duration_mins=rfq.extension_duration_mins,
        )
        curr_close_norm = normalize_utc(rfq.bid_close_time)

        if potential_new_close > curr_close_norm:
            extension_applied = True
            old_close_time = curr_close_norm
            new_close_time = potential_new_close
            rfq.bid_close_time = potential_new_close

            ext_log = AuctionLog(
                rfq_id=rfq.id,
                event_type=EventType.TIME_EXTENDED,
                message=(
                    f"Auction extended by {rfq.extension_duration_mins}m via "
                    f"{rfq.trigger_type.value} from '{bid_in.carrier_name}' "
                    f"(Quote: ₹{total_amount:,.2f})."
                ),
                old_close_time=old_close_time,
                new_close_time=new_close_time,
                created_at=now,
            )
            db.add(ext_log)
            message_note = (
                f"Bid submitted. Close time extended to {new_close_time.strftime('%Y-%m-%d %H:%M:%S UTC')}."
            )
        else:
            message_note = "Bid submitted. Auction reached forced close time ceiling."
            log_cap = AuctionLog(
                rfq_id=rfq.id,
                event_type=EventType.FORCE_CLOSED,
                message=(
                    f"Bid from '{bid_in.carrier_name}' triggered extension, "
                    "but forced close ceiling was reached."
                ),
                old_close_time=curr_close_norm,
                new_close_time=curr_close_norm,
                created_at=now,
            )
            db.add(log_cap)

    new_bid = Bid(
        rfq_id=rfq.id,
        carrier_name=bid_in.carrier_name,
        freight_charges=bid_in.freight_charges,
        origin_charges=bid_in.origin_charges,
        destination_charges=bid_in.destination_charges,
        total_amount=total_amount,
        transit_time_days=bid_in.transit_time_days,
        quote_validity_date=bid_in.quote_validity_date,
        created_at=now,
    )
    db.add(new_bid)

    bid_log = AuctionLog(
        rfq_id=rfq.id,
        event_type=EventType.BID_SUBMITTED,
        message=(
            f"Quote of ₹{total_amount:,.2f} submitted by '{bid_in.carrier_name}' "
            f"(Freight: ₹{bid_in.freight_charges:,.2f}, Origin: ₹{bid_in.origin_charges:,.2f}, "
            f"Dest: ₹{bid_in.destination_charges:,.2f}, Transit: {bid_in.transit_time_days}d)."
        ),
        old_close_time=None,
        new_close_time=None,
        created_at=now,
    )
    db.add(bid_log)

    db.commit()
    db.refresh(new_bid)

    all_bids = db.query(Bid).filter(Bid.rfq_id == rfq_id).all()
    ranked_bids = rank_bids(all_bids)
    submitted_bid_resp = next((b for b in ranked_bids if b.id == new_bid.id), None)

    return (
        submitted_bid_resp,
        extension_applied,
        old_close_time,
        new_close_time,
        message_note,
    )
