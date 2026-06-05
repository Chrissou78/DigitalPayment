import Constants from "expo-constants";
import { useAuthStore } from "@/stores/auth";

const WS_URL = Constants.expoConfig?.extra?.wsBaseUrl ?? "ws://localhost:3000/ws";

type Listener = (event: string, data: unknown) => void;

class WsClient {
  private socket: WebSocket | null = null;
  private listeners: Set<Listener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private merchantId: string | null = null;

  connect(merchantId: string) {
    this.merchantId = merchantId;
    this.disconnect();

    const token = useAuthStore.getState().accessToken;
    this.socket = new WebSocket(`${WS_URL}?token=${token}`);

    this.socket.onopen = () => {
      this.socket?.send(
        JSON.stringify({ event: "register", data: { merchantId } })
      );
    };

    this.socket.onmessage = (msg) => {
      try {
        const { event, data } = JSON.parse(msg.data);
        this.listeners.forEach((fn) => fn(event, data));
      } catch {
        // ignore malformed messages
      }
    };

    this.socket.onclose = () => {
      this.reconnectTimer = setTimeout(() => {
        if (this.merchantId) this.connect(this.merchantId);
      }, 3000);
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const ws = new WsClient();
