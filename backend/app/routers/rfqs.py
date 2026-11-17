from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import RFQ, AuctionLog, EventType, RFQStatus
from ..schemas import (
    RFQCreate,
    RFQListItemResponse,
    RFQDetailResponse,
    BidCreate,
    BidSubmissionResponse,
    AuctionLogResponse,
)
from ..services.auction_engine import (
    generate_reference_id,
    derive_rfq_status,
    rank_bids,
    get_current_l1_bid,
    process_bid_submission,
    normalize_utc,
)

router = APIRouter(prefix="/rfqs", tags=["RFQs"])


@router.post("", response_model=RFQDetailResponse, status_code=status.HTTP_201_CREATED)
def create_rfq(rfq_in: RFQCreate, db: Session = Depends(get_db)):
    """Create a new freight RFQ auction with timing and extension configurations."""
    now = datetime.now(timezone.utc)
    reference_id = generate_reference_id()

    # Ensure unique reference id
    while db.query(RFQ).filter(RFQ.reference_id == reference_id).first():
        reference_id = generate_reference_id()

    new_rfq = RFQ(
        reference_id=reference_id,
        title=rfq_in.title,
        pickup_date=rfq_in.pickup_date,
        bid_start_time=normalize_utc(rfq_in.bid_start_time),
        bid_close_time=normalize_utc(rfq_in.bid_close_time),
        forced_close_time=normalize_utc(rfq_in.forced_close_time),
        trigger_window_mins=rfq_in.trigger_window_mins,
        extension_duration_mins=rfq_in.extension_duration_mins,
        trigger_type=rfq_in.trigger_type,
        created_at=now,
    )
    db.add(new_rfq)
    db.flush()

    # Initial creation log
    creation_log = AuctionLog(
        rfq_id=new_rfq.id,
        event_type=EventType.RFQ_CREATED,
        message=(
            f"RFQ '{new_rfq.title}' created. Bidding starts at "
            f"{new_rfq.bid_start_time.strftime('%Y-%m-%d %H:%M:%S UTC')}, initial close at "
            f"{new_rfq.bid_close_time.strftime('%Y-%m-%d %H:%M:%S UTC')} "
            f"(Forced close ceiling: {new_rfq.forced_close_time.strftime('%Y-%m-%d %H:%M:%S UTC')})."
        ),
        old_close_time=None,
        new_close_time=new_rfq.bid_close_time,
        created_at=now,
    )
    db.add(creation_log)
    db.commit()
    db.refresh(new_rfq)

    current_status = derive_rfq_status(new_rfq, now)
    return RFQDetailResponse(
        id=new_rfq.id,
        reference_id=new_rfq.reference_id,
        title=new_rfq.title,
        pickup_date=new_rfq.pickup_date,
        bid_start_time=new_rfq.bid_start_time,
        bid_close_time=new_rfq.bid_close_time,
        forced_close_time=new_rfq.forced_close_time,
        trigger_window_mins=new_rfq.trigger_window_mins,
        extension_duration_mins=new_rfq.extension_duration_mins,
        trigger_type=new_rfq.trigger_type,
        status=current_status,
        bids=[],
        logs=[
            AuctionLogResponse(
                id=creation_log.id,
                rfq_id=creation_log.rfq_id,
                event_type=creation_log.event_type,
                message=creation_log.message,
                old_close_time=creation_log.old_close_time,
                new_close_time=creation_log.new_close_time,
                created_at=creation_log.created_at,
            )
        ],
        created_at=new_rfq.created_at,
    )


@router.get("", response_model=List[RFQListItemResponse])
def list_rfqs(
    status_filter: Optional[RFQStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List all RFQs with dynamically derived status, current L1 bid, and bid counts."""
    query = db.query(RFQ)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            (RFQ.title.ilike(search_term)) | (RFQ.reference_id.ilike(search_term))
        )

    rfqs = query.order_by(RFQ.created_at.desc()).all()
    results: List[RFQListItemResponse] = []
    now = datetime.now(timezone.utc)

    for rfq in rfqs:
        derived_status = derive_rfq_status(rfq, now)
        if status_filter and derived_status != status_filter:
            continue

        l1_bid = get_current_l1_bid(rfq.bids)
        results.append(
            RFQListItemResponse(
                id=rfq.id,
                reference_id=rfq.reference_id,
                title=rfq.title,
                pickup_date=rfq.pickup_date,
                bid_start_time=rfq.bid_start_time,
                bid_close_time=rfq.bid_close_time,
                forced_close_time=rfq.forced_close_time,
                trigger_window_mins=rfq.trigger_window_mins,
                extension_duration_mins=rfq.extension_duration_mins,
                trigger_type=rfq.trigger_type,
                status=derived_status,
                bid_count=len(rfq.bids),
                current_l1_bid=l1_bid,
                created_at=rfq.created_at,
            )
        )

    return results


@router.get("/{rfq_id}", response_model=RFQDetailResponse)
def get_rfq_detail(rfq_id: int, db: Session = Depends(get_db)):
    """Fetch complete RFQ details with sorted ranked bids (L1, L2, ...) and chronological audit logs."""
    rfq = db.query(RFQ).filter(RFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"RFQ with ID {rfq_id} not found.",
        )

    now = datetime.now(timezone.utc)
    derived_status = derive_rfq_status(rfq, now)
    ranked_bids = rank_bids(rfq.bids)

    sorted_logs = sorted(
        rfq.logs,
        key=lambda l: normalize_utc(l.created_at) if l.created_at else datetime.min.replace(tzinfo=timezone.utc),
    )

    return RFQDetailResponse(
        id=rfq.id,
        reference_id=rfq.reference_id,
        title=rfq.title,
        pickup_date=rfq.pickup_date,
        bid_start_time=rfq.bid_start_time,
        bid_close_time=rfq.bid_close_time,
        forced_close_time=rfq.forced_close_time,
        trigger_window_mins=rfq.trigger_window_mins,
        extension_duration_mins=rfq.extension_duration_mins,
        trigger_type=rfq.trigger_type,
        status=derived_status,
        bids=ranked_bids,
        logs=[
            AuctionLogResponse(
                id=log.id,
                rfq_id=log.rfq_id,
                event_type=log.event_type,
                message=log.message,
                old_close_time=log.old_close_time,
                new_close_time=log.new_close_time,
                created_at=log.created_at,
            )
            for log in sorted_logs
        ],
        created_at=rfq.created_at,
    )


@router.post(
    "/{rfq_id}/bids",
    response_model=BidSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_bid(
    rfq_id: int,
    bid_in: BidCreate,
    db: Session = Depends(get_db),
):
    """Submit a carrier quote and trigger atomic British auction extension evaluation."""
    (
        submitted_bid,
        extension_applied,
        old_close_time,
        new_close_time,
        message,
    ) = process_bid_submission(db=db, rfq_id=rfq_id, bid_in=bid_in)

    return BidSubmissionResponse(
        bid=submitted_bid,
        extension_triggered=extension_applied,
        old_close_time=old_close_time,
        new_close_time=new_close_time,
        message=message,
    )
