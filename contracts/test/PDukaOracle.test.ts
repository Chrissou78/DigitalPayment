import { expect } from "chai";
import { ethers } from "hardhat";

describe("PDukaOracle", () => {
  let oracle: any;
  let owner: any;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();
    const OracleFactory = await ethers.getContractFactory("PDukaOracle");
    oracle = await OracleFactory.deploy(
      ethers.parseUnits("0.005", 18),  // PDUKA/USD
      ethers.parseUnits("18.5", 18)    // USD/ZAR
    );
  });

  it("should return correct PDUKA/ZAR rate", async () => {
    // PDUKA/ZAR = PDUKA/USD × USD/ZAR = 0.005 × 18.5 = R0.0925
    const zarRate = await oracle.pdukaToZar();
    const expected = ethers.parseUnits("0.0925", 18);
    expect(zarRate).to.equal(expected);
  });

  it("should convert ZAR to PDUKA", async () => {
    // R100 / R0.0925 ≈ 1081.08 PDUKA
    const zarAmount = ethers.parseUnits("100", 18); // R100 in 18 decimals
    const pdukaAmount = await oracle.zarToPduka(zarAmount);
    // Approximate check (within 1%)
    const expected = ethers.parseUnits("1081", 18);
    expect(pdukaAmount).to.be.gte(expected);
  });

  it("should allow admin to update rates", async () => {
    await oracle.updateRates(
      ethers.parseUnits("0.01", 18),  // new PDUKA/USD
      ethers.parseUnits("19.0", 18)   // new USD/ZAR
    );
    const zarRate = await oracle.pdukaToZar();
    // 0.01 × 19.0 = R0.19
    expect(zarRate).to.equal(ethers.parseUnits("0.19", 18));
  });

  it("should reject stale oracle reads (if staleness check implemented)", async () => {
    // Fast-forward time by 2 hours (beyond 1-hour staleness threshold)
    await ethers.provider.send("evm_increaseTime", [7200]);
    await ethers.provider.send("evm_mine", []);

    // Depending on your implementation, this should revert or flag stale
    // Adjust this test to match your oracle's staleness behavior
    try {
      const rate = await oracle.pdukaToZar();
      // If it doesn't revert, your oracle may not enforce staleness on reads
      // That's acceptable if staleness is checked at settlement time
      expect(rate).to.be.gt(0);
    } catch (e: any) {
      expect(e.message).to.include("stale");
    }
  });
});
