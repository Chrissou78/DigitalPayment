import {
  Controller, Post, Get, Body, Param, UseGuards, Req,
} from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestWithUser } from '../common/interfaces/request-with-user.interface';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private readonly txnService: TransactionService) {}

  @Post()
  async create(@Body() dto: CreateTransactionDto, @Req() req: RequestWithUser) {
    // Enforce that merchant can only create transactions for themselves
    if (req.user.merchantId) {
      dto.merchantId = req.user.merchantId;
    }
    return this.txnService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.txnService.findById(id);
  }
}
