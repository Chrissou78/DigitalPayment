import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

@WebSocketGateway({ cors: true, path: "/ws" })
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("register")
  handleRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { merchantId: string },
  ) {
    client.join(`merchant:${payload.merchantId}`);
    this.logger.log(`Merchant ${payload.merchantId} registered for notifications`);
    return { event: "registered", data: { ok: true } };
  }

  sendToMerchant(merchantId: string, event: string, data: any) {
    this.server.to(`merchant:${merchantId}`).emit(event, data);
    this.logger.log(`Pushed ${event} to merchant ${merchantId}`);
  }
}
