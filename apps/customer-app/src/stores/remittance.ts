import { create } from "zustand";
import { get as apiGet } from "@/lib/api";

export interface Remittance {
  id: string;
  trackingCode: string;
  recipientPhone: string;
  amount: number;
  senderFee: number;
  status: string;
  createdAt: string;
  collectedAt?: string;
}

interface RemittanceState {
  sent: Remittance[];
  received: Remittance[];
  isLoading: boolean;
  fetch: () => Promise<void>;
  prependSent: (r: Remittance) => void;
}

export const useRemittanceStore = create<RemittanceState>((set) => ({
  sent: [],
  received: [],
  isLoading: true,

  fetch: async () => {
    set({ isLoading: true });
    const data = await apiGet<{ sent: Remittance[]; received: Remittance[] }>(
      "/customers/me/remittances"
    );
    set({ sent: data.sent, received: data.received, isLoading: false });
  },

  prependSent: (r) =>
    set((s) => ({ sent: [r, ...s.sent].slice(0, 100) })),
}));
