import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Haptics from "expo-haptics";
import { post, get as apiGet } from "@/lib/api";

type Tab = "SEND" | "COLLECT";
type Stage = "FORM" | "CONFIRM" | "SUCCESS";

export default function RemittanceScreen() {
  const [tab, setTab] = useState<Tab>("SEND");

  // Send state
  const [senderPhone, setSenderPhone] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendStage, setSendStage] = useState<Stage>("FORM");
  const [sendData, setSendData] = useState<any>(null);
  const [sendResult, setSendResult] = useState<any>(null);

  // Collect state
  const [trackingCode, setTrackingCode] = useState("");
  const [collectStage, setCollectStage] = useState<Stage>("FORM");
  const [collectData, setCollectData] = useState<any>(null);
  const [collectResult, setCollectResult] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  // ── SEND FLOW ──
  const initiateSend = async () => {
    const cents = Math.round(parseFloat(sendAmount) * 100);
    if (!senderPhone.trim() || !recipientPhone.trim() || isNaN(cents) || cents <= 0) return;
    setLoading(true);
    try {
      const data = await post<any>("/remittance/send", {
        senderPhone: senderPhone.trim(),
        recipientPhone: recipientPhone.trim(),
        amount: cents,
      });
      setSendData(data);
      setSendStage("CONFIRM");
    } catch (e: any) {
      Alert.alert("Error", e?.data?.message ?? "Failed to create remittance.");
    } finally {
      setLoading(false);
    }
  };

  const confirmSend = async () => {
    setLoading(true);
    try {
      // The send endpoint already creates the remittance;
      // this "confirm" means the merchant collected the cash
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSendResult(sendData);
      setSendStage("SUCCESS");
    } catch (e: any) {
      Alert.alert("Error", "Confirmation failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── COLLECT FLOW ──
  const lookupRemittance = async () => {
    if (!trackingCode.trim()) return;
    setLoading(true);
    try {
      const data = await apiGet<any>(`/remittance/track/${trackingCode.trim()}`);
      setCollectData(data);
      setCollectStage("CONFIRM");
    } catch (e: any) {
      Alert.alert("Error", e?.data?.message ?? "Remittance not found.");
    } finally {
      setLoading(false);
    }
  };

  const confirmCollect = async () => {
    setLoading(true);
    try {
      const data = await post<any>("/remittance/collect", {
        trackingCode: trackingCode.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCollectResult(data);
      setCollectStage("SUCCESS");
    } catch (e: any) {
      Alert.alert("Error", e?.data?.message ?? "Collection failed.");
    } finally {
      setLoading(false);
    }
  };

  const resetSend = () => {
    setSenderPhone("");
    setRecipientPhone("");
    setSendAmount("");
    setSendStage("FORM");
    setSendData(null);
    setSendResult(null);
  };

  const resetCollect = () => {
    setTrackingCode("");
    setCollectStage("FORM");
    setCollectData(null);
    setCollectResult(null);
  };

  // ── TAB BAR ──
  const TabBar = () => (
    <View className="flex-row bg-surface rounded-xl p-1 mb-8">
      <TouchableOpacity
        onPress={() => { setTab("SEND"); resetSend(); }}
        className={`flex-1 py-3 rounded-lg items-center ${tab === "SEND" ? "bg-gold" : ""}`}
      >
        <Text className={`font-heading text-sm ${tab === "SEND" ? "text-bg" : "text-ink-muted"}`}>
          Send Money
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => { setTab("COLLECT"); resetCollect(); }}
        className={`flex-1 py-3 rounded-lg items-center ${tab === "COLLECT" ? "bg-gold" : ""}`}
      >
        <Text className={`font-heading text-sm ${tab === "COLLECT" ? "text-bg" : "text-ink-muted"}`}>
          Collect
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── SEND SUCCESS ──
  if (tab === "SEND" && sendStage === "SUCCESS") {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <View className="bg-green/10 rounded-full w-20 h-20 items-center justify-center mb-6">
          <Text className="text-green text-4xl">✓</Text>
        </View>
        <Text className="text-green font-heading text-2xl mb-2">Remittance Created</Text>
        <Text className="text-ink font-mono text-3xl mb-1">
          R {(sendResult.amount / 100).toFixed(2)}
        </Text>
        <View className="bg-surface rounded-xl px-6 py-3 my-4">
          <Text className="text-ink-muted text-xs text-center mb-1">Tracking Code</Text>
          <Text className="text-gold font-mono text-2xl text-center tracking-widest">
            {sendResult.trackingCode}
          </Text>
        </View>
        <Text className="text-ink-muted text-sm text-center mb-8">
          Share this code with the recipient to collect at any PayDuka merchant.
        </Text>
        <TouchableOpacity onPress={resetSend} className="bg-gold rounded-xl px-10 py-4">
          <Text className="text-bg font-heading text-base">New Remittance</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── COLLECT SUCCESS ──
  if (tab === "COLLECT" && collectStage === "SUCCESS") {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <View className="bg-green/10 rounded-full w-20 h-20 items-center justify-center mb-6">
          <Text className="text-green text-4xl">✓</Text>
        </View>
        <Text className="text-green font-heading text-2xl mb-2">Cash Paid Out</Text>
        <Text className="text-ink font-mono text-3xl mb-1">
          R {(collectResult.amount / 100).toFixed(2)}
        </Text>
        <Text className="text-ink-muted text-sm mb-2">
          Recipient: {collectResult.recipientPhone}
        </Text>
        <Text className="text-ink-muted text-sm mb-2">
          Your commission: R {(collectResult.merchantCommission / 100).toFixed(2)}
        </Text>
        <Text className="text-ink-muted text-xs mb-8">
          Ref: {collectResult.id?.slice(0, 8)}
        </Text>
        <TouchableOpacity onPress={resetCollect} className="bg-gold rounded-xl px-10 py-4">
          <Text className="text-bg font-heading text-base">Next Collection</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── SEND CONFIRM ──
  if (tab === "SEND" && sendStage === "CONFIRM") {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-ink font-heading text-xl mb-6">Confirm Remittance</Text>
        <View className="bg-surface rounded-2xl p-5 w-full mb-6">
          <View className="flex-row justify-between mb-3">
            <Text className="text-ink-muted">From</Text>
            <Text className="text-ink font-mono">{sendData.senderPhone}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-ink-muted">To</Text>
            <Text className="text-ink font-mono">{sendData.recipientPhone}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-ink-muted">Amount</Text>
            <Text className="text-ink font-mono">R {(sendData.amount / 100).toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-ink-muted">Sender Fee</Text>
            <Text className="text-ink font-mono">R {(sendData.senderFee / 100).toFixed(2)}</Text>
          </View>
        </View>
        <Text className="text-ink-muted text-sm text-center mb-6">
          Collect R {((sendData.amount + sendData.senderFee) / 100).toFixed(2)} cash from the sender.
        </Text>
        <TouchableOpacity
          onPress={confirmSend}
          disabled={loading}
          className="w-full bg-gold rounded-xl py-4 items-center mb-3"
        >
          {loading ? <ActivityIndicator color="#0A0A08" /> : (
            <Text className="text-bg font-heading text-base">Confirm — Cash Received</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={resetSend}>
          <Text className="text-ink-muted text-sm underline">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── COLLECT CONFIRM ──
  if (tab === "COLLECT" && collectStage === "CONFIRM") {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-ink font-heading text-xl mb-6">Pay Out Cash</Text>
        <View className="bg-surface rounded-2xl p-5 w-full mb-6">
          <View className="flex-row justify-between mb-3">
            <Text className="text-ink-muted">Recipient</Text>
            <Text className="text-ink font-mono">{collectData.recipientPhone}</Text>
          </View>
          <View className="flex-row justify-between mb-3">
            <Text className="text-ink-muted">Amount</Text>
            <Text className="text-ink font-mono">R {(collectData.amount / 100).toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-ink-muted">Your Commission</Text>
            <Text className="text-green font-mono">R {(collectData.merchantCommission / 100).toFixed(2)}</Text>
          </View>
        </View>
        <Text className="text-ink-muted text-sm text-center mb-6">
          Pay R {(collectData.amount / 100).toFixed(2)} cash to the recipient, then confirm.
        </Text>
        <TouchableOpacity
          onPress={confirmCollect}
          disabled={loading}
          className="w-full bg-gold rounded-xl py-4 items-center mb-3"
        >
          {loading ? <ActivityIndicator color="#0A0A08" /> : (
            <Text className="text-bg font-heading text-base">Confirm — Cash Paid Out</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={resetCollect}>
          <Text className="text-ink-muted text-sm underline">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── SEND FORM ──
  if (tab === "SEND") {
    return (
      <View className="flex-1 bg-bg px-8 pt-14">
        <Text className="text-ink font-heading text-xl mb-6">Remittance</Text>
        <TabBar />
        <TextInput
          placeholder="Sender Phone"
          placeholderTextColor="#A09880"
          value={senderPhone}
          onChangeText={setSenderPhone}
          keyboardType="phone-pad"
          className="w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 text-ink text-base mb-4"
        />
        <TextInput
          placeholder="Recipient Phone"
          placeholderTextColor="#A09880"
          value={recipientPhone}
          onChangeText={setRecipientPhone}
          keyboardType="phone-pad"
          className="w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 text-ink text-base mb-4"
        />
        <View className="flex-row items-center w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 mb-6">
          <Text className="text-ink-muted text-base mr-2">R</Text>
          <TextInput
            placeholder="0.00"
            placeholderTextColor="#A09880"
            value={sendAmount}
            onChangeText={setSendAmount}
            keyboardType="decimal-pad"
            className="flex-1 text-ink font-mono text-base"
          />
        </View>
        <TouchableOpacity
          onPress={initiateSend}
          disabled={loading || !senderPhone.trim() || !recipientPhone.trim() || !sendAmount || parseFloat(sendAmount) <= 0}
          className={`w-full rounded-xl py-4 items-center ${
            senderPhone.trim() && recipientPhone.trim() && sendAmount && parseFloat(sendAmount) > 0
              ? "bg-gold" : "bg-surface-2"
          }`}
        >
          {loading ? <ActivityIndicator color="#0A0A08" /> : (
            <Text className={`font-heading text-base ${
              senderPhone.trim() && recipientPhone.trim() && sendAmount && parseFloat(sendAmount) > 0
                ? "text-bg" : "text-ink-muted"
            }`}>
              Create Remittance
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ── COLLECT FORM ──
  return (
    <View className="flex-1 bg-bg px-8 pt-14">
      <Text className="text-ink font-heading text-xl mb-6">Remittance</Text>
      <TabBar />
      <TextInput
        placeholder="Tracking Code (e.g. PD-A3F8K2)"
        placeholderTextColor="#A09880"
        value={trackingCode}
        onChangeText={setTrackingCode}
        autoCapitalize="characters"
        className="w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 text-ink font-mono text-lg tracking-widest text-center mb-6"
      />
      <TouchableOpacity
        onPress={lookupRemittance}
        disabled={loading || !trackingCode.trim()}
        className={`w-full rounded-xl py-4 items-center ${
          trackingCode.trim() ? "bg-gold" : "bg-surface-2"
        }`}
      >
        {loading ? <ActivityIndicator color="#0A0A08" /> : (
          <Text className={`font-heading text-base ${
            trackingCode.trim() ? "text-bg" : "text-ink-muted"
          }`}>
            Look Up
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
