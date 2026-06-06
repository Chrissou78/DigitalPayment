import { IsUUID, IsBoolean } from "class-validator";

export class RequestAdvanceDto {
  @IsUUID()
  transactionId!: string;

  @IsBoolean()
  accept!: boolean;
}
