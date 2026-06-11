import { useEffect, useState } from "react";
import { Slot, useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "@/stores/auth";
import { BiometricGate } from "@/components/BiometricGate";
import { PinLogin } from "@/components/PinLogin";
import { ws } from "@/lib/ws";
import { useWalletStore } from "@/stores/wallet";
import { useTransactionStore } from "@/stores/transactions";
import "../../global.css";

export default function RootLayout() {
  const {
    accessToken,
    merchantId,
    biometricEnabled,
    isLoading,
    restoreSession,
  } = useAuthStore();

  const [showBiometric, setShowBiometric] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [ready, setReady] = useState(false);

  // 1. Restore session on mount
  useEffect(() => {
    restoreSession().then((hasBio) => {
      if (hasBio) {
        setShowBiometric(true);
      } else {
        setShowPin(true);
      }
    });
  }, []);

  // 2. Once authenticated, connect WebSocket + fetch data
  useEffect(() => {
    if (accessToken && merchantId) {
      ws.connect(merchantId);
      useWalletStore.getState().fetch(merchantId);
      useTransactionStore.getState().fetch(merchantId);
      setReady(true);
      setShowBiometric(false);
      setShowPin(false);
    }
    return () => ws.disconnect();
  }, [accessToken, merchantId]);

  // 3. Listen for real-time events
  useEffect(() => {
    if (!accessToken) return;
    const unsub = ws.subscribe((event, data: any) => {
      if (event === "txn.completed" || event === "cashin.completed") {
        useTransactionStore.getState().prepend(data.transaction);
        useWalletStore.getState().setBalance(
          data.walletAvailable,
          data.walletReserved
        );
      }
    });
    return () => {
      unsub();
    };
  }, [accessToken]);

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color="#C8A85C" size="large" />
        <StatusBar style="light" />
      </View>
    );
  }

  // Biometric gate
  if (showBiometric && !ready) {
    return (
      <>
        <BiometricGate
          onSuccess={() => {}}
          onFallbackPin={() => {
            setShowBiometric(false);
            setShowPin(true);
          }}
        />
        <StatusBar style="light" />
      </>
    );
  }

  // PIN login
  if (showPin && !ready) {
    return (
      <>
        <PinLogin onSuccess={() => {}} />
        <StatusBar style="light" />
      </>
    );
  }

  // Main app
  return (
    <>
      <Slot />
      <StatusBar style="light" />
    </>
  );
}
