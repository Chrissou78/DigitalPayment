import { create } from "zustand";
import { get as apiGet } from "@/lib/api";

interface WalletState {
  balanceAvailable: number; // cents
  balanceReserved: number;
  currency: string;
  isLoading: boolean;
  fetch: (merchantId: string) => Promise<void>;
  setBalance: (available: number, reserved: number) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  balanceAvailable: 0,
  balanceReserved: 0,
  currency: "ZAR",
  isLoading: true,

  fetch: async (merchantId) => {
    set({ isLoading: true });
    const data = await apiGet<{
      available: number;
      reserved: number;
      currency: string;
    }>(`/merchants/${merchantId}/wallet`);
    set({
      balanceAvailable: data.available,
      balanceReserved: data.reserved,
      currency: data.currency,
      isLoading: false,
    });
  },

  setBalance: (available, reserved) =>
    set({ balanceAvailable: available, balanceReserved: reserved }),
}));
