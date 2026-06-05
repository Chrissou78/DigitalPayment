import { create } from "zustand";
import { get as apiGet } from "@/lib/api";

interface WalletState {
  balance: number; // cents
  currency: string;
  isLoading: boolean;
  fetch: () => Promise<void>;
  setBalance: (b: number) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  balance: 0,
  currency: "ZAR",
  isLoading: true,

  fetch: async () => {
    set({ isLoading: true });
    const data = await apiGet<{ available: number; currency: string }>(
      "/customers/me/wallet"
    );
    set({ balance: data.available, currency: data.currency, isLoading: false });
  },

  setBalance: (b) => set({ balance: b }),
}));
