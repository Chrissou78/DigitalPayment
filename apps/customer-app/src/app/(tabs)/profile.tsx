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
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "@/stores/auth";
import { post } from "@/lib/api";

type Screen = "MENU" | "KYC" | "REFILL_SETTINGS";

const KYC_TIER_LABELS: Record<number, { label: string; limit: string; color: string }> = {
  0: { label: "Tier 0 — Phone Only", limit: "R1,000/day", color: "text-ink-muted" },
  1: { label: "Tier 1 — Basic KYC", limit: "R5,000/day", color: "text-blue" },
  2: { label: "Tier 2 — Full KYC", limit: "R25,000/day", color: "text-green" },
};

export default function ProfileScreen() {
  const {
    customer,
    biometricEnabled,
    enableBiometric,
    disableBiometric,
    logout,
  } = useAuthStore();

  const [screen, setScreen] = useState<Screen>("MENU");
  const [kycLoading, setKycLoading] = useState(false);
  const [refillEnabled, setRefillEnabled] = useState(false);

  const tier = customer?.kycTier ?? 0;
  const tierInfo = KYC_TIER_LABELS[tier] ?? KYC_TIER_LABELS[0];

  const handleBioToggle = async (value: boolean) => {
    try {
      if (value) await enableBiometric();
      else disableBiometric();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: logout },
    ]);
  };

  // ── KYC UPGRADE ──
  const startKycUpgrade = async () => {
    if (tier >= 2) {
      Alert.alert("Already Verified", "You have the highest KYC tier.");
      return;
    }

    const nextTier = tier + 1;

    if (nextTier === 1) {
      // Basic KYC: just ID number (simplified)
      Alert.prompt?.(
        "Basic KYC",
        "Enter your SA ID number",
        async (idNumber: string) => {
          if (!idNumber?.trim()) return;
          setKycLoading(true);
          try {
            await post("/customers/me/kyc", {
              tier: 1,
              idNumber: idNumber.trim(),
            });
            Alert.alert("Success", "KYC upgraded to Tier 1. Limit: R5,000/day.");
          } catch (e: any) {
            Alert.alert("Error", e?.data?.message ?? "KYC upgrade failed.");
          } finally {
            setKycLoading(false);
          }
        }
      );
      // Fallback for Android (no Alert.prompt)
      return;
    }

    if (nextTier === 2) {
      // Full KYC: ID photo + selfie
      const idPhoto = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.7,
        allowsEditing: true,
      });
      if (idPhoto.canceled) return;

      const selfie = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.7,
        allowsEditing: true,
        cameraType: ImagePicker.CameraType.front,
      });
      if (selfie.canceled) return;

      setKycLoading(true);
      try {
        // In production, upload images first then send URIs
        await post("/customers/me/kyc", {
          tier: 2,
          idPhotoUri: idPhoto.assets[0].uri,
          selfieUri: selfie.assets[0].uri,
        });
        Alert.alert(
          "Submitted",
          "Your KYC documents are under review. This usually takes 1-2 hours."
        );
      } catch (e: any) {
        Alert.alert("Error", e?.data?.message ?? "KYC submission failed.");
      } finally {
        setKycLoading(false);
      }
    }
  };

  // ── REFILL SETTINGS ──
  if (screen === "REFILL_SETTINGS") {
    return (
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerClassName="px-5 pt-14 pb-8"
      >
        <TouchableOpacity onPress={() => setScreen("MENU")} className="mb-4">
          <Text className="text-gold text-sm">← Back</Text>
        </TouchableOpacity>
        <Text className="text-ink font-heading text-xl mb-6">Auto-Refill</Text>

        <View className="bg-surface rounded-2xl p-5 mb-4">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-ink text-base">Enable Auto-Refill</Text>
              <Text className="text-ink-muted text-xs">
                Automatically top up when balance is low
              </Text>
            </View>
            <Switch
              value={refillEnabled}
              onValueChange={setRefillEnabled}
              trackColor={{ false: "#1E1E18", true: "#C8A85C" }}
              thumbColor="#F5F0E8"
            />
          </View>

          {refillEnabled && (
            <>
              <View className="border-t border-surface-2 pt-4 mb-3">
                <Text className="text-ink-muted text-xs mb-1">
                  Refill when balance falls below
                </Text>
                <Text className="text-ink font-mono text-lg">R 500.00</Text>
              </View>
              <View className="mb-3">
                <Text className="text-ink-muted text-xs mb-1">Refill amount</Text>
                <Text className="text-ink font-mono text-lg">R 1,000.00</Text>
              </View>
              <View>
                <Text className="text-ink-muted text-xs mb-1">Fund source</Text>
                <Text className="text-ink text-sm">
                  Bank account via PayShap (Stitch)
                </Text>
              </View>
            </>
          )}
        </View>

        <Text className="text-ink-muted text-xs text-center">
          Auto-refill pulls funds from your linked bank account via PayShap.
          You can link your bank in the Stitch connection flow.
        </Text>
      </ScrollView>
    );
  }

  // ── MAIN MENU ──
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="px-5 pt-14 pb-8"
    >
      <Text className="text-ink font-heading text-xl mb-6">Profile</Text>

      {/* User Info Card */}
      <View className="bg-surface rounded-2xl p-5 mb-4">
        <Text className="text-ink font-heading text-lg mb-1">
          {customer?.firstName} {customer?.lastName}
        </Text>
        <Text className="text-ink-muted text-sm mb-3">{customer?.phone}</Text>
        <View className="flex-row items-center justify-between">
          <Text className={`text-sm font-heading ${tierInfo.color}`}>
            {tierInfo.label}
          </Text>
          <Text className="text-ink-muted text-xs">{tierInfo.limit}</Text>
        </View>
      </View>

      {/* KYC Upgrade */}
      {tier < 2 && (
        <TouchableOpacity
          onPress={startKycUpgrade}
          disabled={kycLoading}
          className="bg-blue/10 border border-blue/30 rounded-2xl p-5 mb-4 flex-row items-center justify-between"
        >
          <View>
            <Text className="text-blue font-heading text-base">
              Upgrade to Tier {tier + 1}
            </Text>
            <Text className="text-ink-muted text-xs">
              Increase your daily limit to{" "}
              {KYC_TIER_LABELS[tier + 1]?.limit ?? "more"}
            </Text>
          </View>
          {kycLoading ? (
            <ActivityIndicator color="#60A5FA" />
          ) : (
            <Text className="text-blue text-lg">›</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Menu Items */}
      <MenuItem
        label="Auto-Refill"
        desc="Set up automatic wallet top-ups"
        onPress={() => setScreen("REFILL_SETTINGS")}
      />

      {/* Biometric Toggle */}
      <View className="bg-surface rounded-2xl p-5 mb-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-ink text-base">Biometric Login</Text>
            <Text className="text-ink-muted text-xs">
              Fingerprint or face unlock
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

      {/* Logout */}
      <TouchableOpacity
        onPress={handleLogout}
        className="bg-red/10 border border-red/30 rounded-2xl py-4 items-center mt-4"
      >
        <Text className="text-red font-heading text-base">Logout</Text>
      </TouchableOpacity>

      {/* Version */}
      <Text className="text-ink-muted text-xs text-center mt-8">
        PayDuka v0.1.0 · Built for Africa
      </Text>
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
