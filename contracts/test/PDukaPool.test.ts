import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.connect();

async function expectRevert(p: Promise<any>) {
  try { await p; } catch { return; }
  throw new Error("Expected transaction to revert, but it succeeded");
}

describe("PDukaPool", () => {
  let token: any, pool: any, oracle: any, treasury: any;
  let owner: any, settler: any, user1: any;

  beforeEach(async () => {
    [owner, settler, user1] = await ethers.getSigners();

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

    const PoolFactory = await ethers.getContractFactory("PDukaPool");
    pool = await PoolFactory.deploy(
      await token.getAddress(),
      await treasury.getAddress(),
      await oracle.getAddress()
    );

    await token.transfer(await pool.getAddress(), ethers.parseEther("1000000000")); // 1B

    const SETTLER_ROLE = await pool.SETTLER_ROLE();
    await pool.grantRole(SETTLER_ROLE, settler.address);
  });

  it("should accept deposits", async () => {
    const depositAmount = ethers.parseEther("100000");
    await token.transfer(user1.address, depositAmount);
    await token.connect(user1).approve(await pool.getAddress(), depositAmount);
    await pool.connect(user1).deposit(depositAmount, ethers.encodeBytes32String("USER_DEPOSIT"));
    expect(await token.balanceOf(await pool.getAddress())).to.be.gte(depositAmount);
  });

  it("should batch-settle with burn and treasury split", async () => {
    const totalVolume = ethers.parseEther("10000000"); // 10M tokens volume
    const burnAmount = (totalVolume * 5n) / 1000n;     // 0.5%
    const treasuryAmount = (totalVolume * 20n) / 1000n; // 2%

    const before = await token.balanceOf(await pool.getAddress());
    await pool.connect(settler).batchSettle(
      totalVolume, burnAmount, treasuryAmount, ethers.encodeBytes32String("BATCH_001")
    );
    const after = await token.balanceOf(await pool.getAddress());

    expect(before - after).to.equal(burnAmount + treasuryAmount);
    expect(await pool.totalBurned()).to.equal(burnAmount);
  });

  it("should reject batch-settle from non-settler", async () => {
    await expectRevert(
      pool.connect(user1).batchSettle(
        ethers.parseEther("1000"),
        ethers.parseEther("5"),
        ethers.parseEther("20"),
        ethers.encodeBytes32String("BATCH_FAIL")
      )
    );
  });

  it("should not allow duplicate batch IDs", async () => {
    const id = ethers.encodeBytes32String("DUP_001");
    const vol = ethers.parseEther("1000");
    const burn = (vol * 5n) / 1000n;
    const treas = (vol * 20n) / 1000n;
    await pool.connect(settler).batchSettle(vol, burn, treas, id);
    await expectRevert(pool.connect(settler).batchSettle(vol, burn, treas, id));
  });
});
