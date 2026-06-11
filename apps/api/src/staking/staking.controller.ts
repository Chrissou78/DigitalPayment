// apps/api/src/staking/staking.controller.ts
import { Controller } from "@nestjs/common";
import { StakingService } from "./staking.service";

@Controller("staking")
export class StakingController {
  constructor(private readonly stakingService: StakingService) {}
}
