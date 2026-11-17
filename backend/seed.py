"""
Seed script to populate SQLite database with realistic Freight RFQ auction scenarios.
Run via:
    python backend/seed.py
"""
import sys
from datetime import datetime, timezone, timedelta, date

from app.database import engine, Base, SessionLocal
from app.models import RFQ, Bid, AuctionLog, TriggerType, EventType
from app.services.auction_engine import calculate_new_close_time


def run_seed():
    print("Initializing database schema...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    now = datetime.now(timezone.utc)

    print(f"Current UTC Seed Time: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}")

    # 1. Active RFQ in Extension Trigger Window (L1_CHANGE)
    # Remaining time is 4 minutes, inside trigger window of 10 minutes!
    rfq1_start = now - timedelta(hours=1)
    rfq1_close = now + timedelta(minutes=4)
    rfq1_forced = now + timedelta(minutes=30)
    rfq1 = RFQ(
        reference_id="RFQ-2026-MUM-DEL",
        title="FTL 32ft MXL Container: Mumbai (JNPT) -> Delhi NCR (Gurugram)",
        pickup_date=date.today() + timedelta(days=5),
        bid_start_time=rfq1_start,
        bid_close_time=rfq1_close,
        forced_close_time=rfq1_forced,
        trigger_window_mins=10,
        extension_duration_mins=10,
        trigger_type=TriggerType.L1_CHANGE,
        created_at=rfq1_start,
    )
    db.add(rfq1)
    db.flush()

    db.add(
        AuctionLog(
            rfq_id=rfq1.id,
            event_type=EventType.RFQ_CREATED,
            message="RFQ created with initial close time.",
            new_close_time=rfq1_close,
            created_at=rfq1_start,
        )
    )

    # Initial bids for RFQ 1
    bid1_1 = Bid(
        rfq_id=rfq1.id,
        carrier_name="DHL Supply Chain",
        freight_charges=52000.0,
        origin_charges=3000.0,
        destination_charges=2500.0,
        total_amount=57500.0,
        transit_time_days=3,
        quote_validity_date=date.today() + timedelta(days=15),
        created_at=now - timedelta(minutes=45),
    )
    bid1_2 = Bid(
        rfq_id=rfq1.id,
        carrier_name="Blue Dart Express",
        freight_charges=48000.0,
        origin_charges=2500.0,
        destination_charges=2500.0,
        total_amount=53000.0,
        transit_time_days=3,
        quote_validity_date=date.today() + timedelta(days=15),
        created_at=now - timedelta(minutes=25),
    )
    db.add_all([bid1_1, bid1_2])
    db.add(
        AuctionLog(
            rfq_id=rfq1.id,
            event_type=EventType.BID_SUBMITTED,
            message="Quote of ₹57,500.00 submitted by DHL Supply Chain",
            created_at=now - timedelta(minutes=45),
        )
    )
    db.add(
        AuctionLog(
            rfq_id=rfq1.id,
            event_type=EventType.BID_SUBMITTED,
            message="Quote of ₹53,000.00 submitted by Blue Dart Express (Current L1)",
            created_at=now - timedelta(minutes=25),
        )
    )

    # 2. Active RFQ in Extension Trigger Window (BID_RECEIVED)
    # Remaining time is 3 minutes, trigger window is 8 minutes
    rfq2_start = now - timedelta(minutes=30)
    rfq2_close = now + timedelta(minutes=3)
    rfq2_forced = now + timedelta(minutes=25)
    rfq2 = RFQ(
        reference_id="RFQ-2026-BLR-HYD",
        title="Reefer Container (2-8°C Pharma): Bangalore -> Hyderabad",
        pickup_date=date.today() + timedelta(days=3),
        bid_start_time=rfq2_start,
        bid_close_time=rfq2_close,
        forced_close_time=rfq2_forced,
        trigger_window_mins=8,
        extension_duration_mins=10,
        trigger_type=TriggerType.BID_RECEIVED,
        created_at=rfq2_start,
    )
    db.add(rfq2)
    db.flush()

    db.add(
        AuctionLog(
            rfq_id=rfq2.id,
            event_type=EventType.RFQ_CREATED,
            message="Pharma reefer RFQ created with BID_RECEIVED trigger rule.",
            new_close_time=rfq2_close,
            created_at=rfq2_start,
        )
    )

    bid2_1 = Bid(
        rfq_id=rfq2.id,
        carrier_name="Snowman Cold Chain",
        freight_charges=36000.0,
        origin_charges=3000.0,
        destination_charges=3000.0,
        total_amount=42000.0,
        transit_time_days=2,
        quote_validity_date=date.today() + timedelta(days=10),
        created_at=now - timedelta(minutes=15),
    )
    db.add(bid2_1)
    db.add(
        AuctionLog(
            rfq_id=rfq2.id,
            event_type=EventType.BID_SUBMITTED,
            message="Quote of ₹42,000.00 submitted by Snowman Cold Chain",
            created_at=now - timedelta(minutes=15),
        )
    )

    # 3. Active RFQ with Normal Time Remaining (> Trigger Window)
    rfq3_start = now - timedelta(minutes=20)
    rfq3_close = now + timedelta(minutes=90)
    rfq3_forced = now + timedelta(hours=4)
    rfq3 = RFQ(
        reference_id="RFQ-2026-CHE-KOL",
        title="Open Body Truck (Flatbed 40ft Heavy Machinery): Chennai -> Kolkata",
        pickup_date=date.today() + timedelta(days=7),
        bid_start_time=rfq3_start,
        bid_close_time=rfq3_close,
        forced_close_time=rfq3_forced,
        trigger_window_mins=15,
        extension_duration_mins=20,
        trigger_type=TriggerType.ANY_RANK_CHANGE,
        created_at=rfq3_start,
    )
    db.add(rfq3)
    db.flush()

    db.add(
        AuctionLog(
            rfq_id=rfq3.id,
            event_type=EventType.RFQ_CREATED,
            message="Heavy machinery flatbed RFQ created.",
            new_close_time=rfq3_close,
            created_at=rfq3_start,
        )
    )

    # 4. Upcoming RFQ (Starts in the future)
    rfq4_start = now + timedelta(hours=2)
    rfq4_close = now + timedelta(hours=6)
    rfq4_forced = now + timedelta(hours=10)
    rfq4 = RFQ(
        reference_id="RFQ-2026-PUN-AHM",
        title="Chemical Tanker (Hazmat Class 3): Pune -> Ahmedabad",
        pickup_date=date.today() + timedelta(days=8),
        bid_start_time=rfq4_start,
        bid_close_time=rfq4_close,
        forced_close_time=rfq4_forced,
        trigger_window_mins=15,
        extension_duration_mins=15,
        trigger_type=TriggerType.L1_CHANGE,
        created_at=now,
    )
    db.add(rfq4)
    db.flush()

    db.add(
        AuctionLog(
            rfq_id=rfq4.id,
            event_type=EventType.RFQ_CREATED,
            message="Hazmat chemical tanker RFQ scheduled.",
            new_close_time=rfq4_close,
            created_at=now,
        )
    )

    # 5. Closed RFQ (Normal close in the past)
    rfq5_start = now - timedelta(days=2)
    rfq5_close = now - timedelta(days=1)
    rfq5_forced = now - timedelta(hours=18)
    rfq5 = RFQ(
        reference_id="RFQ-2026-NAG-SUR",
        title="Part Truck Load (PTL 5MT FMCG Goods): Nagpur -> Surat",
        pickup_date=date.today() - timedelta(days=1),
        bid_start_time=rfq5_start,
        bid_close_time=rfq5_close,
        forced_close_time=rfq5_forced,
        trigger_window_mins=10,
        extension_duration_mins=15,
        trigger_type=TriggerType.BID_RECEIVED,
        created_at=rfq5_start,
    )
    db.add(rfq5)
    db.flush()

    db.add(
        AuctionLog(
            rfq_id=rfq5.id,
            event_type=EventType.RFQ_CREATED,
            message="PTL auction created.",
            new_close_time=rfq5_close,
            created_at=rfq5_start,
        )
    )
    bid5_1 = Bid(
        rfq_id=rfq5.id,
        carrier_name="Gati KWE",
        freight_charges=18000.0,
        origin_charges=1200.0,
        destination_charges=1500.0,
        total_amount=20700.0,
        transit_time_days=2,
        quote_validity_date=date.today() + timedelta(days=5),
        created_at=rfq5_start + timedelta(hours=2),
    )
    bid5_2 = Bid(
        rfq_id=rfq5.id,
        carrier_name="TCI Express",
        freight_charges=16500.0,
        origin_charges=1000.0,
        destination_charges=1200.0,
        total_amount=18700.0,
        transit_time_days=2,
        quote_validity_date=date.today() + timedelta(days=5),
        created_at=rfq5_start + timedelta(hours=4),
    )
    db.add_all([bid5_1, bid5_2])

    # 6. Force Closed RFQ (Reached maximum extension ceiling)
    rfq6_start = now - timedelta(days=1)
    rfq6_forced = now - timedelta(hours=2)
    rfq6_close = rfq6_forced  # Capped at forced close
    rfq6 = RFQ(
        reference_id="RFQ-2026-DEL-KNP",
        title="Express Dedicated Truck: Delhi -> Kanpur",
        pickup_date=date.today(),
        bid_start_time=rfq6_start,
        bid_close_time=rfq6_close,
        forced_close_time=rfq6_forced,
        trigger_window_mins=10,
        extension_duration_mins=15,
        trigger_type=TriggerType.L1_CHANGE,
        created_at=rfq6_start,
    )
    db.add(rfq6)
    db.flush()

    db.add(
        AuctionLog(
            rfq_id=rfq6.id,
            event_type=EventType.RFQ_CREATED,
            message="Auction created with hard cap.",
            new_close_time=rfq6_close,
            created_at=rfq6_start,
        )
    )
    db.add(
        AuctionLog(
            rfq_id=rfq6.id,
            event_type=EventType.FORCE_CLOSED,
            message="Auction hit forced close ceiling and ended automatically.",
            old_close_time=rfq6_forced,
            new_close_time=rfq6_forced,
            created_at=rfq6_forced,
        )
    )

    db.commit()
    db.close()
    print("Database seeded with 6 sample RFQs.")


if __name__ == "__main__":
    run_seed()
