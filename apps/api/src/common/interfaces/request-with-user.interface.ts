import { Request } from 'express';
import { Role } from '../enums/role.enum';

export interface JwtPayload {
  sub: string;
  merchantId?: string;
  role: Role;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
