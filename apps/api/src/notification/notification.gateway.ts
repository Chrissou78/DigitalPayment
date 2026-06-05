import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'ws';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ path: '/ws' })
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server: Server;

  // Map merchantId → socket
  private connections = new Map<string, Socket>();

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log('WebSocket client connected');
  }

  handleDisconnect(client: Socket) {
    // Remove from map
    for (const [key, sock] of this.connections.entries()) {
      if (sock === client) {
        this.connections.delete(key);
        this.logger.log(`Merchant ${key} disconnected`);
        break;
      }
    }
  }

  @SubscribeMessage('register')
  handleRegister(client: Socket, payload: { merchantId: string }) {
    this.connections.set(payload.merchantId, client);
    this.logger.log(`Merchant ${payload.merchantId} registered for notifications`);
    return { event: 'registered', data: { ok: true } };
  }

  sendToMerchant(merchantId: string, event: string, data: any) {
    const socket = this.connections.get(merchantId);
    if (socket && socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify({ event, data }));
      this.logger.log(`Pushed ${event} to merchant ${merchantId}`);
    }
  }
}
