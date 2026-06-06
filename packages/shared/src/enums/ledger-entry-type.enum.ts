// Accounting primitive recorded in ledger_entries.type.
// Business context (payment, remittance, cash-in, ...) goes in reference_type.
export enum LedgerEntryType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
  RESERVE_HOLD = 'RESERVE_HOLD',
  RESERVE_RELEASE = 'RESERVE_RELEASE',
  STAKE_LOCK = 'STAKE_LOCK',
  STAKE_UNLOCK = 'STAKE_UNLOCK',
  STAKING_REWARD = 'STAKING_REWARD',
  FEE_REVENUE = 'FEE_REVENUE',
  ADVANCE_CREDIT = 'ADVANCE_CREDIT',
  ADVANCE_RECOVERY = 'ADVANCE_RECOVERY',
}
