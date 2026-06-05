import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MerchantService } from '../merchant/merchant.service';
import { LoginDto } from './dto/login.dto';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly merchantService: MerchantService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const merchant = await this.merchantService.findByApiKey(dto.apiKey);
    if (!merchant) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.apiSecret, merchant.apiSecretHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload = {
      sub: merchant.id,
      merchantId: merchant.id,
      role: Role.MERCHANT,
    };

    return { accessToken: this.jwt.sign(payload) };
  }
}
