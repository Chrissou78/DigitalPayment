import { create } from "zustand";
import * as SecureStore from "@/lib/secure-store";
import * as LocalAuth from "expo-local-authentication";
import { post } from "@/lib/api";

interface Customer {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  kycTier: number;
}

interface AuthState {
  accessToken: string | null;
  customer: Customer | null;
  biometricEnabled: boolean;
  isLoading: boolean;

  register: (phone: string, pin: string, firstName: string, lastName: string) => Promise<void>;
  login: (phone: string, pin: string) => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => void;
  logout: () => void;
  restoreSession: () => Promise<boolean>;
}

const TOKEN_KEY = "pduka_cust_token";
const CUSTOMER_KEY = "pduka_cust_data";
const BIO_KEY = "pduka_cust_bio";

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  customer: null,
  biometricEnabled: false,
  isLoading: true,

  register: async (phone, pin, firstName, lastName) => {
    const res = await post<{ access_token: string; customer: Customer }>(
      "/customers/register",
      { phone, pin, firstName, lastName }
    );
    await SecureStore.setItem(TOKEN_KEY, res.access_token);
    await SecureStore.setItem(CUSTOMER_KEY, JSON.stringify(res.customer));
    set({ accessToken: res.access_token, customer: res.customer });
  },

  login: async (phone, pin) => {
    const res = await post<{ access_token: string; customer: Customer }>(
      "/customers/login",
      { phone, pin }
    );
    await SecureStore.setItem(TOKEN_KEY, res.access_token);
    await SecureStore.setItem(CUSTOMER_KEY, JSON.stringify(res.customer));
    set({ accessToken: res.access_token, customer: res.customer });
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

    const token = await SecureStore.getItem(TOKEN_KEY);
    const custJson = await SecureStore.getItem(CUSTOMER_KEY);
    if (!token || !custJson) return false;

    const customer = JSON.parse(custJson) as Customer;
    set({ accessToken: token, customer, biometricEnabled: true });
    return true;
  },

  enableBiometric: async () => {
    const compatible = await LocalAuth.hasHardwareAsync();
    const enrolled = await LocalAuth.isEnrolledAsync();
    if (!compatible || !enrolled) throw new Error("Biometric not available.");

    const result = await LocalAuth.authenticateAsync({
      promptMessage: "Enable fingerprint login",
      cancelLabel: "Cancel",
    });
    if (!result.success) throw new Error("Cancelled.");

    await SecureStore.setItem(BIO_KEY, "true");
    set({ biometricEnabled: true });
  },

  disableBiometric: () => {
    SecureStore.deleteItem(BIO_KEY);
    set({ biometricEnabled: false });
  },

  logout: () => {
    SecureStore.deleteItem(TOKEN_KEY);
    SecureStore.deleteItem(CUSTOMER_KEY);
    set({ accessToken: null, customer: null });
  },

  restoreSession: async () => {
    const bioFlag = await SecureStore.getItem(BIO_KEY);
    const token = await SecureStore.getItem(TOKEN_KEY);
    set({ biometricEnabled: bioFlag === "true", isLoading: false });
    return bioFlag === "true" && !!token;
  },
}));
