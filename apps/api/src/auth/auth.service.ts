import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { MerchantService } from "../merchant/merchant.service";
import { WalletService } from "../wallet/wallet.service";
import { AdminUser } from "../admin/entities/admin-user.entity";
import { LoginDto } from "./dto/login.dto";
import { AdminLoginDto } from "./dto/admin-login.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly merchantService: MerchantService,
    private readonly walletService: WalletService,
    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const merchant = await this.merchantService.findByApiKey(dto.apiKey);
    if (!merchant) throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(dto.apiSecret, merchant.apiSecretHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const wallet = await this.walletService.findByMerchantId(merchant.id);
    if (!wallet) throw new UnauthorizedException("Merchant wallet not initialized");

    const payload = {
      sub: merchant.id,
      merchantId: merchant.id,
      walletId: wallet.id,
      role: "merchant",
    };

    return { accessToken: this.jwt.sign(payload) };
  }

  async adminLogin(dto: AdminLoginDto): Promise<{ accessToken: string }> {
    const admin = await this.adminRepo.findOne({ where: { email: dto.email } });
    if (!admin) throw new UnauthorizedException("Invalid email or password");

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid email or password");

    if (!admin.isActive) throw new UnauthorizedException("Account disabled");

    // Update last login
    admin.lastLoginAt = new Date();
    await this.adminRepo.save(admin);

    const payload = {
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: "admin",
    };

    return { accessToken: this.jwt.sign(payload) };
  }
}
