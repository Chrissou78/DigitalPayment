import { useEffect, useState } from "react";
import { Slot } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "@/stores/auth";
import { BiometricGate } from "@/components/BiometricGate";
import { PinLogin } from "@/components/PinLogin";
import { RegisterScreen } from "@/components/RegisterScreen";
import { ws } from "@/lib/ws";
import { useWalletStore } from "@/stores/wallet";
import { useTransactionStore } from "@/stores/transactions";
import { useRemittanceStore } from "@/stores/remittance";
import "../../global.css";

type AuthScreen = "LOADING" | "BIOMETRIC" | "PIN" | "REGISTER" | "READY";

export default function RootLayout() {
  const { accessToken, customer, isLoading, restoreSession } = useAuthStore();
  const [screen, setScreen] = useState<AuthScreen>("LOADING");

  // 1. Restore session
  useEffect(() => {
    restoreSession().then((hasBio) => {
      if (hasBio) setScreen("BIOMETRIC");
      else setScreen("PIN");
    });
  }, []);

  // 2. Once authenticated, load data + connect WS
  useEffect(() => {
    if (accessToken && customer) {
      ws.connect(customer.id);
      useWalletStore.getState().fetch();
      useTransactionStore.getState().fetch();
      useRemittanceStore.getState().fetch();
      setScreen("READY");
    }
    return () => ws.disconnect();
  }, [accessToken, customer]);

  // 3. Real-time events
  useEffect(() => {
    if (!accessToken) return;
    const unsub = ws.subscribe((event, data: any) => {
      if (event === "txn.completed") {
        useTransactionStore.getState().prepend(data.transaction);
        useWalletStore.getState().setBalance(data.walletAvailable);
      }
      if (event === "cashin.completed") {
        useWalletStore.getState().setBalance(data.walletAvailable);
      }
      if (event === "remittance.created") {
        useRemittanceStore.getState().prependSent(data.remittance);
      }
      if (event === "refill.completed") {
        useWalletStore.getState().setBalance(data.walletAvailable);
      }
    });
    return unsub;
  }, [accessToken]);

  const onAuthSuccess = () => {}; // useEffect above handles the transition

  if (screen === "LOADING" || isLoading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color="#C8A85C" size="large" />
        <StatusBar style="light" />
      </View>
    );
  }

  if (screen === "BIOMETRIC") {
    return (
      <>
        <BiometricGate
          onSuccess={onAuthSuccess}
          onFallbackPin={() => setScreen("PIN")}
        />
        <StatusBar style="light" />
      </>
    );
  }

  if (screen === "REGISTER") {
    return (
      <>
        <RegisterScreen
          onSuccess={onAuthSuccess}
          onBackToLogin={() => setScreen("PIN")}
        />
        <StatusBar style="light" />
      </>
    );
  }

  if (screen === "PIN") {
    return (
      <>
        <PinLogin
          onSuccess={onAuthSuccess}
          onRegister={() => setScreen("REGISTER")}
        />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <>
      <Slot />
      <StatusBar style="light" />
    </>
  );
}
