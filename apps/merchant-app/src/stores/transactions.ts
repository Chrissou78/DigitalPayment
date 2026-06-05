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
  customerRef?: string;
}

interface TxnState {
  items: Transaction[];
  todayTotal: number;
  todayCount: number;
  isLoading: boolean;
  fetch: (merchantId: string) => Promise<void>;
  prepend: (txn: Transaction) => void;
}

export const useTransactionStore = create<TxnState>((set, get) => ({
  items: [],
  todayTotal: 0,
  todayCount: 0,
  isLoading: true,

  fetch: async (merchantId) => {
    set({ isLoading: true });
    const data = await apiGet<{
      transactions: Transaction[];
      todayTotal: number;
      todayCount: number;
    }>(`/transactions?merchantId=${merchantId}&limit=50`);
    set({
      items: data.transactions,
      todayTotal: data.todayTotal,
      todayCount: data.todayCount,
      isLoading: false,
    });
  },

  prepend: (txn) =>
    set((s) => ({
      items: [txn, ...s.items].slice(0, 100),
      todayTotal: s.todayTotal + txn.amount,
      todayCount: s.todayCount + 1,
    })),
}));
