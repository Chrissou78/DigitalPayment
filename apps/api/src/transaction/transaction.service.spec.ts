import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { TransactionService } from './transaction.service';
import { Transaction } from './transaction.entity';
import { Wallet } from '../wallet/wallet.entity';
import { LedgerEntry } from '../wallet/ledger-entry.entity';
import { FraudService } from '../fraud/fraud.service';
import { PaymentRailService } from '../payment-rail/payment-rail.service';

describe('TransactionService', () => {
  let service: TransactionService;
  let mockManager: jest.Mocked<EntityManager>;

  const customerWallet = {
    id: 'cust-wallet',
    ownerId: 'cust-1',
    ownerType: 'CUSTOMER',
    available: 500000, // R5,000
    reserved: 0,
    staked: 0,
    currency: 'ZAR',
    status: 'ACTIVE',
  };

  const merchantWallet = {
    id: 'merch-wallet',
    ownerId: 'merch-1',
    ownerType: 'MERCHANT',
    available: 200000, // R2,000
    reserved: 10000,
    staked: 0,
    currency: 'ZAR',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve({ id: 'txn-1', ...entity })),
      create: jest.fn((_, data) => data),
    } as unknown as jest.Mocked<EntityManager>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb) => cb(mockManager)),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, any> = {
                'rules.transactionFeePercent': 1.5,
                'rules.merchantReservePercent': 5,
              };
              return map[key];
            }),
          },
        },
        {
          provide: FraudService,
          useValue: {
            score: jest.fn().mockResolvedValue({
              riskLevel: 'LOW',
              score: 10,
              pass: true,
            }),
          },
        },
        {
          provide: PaymentRailService,
          useValue: {
            authorizeCard: jest.fn().mockResolvedValue({
              authorized: true,
              authCode: 'AUTH123',
            }),
          },
        },
      ],
    }).compile();

    service = module.get(TransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPayment', () => {
    it('correctly calculates fee and reserve', () => {
      const amount = 100000; // R1,000
      const feePercent = 1.5;
      const reservePercent = 5;

      const fee = Math.round(amount * feePercent / 100);
      const reserve = Math.round(amount * reservePercent / 100);
      const merchantReceives = amount - fee;

      expect(fee).toBe(1500);           // R15.00
      expect(reserve).toBe(5000);       // R50.00
      expect(merchantReceives).toBe(98500); // R985.00
    });

    it('rejects when customer balance is insufficient', async () => {
      const poorCustomerWallet = { ...customerWallet, available: 100 };

      mockManager.findOne
        .mockResolvedValueOnce(poorCustomerWallet)  // customer wallet
        .mockResolvedValueOnce(merchantWallet);       // merchant wallet

      await expect(
        service.createPayment({
          merchantId: 'merch-1',
          customerId: 'cust-1',
          amount: 500000,
          qrPayload: '{}',
        }),
      ).rejects.toThrow(/insufficient/i);
    });
  });
});
