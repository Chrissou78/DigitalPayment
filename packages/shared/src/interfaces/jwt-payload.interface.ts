import { Role } from '../enums/role.enum';

export interface JwtPayload {
  sub: string;
  merchantId?: string;
  walletId?: string;
  role: Role;
}
