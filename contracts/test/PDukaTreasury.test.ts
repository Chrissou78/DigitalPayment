import { expect } from "chai";
import { ethers } from "hardhat";

describe("PDukaTreasury", () => {
  let token: any, oracle: any, treasury: any;
  let owner: any, vault1: any, vault2: any, vault3: any;

  beforeEach(async () => {
    [owner, vault1, vault2, vault3] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("PDukaToken");
    token = await TokenFactory.deploy();

    const OracleFactory = await ethers.getContractFactory("PDukaOracle");
    oracle = await OracleFactory.deploy(
      ethers.parseUnits("0.005", 18),
      ethers.parseUnits("18.5", 18)
    );

    const TreasuryFactory = await ethers.getContractFactory("PDukaTreasury");
    treasury = await TreasuryFactory.deploy(
      await token.getAddress(),
      await oracle.getAddress()
    );

    // Add vault wallets
    await treasury.addVault(vault1.address);
    await treasury.addVault(vault2.address);
    await treasury.addVault(vault3.address);
  });

  it("should have 3 vaults", async () => {
    expect(await treasury.vaultCount()).to.equal(3);
  });

  it("should route incoming funds to first vault with capacity", async () => {
    const amount = ethers.parseEther("500000"); // well under $100K at $0.005
    await token.approve(await treasury.getAddress(), amount);
    await treasury.receiveFunds(amount);

    // Vault 1 should have the allocation
    const v1Balance = await treasury.vaultBalance(0);
    expect(v1Balance).to.equal(amount);
  });

  it("should overflow to next vault when $100K cap reached", async () => {
    // $100K at $0.005/token = 20,000,000 tokens
    const capTokens = ethers.parseEther("20000000");
    const extra = ethers.parseEther("5000000");
    const total = capTokens + extra;

    await token.approve(await treasury.getAddress(), total);
    await treasury.receiveFunds(total);

    // Vault 1 should be at cap, vault 2 should have the overflow
    const v1Balance = await treasury.vaultBalance(0);
    const v2Balance = await treasury.vaultBalance(1);
    expect(v1Balance).to.equal(capTokens);
    expect(v2Balance).to.equal(extra);
  });
});
