import {
  Controller, Post, Get, Body, Param, UseGuards, Req,
} from '@nestjs/common';
import { RemittanceService } from './remittance.service';
import { CreateRemittanceDto } from './dto/create-remittance.dto';
import { CollectRemittanceDto } from './dto/collect-remittance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@payduka/shared';
import { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('remittance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MERCHANT, Role.AGENT)
export class RemittanceController {
  constructor(private readonly remittanceService: RemittanceService) {}

  @Post('send')
  async send(@Body() dto: CreateRemittanceDto, @Req() req: RequestWithUser) {
    return this.remittanceService.send(
      req.user.merchantId,
      req.user.walletId,
      dto,
    );
  }

  @Post('collect')
  async collect(@Body() dto: CollectRemittanceDto, @Req() req: RequestWithUser) {
    return this.remittanceService.collect(
      req.user.merchantId,
      req.user.walletId,
      dto,
    );
  }

  @Get('track/:code')
  async track(@Param('code') code: string) {
    const r = await this.remittanceService.findByCollectionCode(code);
    return {
      status: r.status,
      amount: r.amount - r.senderFee,
      expiresAt: r.expiresAt,
      collectedAt: r.collectedAt,
    };
  }
}
