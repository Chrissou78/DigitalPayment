import {
  Controller, Post, Get, Param, Body, UseGuards, Req,
} from '@nestjs/common';
import { AdvanceService } from './advance.service';
import { RequestAdvanceDto } from './dto/request-advance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class AdvanceController {
  constructor(private readonly advanceService: AdvanceService) {}

  @Get(':txnId/advance')
  async checkEligibility(
    @Param('txnId') txnId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.advanceService.checkEligibility(req.user.merchantId, txnId);
  }

  @Post(':txnId/advance')
  async requestAdvance(
    @Param('txnId') txnId: string,
    @Body() dto: RequestAdvanceDto,
    @Req() req: RequestWithUser,
  ) {
    if (!dto.accept) return { message: 'Advance declined' };
    return this.advanceService.execute(req.user.merchantId, txnId);
  }
}
