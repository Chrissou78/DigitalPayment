import { create } from "zustand";
import { get as apiGet } from "@/lib/api";

export interface Transaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  fee: number;
  currency: string;
  createdAt: string;
  merchantName?: string;
  description?: string;
}

interface TxnState {
  items: Transaction[];
  isLoading: boolean;
  fetch: () => Promise<void>;
  prepend: (txn: Transaction) => void;
}

export const useTransactionStore = create<TxnState>((set) => ({
  items: [],
  isLoading: true,

  fetch: async () => {
    set({ isLoading: true });
    const data = await apiGet<{ transactions: Transaction[] }>(
      "/customers/me/transactions?limit=50"
    );
    set({ items: data.transactions, isLoading: false });
  },

  prepend: (txn) =>
    set((s) => ({ items: [txn, ...s.items].slice(0, 200) })),
}));
