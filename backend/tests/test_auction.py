import pytest
from datetime import datetime, timezone, timedelta, date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import RFQ, Bid, AuctionLog, TriggerType, EventType, RFQStatus
from app.services.auction_engine import (
    derive_rfq_status,
    rank_bids,
    calculate_new_close_time,
    evaluate_extension_trigger,
    process_bid_submission,
)
from app.schemas import BidCreate

import tempfile
import os

test_db_file = tempfile.mktemp(suffix="_test_auction.db")
TEST_DATABASE_URL = f"sqlite:///{test_db_file}"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    isolation_level=None,
)

from sqlalchemy import event

@event.listens_for(test_engine, "connect")
def do_connect(dbapi_connection, connection_record):
    dbapi_connection.isolation_level = None
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

@event.listens_for(test_engine, "begin")
def do_begin(conn):
    conn.exec_driver_sql("BEGIN IMMEDIATE")

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def cleanup_temp_db():
    yield
    for suffix in ["", "-wal", "-shm"]:
        path = test_db_file + suffix
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()



def test_dynamic_status_derivation(db_session):
    now = datetime.now(timezone.utc)
    rfq = RFQ(
        reference_id="TEST-001",
        title="Status Test RFQ",
        pickup_date=date.today(),
        bid_start_time=now + timedelta(hours=1),
        bid_close_time=now + timedelta(hours=3),
        forced_close_time=now + timedelta(hours=5),
        trigger_window_mins=10,
        extension_duration_mins=15,
        trigger_type=TriggerType.L1_CHANGE,
    )

    # 1. Before start -> UPCOMING
    assert derive_rfq_status(rfq, now) == RFQStatus.UPCOMING

    # 2. During auction -> ACTIVE
    active_time = now + timedelta(hours=2)
    assert derive_rfq_status(rfq, active_time) == RFQStatus.ACTIVE

    # 3. After normal close -> CLOSED
    closed_time = now + timedelta(hours=4)
    assert derive_rfq_status(rfq, closed_time) == RFQStatus.CLOSED

    # 4. When close reached forced close ceiling -> FORCE_CLOSED
    rfq.bid_close_time = rfq.forced_close_time
    assert derive_rfq_status(rfq, closed_time + timedelta(hours=2)) == RFQStatus.FORCE_CLOSED


def test_ranking_and_tie_breaker(db_session):
    now = datetime.now(timezone.utc)
    bids = [
        Bid(
            id=1,
            rfq_id=1,
            carrier_name="Carrier C",
            freight_charges=60000,
            origin_charges=0,
            destination_charges=0,
            total_amount=60000,
            transit_time_days=3,
            quote_validity_date=date.today(),
            created_at=now - timedelta(minutes=10),
        ),
        Bid(
            id=2,
            rfq_id=1,
            carrier_name="Carrier A (Lowest)",
            freight_charges=45000,
            origin_charges=0,
            destination_charges=0,
            total_amount=45000,
            transit_time_days=3,
            quote_validity_date=date.today(),
            created_at=now - timedelta(minutes=20),
        ),
        Bid(
            id=3,
            rfq_id=1,
            carrier_name="Carrier B1 (Tie Early)",
            freight_charges=50000,
            origin_charges=0,
            destination_charges=0,
            total_amount=50000,
            transit_time_days=3,
            quote_validity_date=date.today(),
            created_at=now - timedelta(minutes=15),
        ),
        Bid(
            id=4,
            rfq_id=1,
            carrier_name="Carrier B2 (Tie Late)",
            freight_charges=50000,
            origin_charges=0,
            destination_charges=0,
            total_amount=50000,
            transit_time_days=3,
            quote_validity_date=date.today(),
            created_at=now - timedelta(minutes=5),
        ),
    ]

    ranked = rank_bids(bids)

    # Carrier A (45000) should be L1
    assert ranked[0].carrier_name == "Carrier A (Lowest)"
    assert ranked[0].rank == "L1"

    # Carrier B1 and B2 tied at 50000 -> B1 submitted earlier, so B1 is L2, B2 is L3
    assert ranked[1].carrier_name == "Carrier B1 (Tie Early)"
    assert ranked[1].rank == "L2"
    assert ranked[2].carrier_name == "Carrier B2 (Tie Late)"
    assert ranked[2].rank == "L3"

    # Carrier C (60000) is L4
    assert ranked[3].carrier_name == "Carrier C"
    assert ranked[3].rank == "L4"


def test_extension_formula_and_hard_ceiling():
    now = datetime(2026, 11, 17, 12, 0, 0, tzinfo=timezone.utc)
    current_close = datetime(2026, 11, 17, 12, 5, 0, tzinfo=timezone.utc)
    forced_close = datetime(2026, 11, 17, 12, 20, 0, tzinfo=timezone.utc)

    # 1. Normal extension: +10 mins gives 12:15, which is < 12:20
    new_close = calculate_new_close_time(current_close, forced_close, extension_duration_mins=10)
    assert new_close == datetime(2026, 11, 17, 12, 15, 0, tzinfo=timezone.utc)

    # 2. Capped extension: +20 mins would give 12:25, but forced_close is 12:20 -> should cap at 12:20
    capped_close = calculate_new_close_time(current_close, forced_close, extension_duration_mins=20)
    assert capped_close == forced_close


def test_extension_trigger_rules():
    now = datetime(2026, 11, 17, 11, 55, 0, tzinfo=timezone.utc)
    close_time = datetime(2026, 11, 17, 12, 0, 0, tzinfo=timezone.utc)  # 5 mins left
    forced_close = datetime(2026, 11, 17, 12, 30, 0, tzinfo=timezone.utc)

    rfq_bid_rec = RFQ(
        id=1,
        reference_id="TEST-BID-REC",
        title="Test",
        pickup_date=date.today(),
        bid_start_time=now - timedelta(hours=1),
        bid_close_time=close_time,
        forced_close_time=forced_close,
        trigger_window_mins=10,
        extension_duration_mins=10,
        trigger_type=TriggerType.BID_RECEIVED,
    )

    # BID_RECEIVED inside 10m window -> True
    assert evaluate_extension_trigger(rfq_bid_rec, [], 50000, submission_time=now) is True

    # Bid outside window (15 mins before close with window 10) -> False
    early_now = datetime(2026, 11, 17, 11, 40, 0, tzinfo=timezone.utc)
    assert evaluate_extension_trigger(rfq_bid_rec, [], 50000, submission_time=early_now) is False

    # L1_CHANGE trigger
    rfq_l1 = RFQ(
        id=2,
        reference_id="TEST-L1",
        title="Test",
        pickup_date=date.today(),
        bid_start_time=now - timedelta(hours=1),
        bid_close_time=close_time,
        forced_close_time=forced_close,
        trigger_window_mins=10,
        extension_duration_mins=10,
        trigger_type=TriggerType.L1_CHANGE,
    )
    existing_bids = [
        Bid(
            id=1,
            rfq_id=2,
            carrier_name="C1",
            freight_charges=50000,
            origin_charges=0,
            destination_charges=0,
            total_amount=50000,
            transit_time_days=2,
            quote_validity_date=date.today(),
            created_at=now - timedelta(minutes=15),
        )
    ]

    # Lower quote (48000 < 50000) -> Triggers L1_CHANGE
    assert evaluate_extension_trigger(rfq_l1, existing_bids, 48000, submission_time=now) is True

    # Higher quote (52000 > 50000) -> Does NOT trigger L1_CHANGE
    assert evaluate_extension_trigger(rfq_l1, existing_bids, 52000, submission_time=now) is False



def test_api_create_rfq(client):
    now = datetime.now(timezone.utc)
    payload = {
        "title": "API Test FTL Mumbai to Pune",
        "pickup_date": str(date.today() + timedelta(days=2)),
        "bid_start_time": (now + timedelta(minutes=5)).isoformat(),
        "bid_close_time": (now + timedelta(hours=2)).isoformat(),
        "forced_close_time": (now + timedelta(hours=4)).isoformat(),
        "trigger_window_mins": 15,
        "extension_duration_mins": 15,
        "trigger_type": "L1_CHANGE",
    }
    resp = client.post("/api/rfqs", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == payload["title"]
    assert data["reference_id"].startswith("RFQ-")
    assert data["status"] == "UPCOMING"
    assert len(data["logs"]) == 1
    assert data["logs"][0]["event_type"] == "RFQ_CREATED"


def test_api_rfq_validation_error(client):
    now = datetime.now(timezone.utc)
    # Invalid: close time before start time
    payload = {
        "title": "Invalid RFQ",
        "pickup_date": str(date.today()),
        "bid_start_time": (now + timedelta(hours=2)).isoformat(),
        "bid_close_time": (now + timedelta(hours=1)).isoformat(),
        "forced_close_time": (now + timedelta(hours=3)).isoformat(),
        "trigger_window_mins": 10,
        "extension_duration_mins": 10,
        "trigger_type": "BID_RECEIVED",
    }
    resp = client.post("/api/rfqs", json=payload)
    assert resp.status_code == 422


def test_api_submit_bid_and_extension(client, db_session):
    now = datetime.now(timezone.utc)
    # Create active RFQ with 3 minutes remaining and 10 mins window
    rfq = RFQ(
        reference_id="RFQ-TEST-EXT-1",
        title="Live Extension RFQ",
        pickup_date=date.today(),
        bid_start_time=now - timedelta(minutes=30),
        bid_close_time=now + timedelta(minutes=3),
        forced_close_time=now + timedelta(minutes=30),
        trigger_window_mins=10,
        extension_duration_mins=15,
        trigger_type=TriggerType.BID_RECEIVED,
        created_at=now - timedelta(minutes=30),
    )
    db_session.add(rfq)
    db_session.commit()
    rfq_id = rfq.id
    db_session.close()

    bid_payload = {
        "carrier_name": "Swift Logistics",
        "freight_charges": 35000.0,
        "origin_charges": 2000.0,
        "destination_charges": 1500.0,
        "transit_time_days": 2,
        "quote_validity_date": str(date.today() + timedelta(days=10)),
    }

    resp = client.post(f"/api/rfqs/{rfq_id}/bids", json=bid_payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["extension_triggered"] is True
    assert data["bid"]["total_amount"] == 38500.0
    assert data["bid"]["rank"] == "L1"

    # Verify RFQ detail endpoint reflects extended time and logs
    rfq_resp = client.get(f"/api/rfqs/{rfq_id}")
    assert rfq_resp.status_code == 200
    rfq_data = rfq_resp.json()
    assert len(rfq_data["bids"]) == 1
    assert any(log["event_type"] == "TIME_EXTENDED" for log in rfq_data["logs"])


def test_api_reject_bid_on_closed_rfq(client, db_session):
    now = datetime.now(timezone.utc)
    rfq = RFQ(
        reference_id="RFQ-TEST-CLOSED",
        title="Past Closed RFQ",
        pickup_date=date.today() - timedelta(days=2),
        bid_start_time=now - timedelta(days=2),
        bid_close_time=now - timedelta(days=1),
        forced_close_time=now - timedelta(hours=12),
        trigger_window_mins=10,
        extension_duration_mins=10,
        trigger_type=TriggerType.BID_RECEIVED,
        created_at=now - timedelta(days=2),
    )
    db_session.add(rfq)
    db_session.commit()
    rfq_id = rfq.id
    db_session.close()

    bid_payload = {
        "carrier_name": "Late Carrier",
        "freight_charges": 20000.0,
        "origin_charges": 1000.0,
        "destination_charges": 1000.0,
        "transit_time_days": 2,
        "quote_validity_date": str(date.today()),
    }
    resp = client.post(f"/api/rfqs/{rfq_id}/bids", json=bid_payload)
    assert resp.status_code == 400
    assert "Auction has ended" in resp.json()["detail"]


def test_api_ceiling_cap_enforcement(client, db_session):
    now = datetime.now(timezone.utc)
    # RFQ close time is already at forced_close_time
    forced_time = now + timedelta(minutes=2)
    rfq = RFQ(
        reference_id="RFQ-TEST-CAPPED",
        title="Capped RFQ",
        pickup_date=date.today(),
        bid_start_time=now - timedelta(minutes=30),
        bid_close_time=forced_time,
        forced_close_time=forced_time,
        trigger_window_mins=10,
        extension_duration_mins=15,
        trigger_type=TriggerType.BID_RECEIVED,
        created_at=now - timedelta(minutes=30),
    )
    db_session.add(rfq)
    db_session.commit()
    rfq_id = rfq.id
    db_session.close()

    bid_payload = {
        "carrier_name": "Final Carrier",
        "freight_charges": 30000.0,
        "origin_charges": 1000.0,
        "destination_charges": 1000.0,
        "transit_time_days": 2,
        "quote_validity_date": str(date.today() + timedelta(days=5)),
    }
    resp = client.post(f"/api/rfqs/{rfq_id}/bids", json=bid_payload)
    assert resp.status_code == 201
    data = resp.json()
    # Extension could not exceed forced close time, so extension_triggered is False
    assert data["extension_triggered"] is False
    assert "forced close time" in data["message"].lower()


def test_concurrent_bidding(client, db_session):
    from concurrent.futures import ThreadPoolExecutor

    now = datetime.now(timezone.utc)
    rfq = RFQ(
        reference_id="RFQ-TEST-CONCURRENCY",
        title="Concurrent Stress RFQ",
        pickup_date=date.today(),
        bid_start_time=now - timedelta(minutes=30),
        bid_close_time=now + timedelta(minutes=5),
        forced_close_time=now + timedelta(minutes=45),
        trigger_window_mins=10,
        extension_duration_mins=5,
        trigger_type=TriggerType.BID_RECEIVED,
        created_at=now - timedelta(minutes=30),
    )
    db_session.add(rfq)
    db_session.commit()
    rfq_id = rfq.id
    db_session.close()

    def submit_carrier_bid(i):
        payload = {
            "carrier_name": f"Carrier {i}",
            "freight_charges": 40000.0 - (i * 500),
            "origin_charges": 1000.0,
            "destination_charges": 1000.0,
            "transit_time_days": 3,
            "quote_validity_date": str(date.today() + timedelta(days=10)),
        }
        return client.post(f"/api/rfqs/{rfq_id}/bids", json=payload)

    with ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(submit_carrier_bid, range(5)))

    # All submissions should succeed
    for res in results:
        assert res.status_code == 201

    # Verify RFQ bids count
    rfq_resp = client.get(f"/api/rfqs/{rfq_id}")
    data = rfq_resp.json()
    assert len(data["bids"]) == 5
    # Verify lowest is L1
    assert data["bids"][0]["rank"] == "L1"
    assert data["bids"][0]["total_amount"] == 40000.0 - (4 * 500) + 2000.0

