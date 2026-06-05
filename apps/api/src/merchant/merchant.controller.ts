import {
  Controller, Post, Get, Body, Param, UseGuards,
} from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('merchants')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Post()
  async create(@Body() dto: CreateMerchantDto) {
    return this.merchantService.create(dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  async findOne(@Param('id') id: string) {
    return this.merchantService.findById(id);
  }
}
