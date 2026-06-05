import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import * as LocalAuth from "expo-local-authentication";
import { post } from "@/lib/api";

interface AuthState {
  accessToken: string | null;
  merchantId: string | null;
  merchantName: string | null;
  biometricEnabled: boolean;
  isLoading: boolean;

  // Actions
  login: (merchantId: string, pin: string) => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => void;
  logout: () => void;
  restoreSession: () => Promise<boolean>;
}

const TOKEN_KEY = "payduka_token";
const MERCHANT_KEY = "payduka_merchant_id";
const MERCHANT_NAME_KEY = "payduka_merchant_name";
const BIO_KEY = "payduka_biometric";

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  merchantId: null,
  merchantName: null,
  biometricEnabled: false,
  isLoading: true,

  login: async (merchantId, pin) => {
    const res = await post<{
      access_token: string;
      merchant: { id: string; businessName: string };
    }>("/auth/login", { merchantId, pin });

    await SecureStore.setItemAsync(TOKEN_KEY, res.access_token);
    await SecureStore.setItemAsync(MERCHANT_KEY, res.merchant.id);
    await SecureStore.setItemAsync(MERCHANT_NAME_KEY, res.merchant.businessName);

    set({
      accessToken: res.access_token,
      merchantId: res.merchant.id,
      merchantName: res.merchant.businessName,
    });
  },

  loginWithBiometric: async () => {
    const compatible = await LocalAuth.hasHardwareAsync();
    const enrolled = await LocalAuth.isEnrolledAsync();
    if (!compatible || !enrolled) return false;

    const result = await LocalAuth.authenticateAsync({
      promptMessage: "Unlock PayDuka",
      cancelLabel: "Use PIN",
      disableDeviceFallback: false,
    });

    if (!result.success) return false;

    // Retrieve stored token
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const merchantId = await SecureStore.getItemAsync(MERCHANT_KEY);
    const merchantName = await SecureStore.getItemAsync(MERCHANT_NAME_KEY);

    if (!token || !merchantId) return false;

    // TODO: validate token is still valid by calling GET /auth/me
    // For now, set it and let API calls fail if expired
    set({
      accessToken: token,
      merchantId,
      merchantName,
      biometricEnabled: true,
    });

    return true;
  },

  enableBiometric: async () => {
    const compatible = await LocalAuth.hasHardwareAsync();
    const enrolled = await LocalAuth.isEnrolledAsync();

    if (!compatible || !enrolled) {
      throw new Error("Biometric authentication not available on this device.");
    }

    const result = await LocalAuth.authenticateAsync({
      promptMessage: "Enable fingerprint login",
      cancelLabel: "Cancel",
    });

    if (!result.success) {
      throw new Error("Biometric enrolment cancelled.");
    }

    await SecureStore.setItemAsync(BIO_KEY, "true");
    set({ biometricEnabled: true });
  },

  disableBiometric: () => {
    SecureStore.deleteItemAsync(BIO_KEY);
    set({ biometricEnabled: false });
  },

  logout: () => {
    SecureStore.deleteItemAsync(TOKEN_KEY);
    SecureStore.deleteItemAsync(MERCHANT_KEY);
    SecureStore.deleteItemAsync(MERCHANT_NAME_KEY);
    set({
      accessToken: null,
      merchantId: null,
      merchantName: null,
    });
  },

  restoreSession: async () => {
    const bioFlag = await SecureStore.getItemAsync(BIO_KEY);
    const token = await SecureStore.getItemAsync(TOKEN_KEY);

    set({
      biometricEnabled: bioFlag === "true",
      isLoading: false,
    });

    // If biometric is enabled and we have a stored token, return true
    // so the app knows to show the biometric prompt
    return bioFlag === "true" && !!token;
  },
}));
