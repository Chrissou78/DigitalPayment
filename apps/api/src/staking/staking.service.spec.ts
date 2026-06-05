import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { StakingService } from './staking.service';
import { Wallet } from '../wallet/wallet.entity';
import { LedgerEntry } from '../wallet/ledger-entry.entity';

describe('StakingService', () => {
  let service: StakingService;
  let mockManager: jest.Mocked<EntityManager>;

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
    } as unknown as jest.Mocked<EntityManager>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StakingService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
        {
          provide: getRepositoryToken(LedgerEntry),
          useValue: { save: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb) => cb(mockManager)),
          },
        },
      ],
    }).compile();

    service = module.get(StakingService);
  });

  describe('stake', () => {
    it('moves funds from available to staked', async () => {
      const wallet = {
        id: 'w-1',
        available: 100000,
        staked: 0,
        reserved: 0,
      };
      mockManager.findOne.mockResolvedValue(wallet);

      const result = await service.stake('w-1', 50000);

      expect(mockManager.save).toHaveBeenCalled();
      expect(wallet.available).toBe(50000);
      expect(wallet.staked).toBe(50000);
    });

    it('rejects if insufficient available balance', async () => {
      mockManager.findOne.mockResolvedValue({
        id: 'w-1',
        available: 1000,
        staked: 0,
      });

      await expect(service.stake('w-1', 50000)).rejects.toThrow(
        /insufficient/i,
      );
    });

    it('rejects zero or negative amount', async () => {
      await expect(service.stake('w-1', 0)).rejects.toThrow();
      await expect(service.stake('w-1', -100)).rejects.toThrow();
    });
  });

  describe('unstake', () => {
    it('moves funds from staked to available', async () => {
      const wallet = {
        id: 'w-1',
        available: 10000,
        staked: 50000,
      };
      mockManager.findOne.mockResolvedValue(wallet);

      await service.unstake('w-1', 25000);

      expect(wallet.staked).toBe(25000);
      expect(wallet.available).toBe(35000);
    });
  });

  describe('distributeRewards', () => {
    it('calculates daily reward correctly', () => {
      const stakedAmount = 10000000; // R100,000
      const apyPercent = 12;
      const dailyRate = apyPercent / 100 / 365.25;
      const reward = Math.floor(stakedAmount * dailyRate);

      // R100,000 at 12% APY = ~R32.85/day
      expect(reward).toBe(3285);
    });
  });
});
