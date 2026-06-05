import { expect } from "chai";
import { ethers } from "hardhat";

describe("PDukaPool", () => {
  let token: any, pool: any, oracle: any, treasury: any;
  let owner: any, operator: any, settler: any, user1: any;

  beforeEach(async () => {
    [owner, operator, settler, user1] = await ethers.getSigners();

    // Deploy Token
    const TokenFactory = await ethers.getContractFactory("PDukaToken");
    token = await TokenFactory.deploy();

    // Deploy Oracle
    const OracleFactory = await ethers.getContractFactory("PDukaOracle");
    oracle = await OracleFactory.deploy(
      ethers.parseUnits("0.005", 18),   // PDUKA/USD = $0.005
      ethers.parseUnits("18.5", 18)     // USD/ZAR = R18.50
    );

    // Deploy Treasury
    const TreasuryFactory = await ethers.getContractFactory("PDukaTreasury");
    treasury = await TreasuryFactory.deploy(
      await token.getAddress(),
      await oracle.getAddress()
    );

    // Deploy Pool
    const PoolFactory = await ethers.getContractFactory("PDukaPool");
    pool = await PoolFactory.deploy(
      await token.getAddress(),
      await treasury.getAddress(),
      await oracle.getAddress()
    );

    // Fund pool with tokens
    const fundAmount = ethers.parseEther("1000000000"); // 1B
    await token.transfer(await pool.getAddress(), fundAmount);

    // Grant roles
    const SETTLER_ROLE = await pool.SETTLER_ROLE();
    await pool.grantRole(SETTLER_ROLE, settler.address);
  });

  it("should accept deposits", async () => {
    const depositAmount = ethers.parseEther("100000");
    await token.transfer(user1.address, depositAmount);
    await token.connect(user1).approve(await pool.getAddress(), depositAmount);
    await pool.connect(user1).deposit(depositAmount, "USER_DEPOSIT");

    expect(await token.balanceOf(await pool.getAddress())).to.be.gte(depositAmount);
  });

  it("should batch-settle with burn and treasury split", async () => {
    const totalVolume = ethers.parseEther("10000000"); // 10M tokens volume
    const burnAmount = totalVolume * 5n / 1000n;       // 0.5% burn
    const treasuryAmount = totalVolume * 20n / 1000n;   // 2% treasury

    const poolBalanceBefore = await token.balanceOf(await pool.getAddress());

    await pool.connect(settler).batchSettle(
      totalVolume,
      burnAmount,
      treasuryAmount,
      "BATCH_001"
    );

    const poolBalanceAfter = await token.balanceOf(await pool.getAddress());
    // Pool should have lost burn + treasury amounts
    expect(poolBalanceBefore - poolBalanceAfter).to.equal(burnAmount + treasuryAmount);
  });

  it("should reject batch-settle from non-settler", async () => {
    await expect(
      pool.connect(user1).batchSettle(
        ethers.parseEther("1000"),
        ethers.parseEther("5"),
        ethers.parseEther("20"),
        "BATCH_FAIL"
      )
    ).to.be.reverted;
  });

  it("should not allow duplicate batch IDs", async () => {
    const vol = ethers.parseEther("1000");
    await pool.connect(settler).batchSettle(vol, vol * 5n / 1000n, vol * 20n / 1000n, "DUP_001");
    await expect(
      pool.connect(settler).batchSettle(vol, vol * 5n / 1000n, vol * 20n / 1000n, "DUP_001")
    ).to.be.reverted;
  });
});
