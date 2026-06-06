// apps/api/src/common/types/express.d.ts

declare namespace Express {
  interface User {
    id: string;
    merchantId: string;
    role: string;
  }
}
