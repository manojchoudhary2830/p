import request from 'supertest';
import { createApp } from '../../../src/app';
import type { Application } from 'express';

// ─── These tests require a real DB + Redis ──
// Run with: docker-compose up -d postgres redis
// then: npm run test:integration

const INTEGRATION_SKIP = process.env.SKIP_INTEGRATION === 'true';
const describeOrSkip = INTEGRATION_SKIP ? describe.skip : describe;

let app: Application;

beforeAll(async () => {
  if (INTEGRATION_SKIP) return;
  const { connectDatabase } = await import('../../../src/config/database');
  const { connectRedis } = await import('../../../src/config/redis');
  await connectDatabase();
  await connectRedis();
  app = createApp();
});

afterAll(async () => {
  if (INTEGRATION_SKIP) return;
  const { disconnectDatabase } = await import('../../../src/config/database');
  const { disconnectRedis } = await import('../../../src/config/redis');
  await disconnectDatabase();
  await disconnectRedis();
});

describeOrSkip('Auth API Integration', () => {
  const TEST_PHONE = `+9199999${Math.floor(Math.random() * 90000) + 10000}`;

  describe('POST /api/v1/auth/otp/send', () => {
    it('returns 202 for valid phone number', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ phone_number: TEST_PHONE });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('success');
      expect(res.body.meta.resend_after_seconds).toBeGreaterThan(0);
    });

    it('returns 422 for invalid phone format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ phone_number: 'not-a-phone' });

      expect(res.status).toBe(422);
      expect(res.body.status).toBe('error');
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'phone_number' })]),
      );
    });

    it('returns 422 for missing phone_number', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({});
      expect(res.status).toBe(422);
    });

    it('respects resend cooldown on repeated calls', async () => {
      const phone = `+9199998${Math.floor(Math.random() * 90000) + 10000}`;
      await request(app).post('/api/v1/auth/otp/send').send({ phone_number: phone });
      const res = await request(app)
        .post('/api/v1/auth/otp/send')
        .send({ phone_number: phone });

      expect(res.status).toBe(202);
      expect(res.body.meta.resend_after_seconds).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/auth/otp/verify', () => {
    it('returns 422 for wrong OTP format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({ phone_number: TEST_PHONE, otp: '12345' }); // 5 digits
      expect(res.status).toBe(422);
    });

    it('returns 422 for non-digit OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({ phone_number: TEST_PHONE, otp: 'abcdef' });
      expect(res.status).toBe(422);
    });

    it('returns 422 for expired/invalid OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({ phone_number: TEST_PHONE, otp: '000000' });
      expect(res.status).toBe(422);
      expect(res.body.status).toBe('error');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with malformed token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not.a.valid.jwt');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/token/refresh', () => {
    it('returns 422 for missing refresh_token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/token/refresh')
        .send({});
      expect(res.status).toBe(422);
    });

    it('returns 401 for invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/token/refresh')
        .send({ refresh_token: 'invalid.refresh.token' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /health', () => {
    it('returns 200 with service statuses', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBeOneOf([200, 503]);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('services');
    });
  });
});

// ─────────────────────────────────────────────
// Property Search API Integration
// ─────────────────────────────────────────────

describeOrSkip('Property Search API Integration', () => {
  describe('GET /api/v1/properties/search', () => {
    it('returns 422 for missing lat/lng', async () => {
      const res = await request(app).get('/api/v1/properties/search');
      expect(res.status).toBe(422);
    });

    it('returns results for valid Bengaluru coordinates', async () => {
      const res = await request(app)
        .get('/api/v1/properties/search')
        .query({ lat: '12.9716', lng: '77.5946', radius_km: '5' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toHaveProperty('total');
    });

    it('filters by gender_policy', async () => {
      const res = await request(app)
        .get('/api/v1/properties/search')
        .query({ lat: '12.9716', lng: '77.5946', radius_km: '10', gender_policy: 'FEMALE' });

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        res.body.data.forEach((p: { gender_segregation_policy: string }) => {
          expect(p.gender_segregation_policy).toBe('FEMALE');
        });
      }
    });

    it('responds within 300ms for standard radius search', async () => {
      const start = Date.now();
      await request(app)
        .get('/api/v1/properties/search')
        .query({ lat: '12.9716', lng: '77.5946', radius_km: '5' });
      expect(Date.now() - start).toBeLessThan(300);
    });

    it('returns 422 for radius > 50km', async () => {
      const res = await request(app)
        .get('/api/v1/properties/search')
        .query({ lat: '12.9716', lng: '77.5946', radius_km: '100' });
      expect(res.status).toBe(422);
    });
  });
});
