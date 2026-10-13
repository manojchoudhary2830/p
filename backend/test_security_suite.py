import sys
from starlette.testclient import TestClient
import server

def run_tests():
    with TestClient(server.app) as c:
        print("=== 1. HEALTH CHECK ===")
        res = c.get("/health")
        assert res.status_code == 200, f"Health check failed: {res.status_code}"
        assert res.json()["status"] == "PASS"
        print("Health check PASS:", res.json()["checks"])

        print("\n=== 2. LOGIN RATE LIMITING ===")
        for i in range(5):
            r = c.post("/api/auth/login", json={"email": "hacker@test.com", "password": "wrong"})
            assert r.status_code == 401
        blocked = c.post("/api/auth/login", json={"email": "hacker@test.com", "password": "wrong"})
        assert blocked.status_code == 429, f"Expected 429, got {blocked.status_code}"
        print(f"Rate limiting active: blocked with {blocked.status_code} ({blocked.json()['detail']})")

        print("\n=== 3. SITEMAP XML ===")
        s = c.get("/api/sitemap.xml")
        assert s.status_code == 200
        assert "cities/jaipur" in s.text
        assert "cities/neemrana" in s.text
        assert "cities/behror" in s.text
        assert "cities/kotputli" in s.text
        print("Sitemap generated correctly with all 4 cities and properties!")

        print("\n=== 4. ReDoS SEARCH SANITIZATION ===")
        # Vulnerable regex pattern that causes catastrophic backtracking in unescaped regexes:
        redos_pattern = "((a*)*)*"
        sr = c.get(f"/api/properties?search={redos_pattern}")
        assert sr.status_code == 200
        print("ReDoS pattern safely sanitized and handled without timeout or crash!")

        print("\n=== 5. BOOKING, BED LOCK & REFUND RETRY RESTRICTION ===")
        from app.ratelimit import login_limiter
        login_limiter.history.clear()
        # Login as tenant
        login_res = c.post("/api/auth/login", json={"email": "student@example.com", "password": "password123"})
        assert login_res.status_code == 200, f"Login failed: {login_res.status_code} {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Lock bed
        lock_res = c.post("/api/bookings/lock-bed", json={"property_id": "prop-jpr-01", "room_id": "room-101", "bed_id": "bed-101-A"}, headers=headers)
        assert lock_res.status_code == 200
        print("Bed lock acquired. TTL:", lock_res.json()["ttl_minutes"], "minutes")

        # Initiate booking
        init_res = c.post("/api/bookings/initiate", json={"property_id": "prop-jpr-01", "room_id": "room-101", "bed_id": "bed-101-A", "check_in_date": "2026-11-01"}, headers=headers)
        booking = init_res.json()
        bk_id = booking["_id"]
        print(f"Booking initiated: {bk_id}, token deposit: INR {booking['token_deposit_amount']}")

        # Confirm booking
        conf_res = c.post(f"/api/bookings/{bk_id}/confirm", headers=headers)
        assert conf_res.status_code == 200
        print("Booking confirmed! Bed occupied.")

        # Cancel booking
        cancel_res = c.post(f"/api/bookings/{bk_id}/cancel", json={"reason": "Change of plans"}, headers=headers)
        assert cancel_res.status_code == 200
        assert cancel_res.json()["refund_status"] == "refund_pending"
        print(f"Booking cancelled with eligible refund: INR {cancel_res.json()['refund_amount']} (Status: refund_pending)")

        # Process refund (first time: succeeds)
        ref1 = c.post(f"/api/bookings/{bk_id}/process-refund", json={}, headers=headers)
        assert ref1.status_code == 200
        assert ref1.json()["refund_status"] == "refunded"
        print("First refund processed successfully.")

        # Duplicate refund retry (MUST be rejected because status is already refunded)
        ref2 = c.post(f"/api/bookings/{bk_id}/process-refund", json={}, headers=headers)
        assert ref2.status_code == 400
        print(f"Duplicate refund retry prevented: {ref2.status_code} - {ref2.json()['detail']}")

        print("\n*** ALL AUDIT AND BUSINESS LOGIC TESTS PASSED SUCCESSFULLY! ***")

if __name__ == "__main__":
    run_tests()
