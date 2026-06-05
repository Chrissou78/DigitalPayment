import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  constructor(private readonly gateway: NotificationGateway) {}

  @OnEvent('txn.completed')
  handleTransactionCompleted(payload: {
    transactionId: string;
    merchantId: string;
    amount: number;
    fee: number;
    type: string;
  }) {
    this.gateway.sendToMerchant(payload.merchantId, 'transaction.completed', {
      txnId: payload.transactionId,
      amount: payload.amount,
      fee: payload.fee,
      type: payload.type,
      message: `Sale received: R${(payload.amount / 100).toFixed(2)}`,
    });
  }

  @OnEvent('cashin.completed')
  handleCashInCompleted(payload: {
    cashInId: string;
    agentWalletId: string;
    amount: number;
  }) {
    // TODO: resolve merchantId from agentWalletId
    // For now, emit generic log
  }

  @OnEvent('remittance.created')
  handleRemittanceCreated(payload: {
    remittanceId: string;
    recipientPhone: string;
    collectionCode: string;
    amount: number;
  }) {
    // TODO: Send SMS to recipient
    // "You have R{amount} ready for collection. Code: {collectionCode}. Visit any PayDuka merchant."
  }

  @OnEvent('remittance.collected')
  handleRemittanceCollected(payload: {
    remittanceId: string;
    senderPhone: string;
    amount: number;
  }) {
    // TODO: Send SMS to sender confirming delivery
    // "Your R{amount} remittance has been collected."
  }
}
