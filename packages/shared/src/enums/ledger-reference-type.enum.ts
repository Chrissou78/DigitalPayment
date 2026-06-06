// Business context for a ledger entry, stored in ledger_entries.reference_type.
export enum LedgerReferenceType {
  PAYMENT = 'PAYMENT',
  CASH_IN = 'CASH_IN',
  CASH_OUT = 'CASH_OUT',
  REMITTANCE = 'REMITTANCE',
  REFILL = 'REFILL',
  ADVANCE = 'ADVANCE',
  STAKING = 'STAKING',
  COMMISSION = 'COMMISSION',
  FEE = 'FEE',
}
