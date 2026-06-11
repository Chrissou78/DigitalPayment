import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Slot } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "@/stores/auth";
import { BiometricGate } from "@/components/BiometricGate";
import { PinLogin } from "@/components/PinLogin";
import { RegisterScreen } from "@/components/RegisterScreen";
import { ws } from "@/lib/ws";
import { useWalletStore } from "@/stores/wallet";
import { useTransactionStore } from "@/stores/transactions";
import { useRemittanceStore } from "@/stores/remittance";

// Inject global styles on web
if (Platform.OS === "web" && typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    html, body, #root {
      height: 100%; margin: 0; padding: 0;
      background-color: #0A0A08;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  `;
  document.head.appendChild(style);
}

type AuthScreen = "LOADING" | "BIOMETRIC" | "PIN" | "REGISTER" | "READY";

export default function RootLayout() {
  const { accessToken, customer, isLoading, restoreSession } = useAuthStore();
  const [screen, setScreen] = useState<AuthScreen>("LOADING");

  useEffect(() => {
    restoreSession().then((hasBio) => {
      if (hasBio) setScreen("BIOMETRIC");
      else setScreen("PIN");
    });
  }, []);

  useEffect(() => {
    if (accessToken && customer) {
      ws.connect(customer.id);
      useWalletStore.getState().fetch();
      useTransactionStore.getState().fetch();
      useRemittanceStore.getState().fetch();
      setScreen("READY");
    }
    return () => { ws.disconnect(); };
  }, [accessToken, customer]);

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
    return () => { unsub(); };
  }, [accessToken]);

  const onAuthSuccess = () => {};

  if (screen === "LOADING" || isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#C8A85C" size="large" />
        <StatusBar style="light" />
      </View>
    );
  }

  if (screen === "BIOMETRIC") {
    return (
      <>
        <BiometricGate onSuccess={onAuthSuccess} onFallbackPin={() => setScreen("PIN")} />
        <StatusBar style="light" />
      </>
    );
  }

  if (screen === "REGISTER") {
    return (
      <>
        <RegisterScreen onSuccess={onAuthSuccess} onBackToLogin={() => setScreen("PIN")} />
        <StatusBar style="light" />
      </>
    );
  }

  if (screen === "PIN") {
    return (
      <>
        <PinLogin onSuccess={onAuthSuccess} onRegister={() => setScreen("REGISTER")} />
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

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#0A0A08",
    alignItems: "center",
    justifyContent: "center",
  },
});
