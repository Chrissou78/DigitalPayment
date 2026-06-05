import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { useWalletStore } from "@/stores/wallet";
import { useTransactionStore, Transaction } from "@/stores/transactions";

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

function TxnRow({ txn }: { txn: Transaction }) {
  const isCredit = ["CASH_IN", "ADVANCE", "REFILL"].includes(txn.type);
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-surface-2">
      <View className="flex-1">
        <Text className="text-ink text-sm font-sans">{txn.type}</Text>
        <Text className="text-ink-muted text-xs">
          {new Date(txn.createdAt).toLocaleTimeString()}
        </Text>
      </View>
      <View className="items-end">
        <Text className={`text-sm font-mono ${isCredit ? "text-green" : "text-ink"}`}>
          {isCredit ? "+" : ""}
          {formatZAR(txn.amount)}
        </Text>
        <Text className="text-ink-muted text-xs">{txn.status}</Text>
      </View>
    </View>
  );
}

export default function Dashboard() {
  const merchantName = useAuthStore((s) => s.merchantName);
  const merchantId = useAuthStore((s) => s.merchantId);
  const { balanceAvailable, balanceReserved, isLoading: walletLoading, fetch: fetchWallet } = useWalletStore();
  const { items, todayTotal, todayCount, isLoading: txnLoading, fetch: fetchTxns } = useTransactionStore();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (!merchantId) return;
    setRefreshing(true);
    await Promise.all([fetchWallet(merchantId), fetchTxns(merchantId)]);
    setRefreshing(false);
  }, [merchantId]);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="px-5 pt-14 pb-8"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#C8A85C"
        />
      }
    >
      {/* Header */}
      <Text className="text-ink-muted text-sm mb-1">Welcome back</Text>
      <Text className="text-ink font-heading text-2xl mb-6">
        {merchantName ?? "Merchant"}
      </Text>

      {/* Wallet Card */}
      <View className="bg-surface rounded-2xl p-5 mb-4">
        <Text className="text-ink-muted text-xs uppercase tracking-wider mb-1">
          Available Balance
        </Text>
        <Text className="text-gold font-heading text-4xl mb-3">
          {formatZAR(balanceAvailable)}
        </Text>
        <View className="flex-row justify-between">
          <View>
            <Text className="text-ink-muted text-xs">Reserved</Text>
            <Text className="text-ink font-mono text-sm">
              {formatZAR(balanceReserved)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-ink-muted text-xs">Today</Text>
            <Text className="text-green font-mono text-sm">
              {formatZAR(todayTotal)} · {todayCount} txns
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <View className="flex-row gap-3 mb-6">
        <View className="flex-1 bg-surface rounded-xl p-4 items-center">
          <Text className="text-gold font-heading text-xl">
            {todayCount}
          </Text>
          <Text className="text-ink-muted text-xs">Transactions</Text>
        </View>
        <View className="flex-1 bg-surface rounded-xl p-4 items-center">
          <Text className="text-green font-heading text-xl">
            {formatZAR(todayTotal)}
          </Text>
          <Text className="text-ink-muted text-xs">Revenue</Text>
        </View>
      </View>

      {/* Recent Transactions */}
      <Text className="text-ink font-heading text-lg mb-3">
        Recent Activity
      </Text>
      {items.length === 0 ? (
        <Text className="text-ink-muted text-sm text-center py-8">
          No transactions yet today.
        </Text>
      ) : (
        items.slice(0, 20).map((txn) => <TxnRow key={txn.id} txn={txn} />)
      )}
    </ScrollView>
  );
}
