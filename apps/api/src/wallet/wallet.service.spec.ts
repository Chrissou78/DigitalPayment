import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { WalletService } from './wallet.service';
import { Wallet } from './entities/wallet.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';

describe('WalletService', () => {
  let service: WalletService;
  let walletRepo: jest.Mocked<Repository<Wallet>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockWallet: Wallet = {
    id: 'wallet-1',
    ownerId: 'merchant-1',
    ownerType: 'MERCHANT',
    available: 100000, // R1,000.00
    reserved: 5000,    // R50.00
    staked: 0,
    currency: 'ZAR',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockManager = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LedgerEntry),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb) => cb(mockManager)),
          },
        },
      ],
    }).compile();

    service = module.get(WalletService);
    walletRepo = module.get(getRepositoryToken(Wallet));
    dataSource = module.get(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBalance', () => {
    it('returns wallet balances', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet);

      const result = await service.getBalance('wallet-1');

      expect(result).toEqual({
        available: 100000,
        reserved: 5000,
        staked: 0,
        currency: 'ZAR',
      });
    });

    it('throws if wallet not found', async () => {
      walletRepo.findOne.mockResolvedValue(null);

      await expect(service.getBalance('missing')).rejects.toThrow();
    });
  });
});
