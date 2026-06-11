import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "@/stores/auth";
import { ws } from "@/lib/ws";
import { useEffect } from "react";

type Stage = "AMOUNT" | "QR" | "SUCCESS";

export default function ChargeScreen() {
  const merchantId = useAuthStore((s) => s.merchantId);
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>("AMOUNT");
  const [qrPayload, setQrPayload] = useState("");
  const [txnResult, setTxnResult] = useState<any>(null);

  const generateQR = () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (isNaN(cents) || cents <= 0) return;

    const payload = JSON.stringify({
      merchantId,
      amount: cents,
      currency: "ZAR",
      ts: Date.now(),
      nonce: Math.random().toString(36).slice(2, 10),
    });

    setQrPayload(payload);
    setStage("QR");
  };

  // Listen for payment confirmation
  useEffect(() => {
    if (stage !== "QR") return;
    const unsub = ws.subscribe((event, data: any) => {
      if (event === "txn.completed" && data.transaction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTxnResult(data.transaction);
        setStage("SUCCESS");
      }
    });
    return () => {
      unsub();
    };
  }, [stage]);

  const reset = () => {
    setAmount("");
    setStage("AMOUNT");
    setQrPayload("");
    setTxnResult(null);
  };

  if (stage === "SUCCESS") {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <View className="bg-green/10 rounded-full w-20 h-20 items-center justify-center mb-6">
          <Text className="text-green text-4xl">✓</Text>
        </View>
        <Text className="text-green font-heading text-2xl mb-2">
          Payment Received
        </Text>
        <Text className="text-ink font-mono text-3xl mb-1">
          R {(txnResult.amount / 100).toFixed(2)}
        </Text>
        <Text className="text-ink-muted text-sm mb-8">
          Fee: R {(txnResult.fee / 100).toFixed(2)} · {txnResult.id.slice(0, 8)}
        </Text>
        <TouchableOpacity
          onPress={reset}
          className="bg-gold rounded-xl px-10 py-4"
        >
          <Text className="text-bg font-heading text-base">New Charge</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (stage === "QR") {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-ink font-heading text-xl mb-2">
          Scan to Pay
        </Text>
        <Text className="text-gold font-mono text-3xl mb-8">
          R {parseFloat(amount).toFixed(2)}
        </Text>
        <View className="bg-white p-4 rounded-2xl mb-8">
          <QRCode
            value={qrPayload}
            size={220}
            backgroundColor="#FFFFFF"
            color="#0A0A08"
          />
        </View>
        <Text className="text-ink-muted text-sm mb-6">
          Waiting for customer payment...
        </Text>
        <ActivityIndicator color="#C8A85C" />
        <TouchableOpacity onPress={reset} className="mt-8">
          <Text className="text-ink-muted text-sm underline">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // AMOUNT stage
  return (
    <View className="flex-1 bg-bg items-center justify-center px-8">
      <Text className="text-ink font-heading text-xl mb-8">
        Charge Amount
      </Text>

      <View className="flex-row items-baseline mb-8">
        <Text className="text-ink-muted text-2xl mr-2">R</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor="#A09880"
          className="text-ink font-mono text-5xl text-center min-w-[200px]"
          autoFocus
        />
      </View>

      <TouchableOpacity
        onPress={generateQR}
        disabled={!amount || parseFloat(amount) <= 0}
        className={`w-full rounded-xl py-4 items-center ${
          amount && parseFloat(amount) > 0 ? "bg-gold" : "bg-surface-2"
        }`}
      >
        <Text
          className={`font-heading text-base ${
            amount && parseFloat(amount) > 0 ? "text-bg" : "text-ink-muted"
          }`}
        >
          Generate QR Code
        </Text>
      </TouchableOpacity>
    </View>
  );
}
