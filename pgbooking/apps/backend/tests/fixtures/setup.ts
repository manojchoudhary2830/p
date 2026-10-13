import { Pool } from 'pg';
import Redis from 'ioredis';

// ─────────────────────────────────────────────
// Mock infrastructure in unit tests
// ─────────────────────────────────────────────

jest.mock('@config/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((cb: (client: unknown) => Promise<unknown>) => cb({
    query: jest.fn(),
  })),
  getPool: jest.fn(),
}));

jest.mock('@config/redis', () => ({
  getCacheClient: jest.fn(() => ({
    get: jest.fn(), set: jest.fn(), setex: jest.fn(),
    del: jest.fn(), ttl: jest.fn(() => -1), pttl: jest.fn(() => -1),
    exists: jest.fn(() => 0), ping: jest.fn(() => 'PONG'),
    eval: jest.fn(), keys: jest.fn(() => []),
    incrby: jest.fn(() => 1),
  })),
  getLockClient: jest.fn(() => ({
    get: jest.fn(), set: jest.fn(), del: jest.fn(),
    pttl: jest.fn(() => -1), eval: jest.fn(),
  })),
  getSessionClient: jest.fn(() => ({
    get: jest.fn(() => null), setex: jest.fn(), del: jest.fn(),
  })),
  getQueueClient: jest.fn(() => ({ connect: jest.fn(), ping: jest.fn() })),
}));

jest.mock('@infrastructure/queue/bullmq.client', () => ({
  dispatchSms: jest.fn(),
  dispatchEmail: jest.fn(),
  dispatchPush: jest.fn(),
  scheduleReservationRelease: jest.fn(),
  cancelReservationRelease: jest.fn(),
  JOB_NAMES: { SEND_OTP_SMS: 'send-otp-sms' },
}));

jest.mock('@infrastructure/sms/twilio.client', () => ({
  sendSms: jest.fn(),
  sendOtpSms: jest.fn(),
}));

// ─────────────────────────────────────────────
// Test Data Factories
// ─────────────────────────────────────────────

export const testIds = {
  admin:    '00000000-0000-0000-0000-000000000001',
  owner:    '00000000-0000-0000-0000-000000000002',
  tenant:   '00000000-0000-0000-0000-000000000004',
  property: '10000000-0000-0000-0000-000000000001',
  room:     '20000000-0000-0000-0000-000000000001',
  bed:      '30000000-0000-0000-0000-000000000001',
  booking:  '40000000-0000-0000-0000-000000000001',
  payment:  '50000000-0000-0000-0000-000000000001',
};

export function makeUser(overrides = {}) {
  return {
    id: testIds.tenant,
    phone_number: '+919876543213',
    email_address: 'tenant@test.com',
    legal_full_name: 'Test Tenant',
    account_role: 'TENANT' as const,
    identity_kyc_status: 'VERIFIED' as const,
    is_active: true,
    last_login_at: new Date(),
    record_created_at: new Date(),
    record_updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  };
}

export function makeProperty(overrides = {}) {
  return {
    id: testIds.property,
    landlord_owner_id: testIds.owner,
    property_display_name: 'Test PG',
    municipality_city: 'Bengaluru',
    gender_segregation_policy: 'CO_LIVING' as const,
    structural_amenities: ['WIFI'],
    total_beds: 4, vacant_beds: 2,
    min_rent: 8000, max_rent: 18000,
    latitude: 12.971598, longitude: 77.594566,
    is_listing_verified_by_admin: true,
    verification_status: 'VERIFIED' as const,
    is_active: true,
    deleted_at: null,
    created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}

export function makeBed(overrides = {}) {
  return {
    id: testIds.bed,
    room_parent_id: testIds.room,
    bed_spatial_code: 'A',
    current_occupancy_status: 'VACANT' as const,
    last_modified_timestamp: new Date(),
    ...overrides,
  };
}

export function makeBooking(overrides = {}) {
  return {
    id: testIds.booking,
    tenant_user_id: testIds.tenant,
    assigned_bed_id: testIds.bed,
    current_booking_lifecycle_state: 'PENDING' as const,
    scheduled_check_in_date: new Date('2026-07-01'),
    scheduled_check_out_date: null,
    token_fee_amount_paid: '2500.00',
    monthly_rent_amount: '12000.00',
    security_deposit_amount: '24000.00',
    reservation_lock_expires_at: new Date(Date.now() + 600000),
    lock_redis_key: `lock:bed:${testIds.bed}`,
    idempotency_key: 'test-idempotency-key',
    created_at: new Date(), updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  };
}

export function makePayment(overrides = {}) {
  return {
    id: testIds.payment,
    booking_context_id: testIds.booking,
    payer_user_id: testIds.tenant,
    exact_financial_amount: '2500.00',
    currency_code: 'INR',
    transaction_clearance_status: 'SUCCESSFUL' as const,
    payment_gateway_external_id: 'pay_test123',
    payment_gateway_order_id: 'order_test123',
    financial_payment_purpose: 'TOKEN_DEPOSIT' as const,
    idempotency_key: 'test-payment-key',
    gateway_signature: 'valid_sig',
    metadata: null,
    transaction_timestamp: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Silence console in tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});
