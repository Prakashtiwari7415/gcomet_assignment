from datetime import date, datetime, timezone
from typing import Optional, List, Annotated
from pydantic import BaseModel, Field, model_validator, ConfigDict, PlainSerializer
from .models import TriggerType, EventType, RFQStatus


def serialize_utc(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


UTCDateTime = Annotated[datetime, PlainSerializer(serialize_utc, return_type=Optional[str])]


class BidCreate(BaseModel):
    carrier_name: str = Field(..., min_length=1, max_length=100)
    freight_charges: float = Field(..., ge=0)
    origin_charges: float = Field(..., ge=0)
    destination_charges: float = Field(..., ge=0)
    transit_time_days: int = Field(..., gt=0)
    quote_validity_date: date

    @model_validator(mode="after")
    def validate_total_positive(self):
        total = self.freight_charges + self.origin_charges + self.destination_charges
        if total <= 0:
            raise ValueError("Total quote amount (freight + origin + destination) must be greater than zero.")
        return self


class BidResponse(BaseModel):
    id: int
    rfq_id: int
    carrier_name: str
    freight_charges: float
    origin_charges: float
    destination_charges: float
    total_amount: float
    transit_time_days: int
    quote_validity_date: date
    rank: Optional[str] = None
    created_at: UTCDateTime

    model_config = ConfigDict(from_attributes=True)


class CurrentL1BidSummary(BaseModel):
    carrier_name: str
    total_amount: float
    transit_time_days: int
    submitted_at: UTCDateTime


class AuctionLogResponse(BaseModel):
    id: int
    rfq_id: int
    event_type: EventType
    message: str
    old_close_time: Optional[UTCDateTime] = None
    new_close_time: Optional[UTCDateTime] = None
    created_at: UTCDateTime

    model_config = ConfigDict(from_attributes=True)


class RFQCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    pickup_date: date
    bid_start_time: datetime
    bid_close_time: datetime
    forced_close_time: datetime
    trigger_window_mins: int = Field(..., gt=0, description="Trigger window X in minutes")
    extension_duration_mins: int = Field(..., gt=0, description="Extension duration Y in minutes")
    trigger_type: TriggerType = Field(default=TriggerType.BID_RECEIVED)

    @model_validator(mode="after")
    def validate_times(self):
        if self.bid_close_time <= self.bid_start_time:
            raise ValueError("bid_close_time must be strictly greater than bid_start_time.")
        if self.forced_close_time <= self.bid_close_time:
            raise ValueError("forced_close_time must be strictly greater than bid_close_time.")
        return self


class RFQListItemResponse(BaseModel):
    id: int
    reference_id: str
    title: str
    pickup_date: date
    bid_start_time: UTCDateTime
    bid_close_time: UTCDateTime
    forced_close_time: UTCDateTime
    trigger_window_mins: int
    extension_duration_mins: int
    trigger_type: TriggerType
    status: RFQStatus
    bid_count: int
    current_l1_bid: Optional[CurrentL1BidSummary] = None
    created_at: UTCDateTime

    model_config = ConfigDict(from_attributes=True)


class RFQDetailResponse(BaseModel):
    id: int
    reference_id: str
    title: str
    pickup_date: date
    bid_start_time: UTCDateTime
    bid_close_time: UTCDateTime
    forced_close_time: UTCDateTime
    trigger_window_mins: int
    extension_duration_mins: int
    trigger_type: TriggerType
    status: RFQStatus
    bids: List[BidResponse] = []
    logs: List[AuctionLogResponse] = []
    created_at: UTCDateTime

    model_config = ConfigDict(from_attributes=True)


class BidSubmissionResponse(BaseModel):
    bid: BidResponse
    extension_triggered: bool
    old_close_time: Optional[UTCDateTime] = None
    new_close_time: Optional[UTCDateTime] = None
    message: str
