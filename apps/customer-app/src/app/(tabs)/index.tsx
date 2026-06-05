import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { useWalletStore } from "@/stores/wallet";
import { useTransactionStore, Transaction } from "@/stores/transactions";

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

function TxnRow({ txn }: { txn: Transaction }) {
  const isCredit = ["CASH_IN", "REFILL", "REMITTANCE_IN"].includes(txn.type);
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-surface-2">
      <View className="flex-1">
        <Text className="text-ink text-sm font-sans">
          {txn.merchantName ?? txn.type}
        </Text>
        <Text className="text-ink-muted text-xs">
          {new Date(txn.createdAt).toLocaleDateString()} ·{" "}
          {new Date(txn.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <Text
        className={`font-mono text-sm ${isCredit ? "text-green" : "text-ink"}`}
      >
        {isCredit ? "+" : "-"}
        {formatZAR(txn.amount)}
      </Text>
    </View>
  );
}

export default function WalletHome() {
  const router = useRouter();
  const customer = useAuthStore((s) => s.customer);
  const { balance, isLoading: walletLoading, fetch: fetchWallet } = useWalletStore();
  const { items, isLoading: txnLoading, fetch: fetchTxns } = useTransactionStore();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchWallet(), fetchTxns()]);
    setRefreshing(false);
  }, []);

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="px-5 pt-14 pb-8"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8A85C" />
      }
    >
      {/* Greeting */}
      <Text className="text-ink-muted text-sm mb-1">Hello</Text>
      <Text className="text-ink font-heading text-2xl mb-6">
        {customer?.firstName ?? "there"}
      </Text>

      {/* Balance Card */}
      <View className="bg-surface rounded-2xl p-6 mb-6">
        <Text className="text-ink-muted text-xs uppercase tracking-wider mb-1">
          Your Balance
        </Text>
        <Text className="text-gold font-heading text-5xl mb-4">
          {formatZAR(balance)}
        </Text>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => router.push("/pay")}
            className="flex-1 bg-gold rounded-xl py-3 items-center"
          >
            <Text className="text-bg font-heading text-sm">Pay</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/send")}
            className="flex-1 bg-surface-2 border border-gold-dim rounded-xl py-3 items-center"
          >
            <Text className="text-gold font-heading text-sm">Send</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View className="flex-row gap-3 mb-6">
        <TouchableOpacity className="flex-1 bg-surface rounded-xl p-4 items-center">
          <Text className="text-blue font-heading text-sm mb-1">Cash-In</Text>
          <Text className="text-ink-muted text-xs text-center">
            Deposit at a merchant
          </Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 bg-surface rounded-xl p-4 items-center">
          <Text className="text-green font-heading text-sm mb-1">Refill</Text>
          <Text className="text-ink-muted text-xs text-center">
            Auto-refill from bank
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent Transactions */}
      <Text className="text-ink font-heading text-lg mb-3">Recent</Text>
      {items.length === 0 ? (
        <Text className="text-ink-muted text-sm text-center py-8">
          No transactions yet. Pay at a merchant to get started.
        </Text>
      ) : (
        items.slice(0, 15).map((txn) => <TxnRow key={txn.id} txn={txn} />)
      )}

      {items.length > 15 && (
        <TouchableOpacity
          onPress={() => router.push("/activity")}
          className="py-4 items-center"
        >
          <Text className="text-gold text-sm">View all activity</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
