// apps/api/src/common/interfaces/request-with-user.interface.ts
import { Request } from "express";

export interface AuthUser {
  id: string;
  merchantId: string;
  role: string;
}

export interface RequestWithUser extends Request {
  user: AuthUser;
}
