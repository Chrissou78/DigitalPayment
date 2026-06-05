import { useState, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { post } from "@/lib/api";
import { useWalletStore } from "@/stores/wallet";

type Stage = "SCAN" | "CONFIRM" | "PROCESSING" | "SUCCESS";

export default function PayScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>("SCAN");
  const [scannedData, setScannedData] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const scannedRef = useRef(false);
  const balance = useWalletStore((s) => s.balance);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const parsed = JSON.parse(data);
      if (!parsed.merchantId || !parsed.amount) {
        Alert.alert("Invalid QR", "This QR code is not a PayDuka payment.");
        scannedRef.current = false;
        return;
      }
      setScannedData(parsed);
      setStage("CONFIRM");
    } catch {
      Alert.alert("Invalid QR", "Could not read QR code.");
      scannedRef.current = false;
    }
  };

  const confirmPay = async () => {
    setStage("PROCESSING");
    setLoading(true);
    try {
      const res = await post<any>("/transactions", {
        merchantId: scannedData.merchantId,
        amount: scannedData.amount,
        qrPayload: JSON.stringify(scannedData),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(res);
      setStage("SUCCESS");
    } catch (e: any) {
      Alert.alert("Payment Failed", e?.data?.message ?? "Something went wrong.");
      setStage("CONFIRM");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStage("SCAN");
    setScannedData(null);
    setResult(null);
    scannedRef.current = false;
  };

  // Permission
  if (!permission?.granted) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-ink font-heading text-xl mb-4">Camera Access</Text>
        <Text className="text-ink-muted text-sm text-center mb-6">
          PayDuka needs camera access to scan merchant QR codes.
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-gold rounded-xl px-8 py-4"
        >
          <Text className="text-bg font-heading text-base">Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // SUCCESS
  if (stage === "SUCCESS") {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <View className="bg-green/10 rounded-full w-24 h-24 items-center justify-center mb-6">
          <Text className="text-green text-5xl">✓</Text>
        </View>
        <Text className="text-green font-heading text-2xl mb-2">Payment Sent</Text>
        <Text className="text-ink font-mono text-4xl mb-2">
          R {(result.amount / 100).toFixed(2)}
        </Text>
        <Text className="text-ink-muted text-sm mb-1">
          Fee: R {(result.fee / 100).toFixed(2)}
        </Text>
        <Text className="text-ink-muted text-xs mb-8">
          Ref: {result.txnId?.slice(0, 8)}
        </Text>
        <TouchableOpacity onPress={reset} className="bg-gold rounded-xl px-10 py-4">
          <Text className="text-bg font-heading text-base">Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // PROCESSING
  if (stage === "PROCESSING") {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color="#C8A85C" size="large" />
        <Text className="text-ink-muted text-sm mt-4">Processing payment...</Text>
      </View>
    );
  }

  // CONFIRM
  if (stage === "CONFIRM" && scannedData) {
    const amount = scannedData.amount;
    const insufficient = balance < amount;

    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-ink font-heading text-xl mb-6">Confirm Payment</Text>

        <View className="bg-surface rounded-2xl p-6 w-full mb-6">
          <Text className="text-ink-muted text-xs text-center mb-1">Amount</Text>
          <Text className="text-gold font-mono text-4xl text-center mb-4">
            R {(amount / 100).toFixed(2)}
          </Text>
          <View className="flex-row justify-between mb-2">
            <Text className="text-ink-muted">Merchant</Text>
            <Text className="text-ink font-mono text-sm">
              {scannedData.merchantId.slice(0, 12)}...
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-ink-muted">Your balance</Text>
            <Text
              className={`font-mono text-sm ${insufficient ? "text-red" : "text-green"}`}
            >
              R {(balance / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {insufficient && (
          <Text className="text-red text-sm text-center mb-4">
            Insufficient balance. Top up via Cash-In or bank refill.
          </Text>
        )}

        <TouchableOpacity
          onPress={confirmPay}
          disabled={loading || insufficient}
          className={`w-full rounded-xl py-4 items-center mb-3 ${
            insufficient ? "bg-surface-2" : "bg-gold"
          }`}
        >
          <Text
            className={`font-heading text-base ${
              insufficient ? "text-ink-muted" : "text-bg"
            }`}
          >
            Pay R {(amount / 100).toFixed(2)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={reset}>
          <Text className="text-ink-muted text-sm underline">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // SCAN
  return (
    <View className="flex-1 bg-bg">
      <CameraView
        className="flex-1"
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleBarCodeScanned}
      >
        <View className="flex-1 items-center justify-center">
          {/* Scanner overlay */}
          <View className="w-64 h-64 border-2 border-gold rounded-3xl" />
          <Text className="text-ink text-sm mt-6">
            Point at merchant QR code
          </Text>
        </View>
      </CameraView>

      {/* Balance bar */}
      <View className="bg-surface px-5 py-3 flex-row justify-between items-center">
        <Text className="text-ink-muted text-sm">Balance</Text>
        <Text className="text-gold font-mono text-base">
          R {(balance / 100).toFixed(2)}
        </Text>
      </View>
    </View>
  );
}
