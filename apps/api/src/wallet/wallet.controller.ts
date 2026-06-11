// apps/api/src/wallet/wallet.controller.ts
import {
  Controller,
  Get,
  UseGuards,
  Req,
} from "@nestjs/common";
import { WalletService } from "./wallet.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RequestWithUser } from "../common/interfaces/request-with-user.interface";

@Controller("wallet")
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get("balance")
  async getBalance(@Req() req: RequestWithUser) {
    return this.walletService.getBalance(req.user.walletId);
  }
}
