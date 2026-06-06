import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.connect();

async function expectRevert(p: Promise<any>) {
  try { await p; } catch { return; }
  throw new Error("Expected transaction to revert, but it succeeded");
}

describe("StakingPool", () => {
  let token: any, staking: any;
  let owner: any, staker1: any, staker2: any;

  beforeEach(async () => {
    [owner, staker1, staker2] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("PDukaToken");
    token = await TokenFactory.deploy();

    const StakingFactory = await ethers.getContractFactory("StakingPool");
    staking = await StakingFactory.deploy(await token.getAddress());

    await token.transfer(await staking.getAddress(), ethers.parseEther("4200000000"));
    await token.transfer(staker1.address, ethers.parseEther("100000"));
    await token.transfer(staker2.address, ethers.parseEther("100000"));
  });

  it("should allow staking", async () => {
    const amount = ethers.parseEther("10000");
    await token.connect(staker1).approve(await staking.getAddress(), amount);
    await staking.connect(staker1).stake(amount);
    expect(await staking.stakedBalance(staker1.address)).to.equal(amount);
  });

  it("should accumulate rewards over time", async () => {
    const amount = ethers.parseEther("10000");
    await token.connect(staker1).approve(await staking.getAddress(), amount);
    await staking.connect(staker1).stake(amount);

    await ethers.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const rewards = await staking.pendingRewards(staker1.address);
    expect(rewards).to.be.gte(ethers.parseEther("1100"));
    expect(rewards).to.be.lte(ethers.parseEther("1300"));
  });

  it("should allow unstaking", async () => {
    const amount = ethers.parseEther("10000");
    await token.connect(staker1).approve(await staking.getAddress(), amount);
    await staking.connect(staker1).stake(amount);
    await staking.connect(staker1).unstake(amount);
    expect(await staking.stakedBalance(staker1.address)).to.equal(0);
  });

  it("should allow claiming rewards", async () => {
    const amount = ethers.parseEther("10000");
    await token.connect(staker1).approve(await staking.getAddress(), amount);
    await staking.connect(staker1).stake(amount);

    await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine", []);

    const before = await token.balanceOf(staker1.address);
    await staking.connect(staker1).claimRewards();
    expect(await token.balanceOf(staker1.address)).to.be.gt(before);
  });

  it("should allow APY adjustment by admin", async () => {
    await staking.setApy(1500);
    expect(await staking.apyBps()).to.equal(1500);
  });

  it("should reject APY above 20%", async () => {
    await expectRevert(staking.setApy(2100));
  });
});
