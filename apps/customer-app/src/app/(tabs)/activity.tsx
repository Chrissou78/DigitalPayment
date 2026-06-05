import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { useState, useCallback } from "react";
import { useTransactionStore, Transaction } from "@/stores/transactions";
import { useRemittanceStore, Remittance } from "@/stores/remittance";

type Tab = "ALL" | "PAYMENTS" | "REMITTANCES";

function formatZAR(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

function TxnItem({ txn }: { txn: Transaction }) {
  const isCredit = ["CASH_IN", "REFILL", "REMITTANCE_IN"].includes(txn.type);
  return (
    <View className="flex-row items-center justify-between px-5 py-4 border-b border-surface-2">
      <View className="flex-1">
        <Text className="text-ink text-sm font-sans">
          {txn.merchantName ?? txn.description ?? txn.type}
        </Text>
        <Text className="text-ink-muted text-xs mt-1">
          {new Date(txn.createdAt).toLocaleDateString()} ·{" "}
          {new Date(txn.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          · {txn.status}
        </Text>
      </View>
      <View className="items-end">
        <Text
          className={`font-mono text-sm ${isCredit ? "text-green" : "text-ink"}`}
        >
          {isCredit ? "+" : "-"}
          {formatZAR(txn.amount)}
        </Text>
        {txn.fee > 0 && (
          <Text className="text-ink-muted text-xs font-mono">
            fee {formatZAR(txn.fee)}
          </Text>
        )}
      </View>
    </View>
  );
}

function RemittanceItem({ r }: { r: Remittance }) {
  return (
    <View className="flex-row items-center justify-between px-5 py-4 border-b border-surface-2">
      <View className="flex-1">
        <Text className="text-ink text-sm font-sans">
          To {r.recipientPhone}
        </Text>
        <Text className="text-ink-muted text-xs mt-1">
          {new Date(r.createdAt).toLocaleDateString()} · {r.trackingCode} ·{" "}
          {r.status}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-ink font-mono text-sm">-{formatZAR(r.amount)}</Text>
        <Text className="text-ink-muted text-xs font-mono">
          fee {formatZAR(r.senderFee)}
        </Text>
      </View>
    </View>
  );
}

export default function ActivityScreen() {
  const [tab, setTab] = useState<Tab>("ALL");
  const { items: txns, fetch: fetchTxns } = useTransactionStore();
  const { sent, received, fetch: fetchRemittances } = useRemittanceStore();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchTxns(), fetchRemittances()]);
    setRefreshing(false);
  }, []);

  const TabButton = ({ label, value }: { label: string; value: Tab }) => (
    <TouchableOpacity
      onPress={() => setTab(value)}
      className={`flex-1 py-2 rounded-lg items-center ${
        tab === value ? "bg-gold" : ""
      }`}
    >
      <Text
        className={`font-heading text-xs ${
          tab === value ? "text-bg" : "text-ink-muted"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-bg pt-14">
      <Text className="text-ink font-heading text-xl px-5 mb-4">Activity</Text>

      {/* Tab selector */}
      <View className="flex-row bg-surface rounded-xl p-1 mx-5 mb-4">
        <TabButton label="All" value="ALL" />
        <TabButton label="Payments" value="PAYMENTS" />
        <TabButton label="Remittances" value="REMITTANCES" />
      </View>

      {tab === "REMITTANCES" ? (
        <FlatList
          data={[...sent, ...received].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <RemittanceItem r={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#C8A85C"
            />
          }
          ListEmptyComponent={
            <Text className="text-ink-muted text-sm text-center py-12">
              No remittances yet.
            </Text>
          }
        />
      ) : (
        <FlatList
          data={
            tab === "PAYMENTS"
              ? txns.filter((t) =>
                  ["PAYMENT", "CASH_IN", "REFILL"].includes(t.type)
                )
              : txns
          }
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TxnItem txn={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#C8A85C"
            />
          }
          ListEmptyComponent={
            <Text className="text-ink-muted text-sm text-center py-12">
              No transactions yet.
            </Text>
          }
        />
      )}
    </View>
  );
}
