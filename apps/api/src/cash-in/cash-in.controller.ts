import {
  Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { CashInService } from './cash-in.service';
import { CreateCashInDto } from './dto/create-cash-in.dto';
import { ConfirmCashInDto } from './dto/confirm-cash-in.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@payduka/shared';
import { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('cash-in')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MERCHANT, Role.AGENT)
export class CashInController {
  constructor(private readonly cashInService: CashInService) {}

  @Post()
  async initiate(@Body() dto: CreateCashInDto, @Req() req: RequestWithUser) {
    return this.cashInService.initiate(req.user.merchantId, dto);
  }

  @Post('confirm')
  async confirm(@Body() dto: ConfirmCashInDto) {
    return this.cashInService.confirm(dto.cashInId);
  }
}
