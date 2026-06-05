import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { post } from "@/lib/api";
import { useWalletStore } from "@/stores/wallet";
import { useRemittanceStore } from "@/stores/remittance";

type Stage = "FORM" | "CONFIRM" | "SUCCESS";

export default function SendScreen() {
  const balance = useWalletStore((s) => s.balance);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>("FORM");
  const [sendData, setSendData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const initiate = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!recipientPhone.trim() || isNaN(cents) || cents <= 0) return;
    if (cents > balance) {
      Alert.alert("Insufficient Balance", "You don't have enough funds.");
      return;
    }
    setLoading(true);
    try {
      const data = await post<any>("/remittance/send", {
        recipientPhone: recipientPhone.trim(),
        amount: cents,
      });
      setSendData(data);
      setStage("CONFIRM");
    } catch (e: any) {
      Alert.alert("Error", e?.data?.message ?? "Could not create remittance.");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStage("SUCCESS");
  };

  const copyCode = async () => {
    await Clipboard.setStringAsync(sendData.trackingCode);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setRecipientPhone("");
    setAmount("");
    setStage("FORM");
    setSendData(null);
    setCopied(false);
  };

  if (stage === "SUCCESS") {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <View className="bg-green/10 rounded-full w-20 h-20 items-center justify-center mb-6">
          <Text className="text-green text-4xl">✓</Text>
        </View>
        <Text className="text-green font-heading text-2xl mb-2">Money Sent</Text>
        <Text className="text-ink font-mono text-3xl mb-4">
          R {(sendData.amount / 100).toFixed(2)}
        </Text>

        <TouchableOpacity
          onPress={copyCode}
          className="bg-surface rounded-xl px-6 py-4 mb-2"
        >
          <Text className="text-ink-muted text-xs text-center mb-1">
            Tracking Code {copied ? "(Copied!)" : "(tap to copy)"}
          </Text>
          <Text className="text-gold font-mono text-2xl text-center tracking-widest">
            {sendData.trackingCode}
          </Text>
        </TouchableOpacity>

        <Text className="text-ink-muted text-sm text-center mb-8 px-4">
          Share this code with {recipientPhone}. They can collect the cash at any
          PayDuka merchant.
        </Text>

        <TouchableOpacity onPress={reset} className="bg-gold rounded-xl px-10 py-4">
          <Text className="text-bg font-heading text-base">Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (stage === "CONFIRM") {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-ink font-heading text-xl mb-6">Confirm Send</Text>
        <View className="bg-surface rounded-2xl p-5 w-full mb-6">
          <View className="flex-row justify-between mb-3">
            <Text className="text-ink-muted">To</Text>
            <Text className="text-ink font-mono">{sendData.recipientPhone}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-ink-muted">Amount</Text>
            <Text className="text-ink font-mono">
              R {(sendData.amount / 100).toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-ink-muted">Fee</Text>
            <Text className="text-ink font-mono">
              R {(sendData.senderFee / 100).toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between border-t border-surface-2 pt-3">
            <Text className="text-ink-muted">Total Deducted</Text>
            <Text className="text-gold font-mono font-bold">
              R {((sendData.amount + sendData.senderFee) / 100).toFixed(2)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={confirm}
          disabled={loading}
          className="w-full bg-gold rounded-xl py-4 items-center mb-3"
        >
          <Text className="text-bg font-heading text-base">Confirm Send</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={reset}>
          <Text className="text-ink-muted text-sm underline">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // FORM
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="items-center justify-center px-8 py-14"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-ink font-heading text-xl mb-2">Send Money</Text>
      <Text className="text-ink-muted text-sm mb-8">
        Recipient collects cash at any PayDuka merchant
      </Text>

      <TextInput
        placeholder="Recipient phone (e.g. 0812345678)"
        placeholderTextColor="#A09880"
        value={recipientPhone}
        onChangeText={setRecipientPhone}
        keyboardType="phone-pad"
        className="w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 text-ink text-base mb-4"
      />

      <View className="flex-row items-center w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 mb-2">
        <Text className="text-ink-muted text-base mr-2">R</Text>
        <TextInput
          placeholder="0.00"
          placeholderTextColor="#A09880"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          className="flex-1 text-ink font-mono text-lg"
        />
      </View>

      <Text className="text-ink-muted text-xs mb-6 self-end">
        Balance: R {(balance / 100).toFixed(2)}
      </Text>

      <TouchableOpacity
        onPress={initiate}
        disabled={
          loading ||
          !recipientPhone.trim() ||
          !amount ||
          parseFloat(amount) <= 0
        }
        className={`w-full rounded-xl py-4 items-center ${
          recipientPhone.trim() && amount && parseFloat(amount) > 0
            ? "bg-gold"
            : "bg-surface-2"
        }`}
      >
        {loading ? (
          <ActivityIndicator color="#0A0A08" />
        ) : (
          <Text
            className={`font-heading text-base ${
              recipientPhone.trim() && amount && parseFloat(amount) > 0
                ? "text-bg"
                : "text-ink-muted"
            }`}
          >
            Continue
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
