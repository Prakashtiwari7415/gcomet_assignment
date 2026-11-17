import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Date,
    DateTime,
    ForeignKey,
    Text,
    Enum as SQLEnum,
    Index,
)
from sqlalchemy.orm import relationship
from .database import Base


def utc_now():
    return datetime.now(timezone.utc)


class TriggerType(str, enum.Enum):
    BID_RECEIVED = "BID_RECEIVED"
    ANY_RANK_CHANGE = "ANY_RANK_CHANGE"
    L1_CHANGE = "L1_CHANGE"


class EventType(str, enum.Enum):
    RFQ_CREATED = "RFQ_CREATED"
    BID_SUBMITTED = "BID_SUBMITTED"
    TIME_EXTENDED = "TIME_EXTENDED"
    FORCE_CLOSED = "FORCE_CLOSED"


class RFQStatus(str, enum.Enum):
    UPCOMING = "UPCOMING"
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"
    FORCE_CLOSED = "FORCE_CLOSED"


class RFQ(Base):
    __tablename__ = "rfqs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    reference_id = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    pickup_date = Column(Date, nullable=False)
    bid_start_time = Column(DateTime, nullable=False)
    bid_close_time = Column(DateTime, nullable=False)
    forced_close_time = Column(DateTime, nullable=False)
    trigger_window_mins = Column(Integer, nullable=False)
    extension_duration_mins = Column(Integer, nullable=False)
    trigger_type = Column(
        SQLEnum(TriggerType, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    created_at = Column(DateTime, nullable=False, default=utc_now)

    # Relationships
    bids = relationship(
        "Bid",
        back_populates="rfq",
        cascade="all, delete-orphan",
        order_by="Bid.total_amount.asc(), Bid.created_at.asc()",
    )
    logs = relationship(
        "AuctionLog",
        back_populates="rfq",
        cascade="all, delete-orphan",
        order_by="AuctionLog.created_at.asc()",
    )

    __table_args__ = (
        Index("ix_rfqs_bid_close_time", "bid_close_time"),
        Index(
            "ix_rfqs_status_times",
            "bid_start_time",
            "bid_close_time",
            "forced_close_time",
        ),
    )


class Bid(Base):
    __tablename__ = "bids"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    rfq_id = Column(
        Integer,
        ForeignKey("rfqs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    carrier_name = Column(String(100), nullable=False)
    freight_charges = Column(Float, nullable=False)
    origin_charges = Column(Float, nullable=False)
    destination_charges = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    transit_time_days = Column(Integer, nullable=False)
    quote_validity_date = Column(Date, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utc_now)

    # Relationship
    rfq = relationship("RFQ", back_populates="bids")

    __table_args__ = (
        Index(
            "ix_bids_rfq_amount_created",
            "rfq_id",
            "total_amount",
            "created_at",
        ),
    )


class AuctionLog(Base):
    __tablename__ = "auction_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    rfq_id = Column(
        Integer,
        ForeignKey("rfqs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(
        SQLEnum(EventType, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    message = Column(Text, nullable=False)
    old_close_time = Column(DateTime, nullable=True)
    new_close_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)

    # Relationship
    rfq = relationship("RFQ", back_populates="logs")

    __table_args__ = (
        Index("ix_auction_logs_created_at", "created_at"),
    )
