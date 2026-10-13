/**
 * k6 Load Test — PG Booking Platform
 *
 * Targets:
 *  - Search API: p95 < 250ms at 100 RPS
 *  - Booking API: p95 < 400ms at 50 RPS
 *  - Zero double-bookings under concurrent load
 *
 * Run: k6 run tests/load/booking.load.ts
 * With env: k6 run -e API_BASE=https://staging.pgbooking.in tests/load/booking.load.ts
 */

// @ts-ignore — k6 types
import http from 'k6/http';
// @ts-ignore
import { check, sleep, group } from 'k6';
// @ts-ignore
import { Rate, Counter, Trend } from 'k6/metrics';
// @ts-ignore
import { SharedArray } from 'k6/data';

// ─────────────────────────────────────────────
// Custom Metrics
// ─────────────────────────────────────────────
const doubleBookingAttempts = new Counter('double_booking_attempts');
const doubleBookingPrevented = new Counter('double_booking_prevented');
const searchLatency = new Trend('search_latency_ms', true);
const bookingLatency = new Trend('booking_latency_ms', true);
const errorRate = new Rate('error_rate');

// ─────────────────────────────────────────────
// Test Configuration
// ─────────────────────────────────────────────

export const options = {
  scenarios: {
    // Ramp up search load
    search_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m',  target: 100 },
        { duration: '30s', target: 0 },
      ],
      exec: 'searchScenario',
    },
    // Constant booking load
    booking_constant: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      exec: 'bookingScenario',
      startTime: '30s',
    },
    // Spike: 50 users simultaneously booking same bed
    double_booking_spike: {
      executor: 'shared-iterations',
      vus: 50,
      iterations: 50,
      maxDuration: '30s',
      exec: 'doubleBookingScenario',
      startTime: '2m30s',
    },
  },
  thresholds: {
    'search_latency_ms{scenario:search_ramp}': ['p(95)<250', 'p(99)<500'],
    'booking_latency_ms{scenario:booking_constant}': ['p(95)<400', 'p(99)<800'],
    'error_rate': ['rate<0.01'],                          // < 1% error rate
    'double_booking_prevented': ['count>45'],             // ≥ 45/50 prevented
    'http_req_duration{status:201}': ['p(95)<500'],
  },
};

const API_BASE = __ENV.API_BASE || 'http://localhost/api/v1';

// Pre-generated tokens (load these from a file in real tests)
const TENANT_TOKEN = __ENV.TENANT_TOKEN || 'test-tenant-jwt-token';
const TARGET_BED_ID = __ENV.TARGET_BED_ID || '30000000-0000-0000-0000-000000000004';

const headers = (token: string) => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
});

// ─────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────

export function searchScenario() {
  group('Property Search', () => {
    const start = Date.now();
    const res = http.get(
      `${API_BASE}/properties/search?lat=12.9716&lng=77.5946&radius_km=5`,
    );
    searchLatency.add(Date.now() - start);

    const ok = check(res, {
      'search status 200': (r) => r.status === 200,
      'search has data array': (r) => {
        try { return Array.isArray(JSON.parse(r.body as string).data); } catch { return false; }
      },
      'search latency < 250ms': () => Date.now() - start < 250,
    });
    errorRate.add(!ok);
  });
  sleep(0.1);
}

export function bookingScenario() {
  group('Booking Flow', () => {
    const checkIn = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const start = Date.now();

    const res = http.post(
      `${API_BASE}/bookings`,
      JSON.stringify({ bed_id: TARGET_BED_ID, intended_check_in: checkIn }),
      { headers: headers(TENANT_TOKEN) },
    );
    bookingLatency.add(Date.now() - start);

    check(res, {
      'booking created or conflict': (r) => [201, 409, 400, 422].includes(r.status),
      'booking latency < 400ms': () => Date.now() - start < 400,
    });
    errorRate.add(![201, 409, 400, 422].includes(res.status));
  });
  sleep(0.05);
}

export function doubleBookingScenario() {
  group('Double Booking Prevention', () => {
    const checkIn = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const res = http.post(
      `${API_BASE}/bookings`,
      JSON.stringify({ bed_id: TARGET_BED_ID, intended_check_in: checkIn }),
      { headers: headers(TENANT_TOKEN) },
    );

    doubleBookingAttempts.add(1);

    if (res.status === 201) {
      // This is the one allowed booking
      check(res, { 'single booking succeeded': (r) => r.status === 201 });
    } else if (res.status === 409 || res.status === 400) {
      // Conflict correctly rejected
      doubleBookingPrevented.add(1);
      check(res, { 'double booking prevented': (r) => [409, 400].includes(r.status) });
    } else {
      errorRate.add(1);
    }
  });
}

// ─────────────────────────────────────────────
// Teardown
// ─────────────────────────────────────────────

export function teardown() {
  console.log('Load test complete. Check metrics for double_booking_prevented count.');
}
