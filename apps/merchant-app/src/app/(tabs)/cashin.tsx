import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { post } from "@/lib/api";

type Stage = "FORM" | "CONFIRM" | "SUCCESS";

export default function CashInScreen() {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>("FORM");
  const [loading, setLoading] = useState(false);
  const [cashInData, setCashInData] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  const initiate = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!phone.trim() || isNaN(cents) || cents <= 0) return;
    setLoading(true);
    try {
      const data = await post<any>("/cash-in", {
        customerPhone: phone.trim(),
        amount: cents,
      });
      setCashInData(data);
      setStage("CONFIRM");
    } catch (e: any) {
      Alert.alert("Error", e?.data?.message ?? "Could not initiate cash-in.");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    setLoading(true);
    try {
      const data = await post<any>("/cash-in/confirm", {
        cashInId: cashInData.id,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(data);
      setStage("SUCCESS");
    } catch (e: any) {
      Alert.alert("Error", e?.data?.message ?? "Confirmation failed.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPhone("");
    setAmount("");
    setStage("FORM");
    setCashInData(null);
    setResult(null);
  };

  if (stage === "SUCCESS") {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <View className="bg-green/10 rounded-full w-20 h-20 items-center justify-center mb-6">
          <Text className="text-green text-4xl">✓</Text>
        </View>
        <Text className="text-green font-heading text-2xl mb-2">
          Cash-In Complete
        </Text>
        <Text className="text-ink font-mono text-3xl mb-1">
          R {(result.amount / 100).toFixed(2)}
        </Text>
        <Text className="text-ink-muted text-sm mb-2">
          Customer: {result.customerPhone}
        </Text>
        <Text className="text-ink-muted text-sm mb-2">
          Your commission: R {(result.merchantCommission / 100).toFixed(2)}
        </Text>
        <Text className="text-ink-muted text-xs mb-8">
          Ref: {result.id?.slice(0, 8)}
        </Text>
        <TouchableOpacity onPress={reset} className="bg-gold rounded-xl px-10 py-4">
          <Text className="text-bg font-heading text-base">New Deposit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (stage === "CONFIRM") {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-ink font-heading text-xl mb-6">
          Confirm Cash-In
        </Text>
        <View className="bg-surface rounded-2xl p-5 w-full mb-6">
          <View className="flex-row justify-between mb-3">
            <Text className="text-ink-muted">Customer</Text>
            <Text className="text-ink font-mono">{cashInData.customerPhone}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-ink-muted">Amount</Text>
            <Text className="text-ink font-mono">
              R {(cashInData.amount / 100).toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-ink-muted">Customer Fee</Text>
            <Text className="text-ink font-mono">
              R {(cashInData.customerFee / 100).toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-ink-muted">Your Commission</Text>
            <Text className="text-green font-mono">
              R {(cashInData.merchantCommission / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        <Text className="text-ink-muted text-sm text-center mb-6">
          Collect R {(cashInData.amount / 100).toFixed(2)} cash from the customer,
          then tap confirm.
        </Text>

        <TouchableOpacity
          onPress={confirm}
          disabled={loading}
          className="w-full bg-gold rounded-xl py-4 items-center mb-3"
        >
          {loading ? (
            <ActivityIndicator color="#0A0A08" />
          ) : (
            <Text className="text-bg font-heading text-base">
              Confirm — Cash Received
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={reset}>
          <Text className="text-ink-muted text-sm underline">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // FORM stage
  return (
    <View className="flex-1 bg-bg items-center justify-center px-8">
      <Text className="text-ink font-heading text-xl mb-8">
        Cash-In Deposit
      </Text>

      <TextInput
        placeholder="Customer Phone (e.g. 0812345678)"
        placeholderTextColor="#A09880"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        className="w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 text-ink text-base mb-4"
      />

      <View className="flex-row items-center w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 mb-6">
        <Text className="text-ink-muted text-base mr-2">R</Text>
        <TextInput
          placeholder="0.00"
          placeholderTextColor="#A09880"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          className="flex-1 text-ink font-mono text-base"
        />
      </View>

      <TouchableOpacity
        onPress={initiate}
        disabled={loading || !phone.trim() || !amount || parseFloat(amount) <= 0}
        className={`w-full rounded-xl py-4 items-center ${
          phone.trim() && amount && parseFloat(amount) > 0
            ? "bg-gold"
            : "bg-surface-2"
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#0A0A08" />
        ) : (
          <Text
            className={`font-heading text-base ${
              phone.trim() && amount && parseFloat(amount) > 0
                ? "text-bg"
                : "text-ink-muted"
            }`}
          >
            Initiate Cash-In
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
