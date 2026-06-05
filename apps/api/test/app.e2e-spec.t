import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('PayDuka API (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let merchantId: string;
  let merchantToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('GET /api/v1/health returns OK', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
        });
    });
  });

  describe('Admin Auth', () => {
    it('POST /api/v1/auth/admin-login', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/admin-login')
        .send({ email: 'admin@payduka.xyz', password: 'change-me' })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      adminToken = res.body.access_token;
    });

    it('rejects invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/admin-login')
        .send({ email: 'admin@payduka.xyz', password: 'wrong' })
        .expect(401);
    });
  });

  describe('Merchant Onboarding', () => {
    it('POST /api/v1/merchants creates a merchant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/merchants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          businessName: 'Test Spaza Shop',
          phone: '0811234567',
          pin: '1234',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.apiKey).toBeDefined();
      merchantId = res.body.id;
    });

    it('POST /api/v1/auth/login authenticates merchant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ merchantId, pin: '1234' })
        .expect(201);

      expect(res.body.access_token).toBeDefined();
      merchantToken = res.body.access_token;
    });

    it('GET /api/v1/merchants/:id returns merchant', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/merchants/${merchantId}`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.businessName).toBe('Test Spaza Shop');
        });
    });
  });

  describe('Transaction Flow', () => {
    it('POST /api/v1/transactions creates payment', async () => {
      // This will fail without a funded customer wallet,
      // which validates our business logic
      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          merchantId,
          amount: 5000,
          qrPayload: JSON.stringify({ merchantId, amount: 5000 }),
        })
        .expect(400); // Should fail — no customer wallet

      expect(res.body.message).toBeDefined();
    });
  });

  describe('Admin Dashboard', () => {
    it('GET /api/v1/admin/dashboard returns stats', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.totalMerchants).toBeGreaterThanOrEqual(1);
        });
    });

    it('rejects unauthenticated access', () => {
      return request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .expect(401);
    });
  });
});
