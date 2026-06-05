import { expect } from "chai";
import { ethers } from "hardhat";

describe("StakingPool", () => {
  let token: any, staking: any;
  let owner: any, staker1: any, staker2: any;

  beforeEach(async () => {
    [owner, staker1, staker2] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("PDukaToken");
    token = await TokenFactory.deploy();

    const StakingFactory = await ethers.getContractFactory("StakingPool");
    staking = await StakingFactory.deploy(await token.getAddress());

    // Fund staking pool for rewards
    const rewardFund = ethers.parseEther("4200000000"); // 4.2B
    await token.transfer(await staking.getAddress(), rewardFund);

    // Give stakers some tokens
    const stakerFund = ethers.parseEther("100000");
    await token.transfer(staker1.address, stakerFund);
    await token.transfer(staker2.address, stakerFund);
  });

  it("should allow staking", async () => {
    const amount = ethers.parseEther("10000");
    await token.connect(staker1).approve(await staking.getAddress(), amount);
    await staking.connect(staker1).stake(amount);

    const staked = await staking.stakedBalance(staker1.address);
    expect(staked).to.equal(amount);
  });

  it("should accumulate rewards over time", async () => {
    const amount = ethers.parseEther("10000");
    await token.connect(staker1).approve(await staking.getAddress(), amount);
    await staking.connect(staker1).stake(amount);

    // Fast-forward 365 days
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const rewards = await staking.pendingRewards(staker1.address);
    // At 12% APY on 10,000 tokens ≈ 1,200 tokens
    const expectedMin = ethers.parseEther("1100"); // Allow some tolerance
    const expectedMax = ethers.parseEther("1300");
    expect(rewards).to.be.gte(expectedMin);
    expect(rewards).to.be.lte(expectedMax);
  });

  it("should allow unstaking", async () => {
    const amount = ethers.parseEther("10000");
    await token.connect(staker1).approve(await staking.getAddress(), amount);
    await staking.connect(staker1).stake(amount);
    await staking.connect(staker1).unstake(amount);

    const staked = await staking.stakedBalance(staker1.address);
    expect(staked).to.equal(0);
  });

  it("should allow claiming rewards", async () => {
    const amount = ethers.parseEther("10000");
    await token.connect(staker1).approve(await staking.getAddress(), amount);
    await staking.connect(staker1).stake(amount);

    await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]); // 30 days
    await ethers.provider.send("evm_mine", []);

    const balanceBefore = await token.balanceOf(staker1.address);
    await staking.connect(staker1).claimRewards();
    const balanceAfter = await token.balanceOf(staker1.address);

    expect(balanceAfter).to.be.gt(balanceBefore);
  });

  it("should allow APY adjustment by admin", async () => {
    await staking.setApy(1500); // 15%
    const apy = await staking.apyBps();
    expect(apy).to.equal(1500);
  });

  it("should reject APY above 20%", async () => {
    await expect(staking.setApy(2100)).to.be.reverted; // > 20%
  });
});
