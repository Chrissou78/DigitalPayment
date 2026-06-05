import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuthStore } from "@/stores/auth";
import { useWalletStore } from "@/stores/wallet";
import { get as apiGet, post } from "@/lib/api";

type Screen = "MENU" | "ADVANCE" | "HISTORY" | "SETTINGS";

export default function MoreScreen() {
  const [screen, setScreen] = useState<Screen>("MENU");
  const { merchantId, merchantName, biometricEnabled, enableBiometric, disableBiometric, logout } =
    useAuthStore();
  const { balanceAvailable } = useWalletStore();

  // Advance state
  const [advanceData, setAdvanceData] = useState<any>(null);
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [advanceResult, setAdvanceResult] = useState<any>(null);

  const checkAdvance = async () => {
    setAdvanceLoading(true);
    try {
      const data = await apiGet<any>(`/transactions/latest/advance`);
      setAdvanceData(data);
    } catch (e: any) {
      Alert.alert("Error", e?.data?.message ?? "Could not check eligibility.");
    } finally {
      setAdvanceLoading(false);
    }
  };

  const requestAdvance = async (txnId: string) => {
    setAdvanceLoading(true);
    try {
      const data = await post<any>(`/transactions/${txnId}/advance`, {});
      setAdvanceResult(data);
    } catch (e: any) {
      Alert.alert("Error", e?.data?.message ?? "Advance request failed.");
    } finally {
      setAdvanceLoading(false);
    }
  };

  const handleBioToggle = async (value: boolean) => {
    try {
      if (value) {
        await enableBiometric();
      } else {
        disableBiometric();
      }
    } catch (e: any) {
      Alert.alert("Biometric Error", e.message);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  // ── ADVANCE SCREEN ──
  if (screen === "ADVANCE") {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerClassName="px-5 pt-14 pb-8">
        <TouchableOpacity onPress={() => setScreen("MENU")} className="mb-4">
          <Text className="text-gold text-sm">← Back</Text>
        </TouchableOpacity>
        <Text className="text-ink font-heading text-xl mb-6">Card Advance</Text>

        {advanceResult ? (
          <View className="bg-surface rounded-2xl p-5 items-center">
            <Text className="text-green font-heading text-2xl mb-2">Advance Credited</Text>
            <Text className="text-ink font-mono text-3xl mb-1">
              R {(advanceResult.advanceAmount / 100).toFixed(2)}
            </Text>
            <Text className="text-ink-muted text-sm">
              Fee: R {(advanceResult.advanceFee / 100).toFixed(2)}
            </Text>
          </View>
        ) : advanceData ? (
          <View className="bg-surface rounded-2xl p-5">
            <View className="flex-row justify-between mb-3">
              <Text className="text-ink-muted">Eligible</Text>
              <Text className={advanceData.eligible ? "text-green" : "text-red"}>
                {advanceData.eligible ? "Yes" : "No"}
              </Text>
            </View>
            {advanceData.eligible && (
              <>
                <View className="flex-row justify-between mb-3">
                  <Text className="text-ink-muted">Advance Amount</Text>
                  <Text className="text-ink font-mono">
                    R {(advanceData.advanceAmount / 100).toFixed(2)}
                  </Text>
                </View>
                <View className="flex-row justify-between mb-6">
                  <Text className="text-ink-muted">Fee (1.5%)</Text>
                  <Text className="text-ink font-mono">
                    R {(advanceData.advanceFee / 100).toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => requestAdvance(advanceData.txnId)}
                  disabled={advanceLoading}
                  className="bg-gold rounded-xl py-4 items-center"
                >
                  {advanceLoading ? (
                    <ActivityIndicator color="#0A0A08" />
                  ) : (
                    <Text className="text-bg font-heading text-base">
                      Request Advance
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <TouchableOpacity
            onPress={checkAdvance}
            disabled={advanceLoading}
            className="bg-gold rounded-xl py-4 items-center"
          >
            {advanceLoading ? (
              <ActivityIndicator color="#0A0A08" />
            ) : (
              <Text className="text-bg font-heading text-base">
                Check Eligibility
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  // ── SETTINGS SCREEN ──
  if (screen === "SETTINGS") {
    return (
      <ScrollView className="flex-1 bg-bg" contentContainerClassName="px-5 pt-14 pb-8">
        <TouchableOpacity onPress={() => setScreen("MENU")} className="mb-4">
          <Text className="text-gold text-sm">← Back</Text>
        </TouchableOpacity>
        <Text className="text-ink font-heading text-xl mb-6">Settings</Text>

        <View className="bg-surface rounded-2xl p-5 mb-4">
          <Text className="text-ink font-heading text-base mb-1">{merchantName}</Text>
          <Text className="text-ink-muted text-sm">ID: {merchantId}</Text>
        </View>

        <View className="bg-surface rounded-2xl p-5 mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-ink text-base">Biometric Login</Text>
              <Text className="text-ink-muted text-xs">
                Use fingerprint or face to unlock
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBioToggle}
              trackColor={{ false: "#1E1E18", true: "#C8A85C" }}
              thumbColor="#F5F0E8"
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          className="bg-red/10 border border-red/30 rounded-2xl py-4 items-center"
        >
          <Text className="text-red font-heading text-base">Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── MENU ──
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="px-5 pt-14 pb-8">
      <Text className="text-ink font-heading text-xl mb-6">More</Text>

      <MenuItem
        label="Card Advance"
        desc="Get instant advance on card transactions"
        onPress={() => {
          setScreen("ADVANCE");
          setAdvanceData(null);
          setAdvanceResult(null);
        }}
      />
      <MenuItem
        label="Transaction History"
        desc="Full transaction log with filters"
        onPress={() => setScreen("HISTORY")}
      />
      <MenuItem
        label="Settings"
        desc="Biometrics, profile, logout"
        onPress={() => setScreen("SETTINGS")}
      />
    </ScrollView>
  );
}

function MenuItem({
  label,
  desc,
  onPress,
}: {
  label: string;
  desc: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface rounded-2xl p-5 mb-3 flex-row items-center justify-between"
    >
      <View>
        <Text className="text-ink font-heading text-base">{label}</Text>
        <Text className="text-ink-muted text-xs">{desc}</Text>
      </View>
      <Text className="text-gold text-lg">›</Text>
    </TouchableOpacity>
  );
}
