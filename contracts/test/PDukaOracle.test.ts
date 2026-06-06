import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.connect();

describe("PDukaOracle", () => {
  let oracle: any;
  let owner: any;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();
    const OracleFactory = await ethers.getContractFactory("PDukaOracle");
    oracle = await OracleFactory.deploy(
      ethers.parseUnits("0.005", 18),
      ethers.parseUnits("18.5", 18)
    );
  });

  it("should return correct PDUKA/ZAR rate", async () => {
    const zarRate = await oracle.pdukaToZar();
    expect(zarRate).to.equal(ethers.parseUnits("0.0925", 18));
  });

  it("should convert ZAR to PDUKA", async () => {
    const zarAmount = ethers.parseUnits("100", 18);
    const pdukaAmount = await oracle.zarToPduka(zarAmount);
    expect(pdukaAmount).to.be.gte(ethers.parseUnits("1081", 18));
  });

  it("should allow admin to update rates", async () => {
    await oracle.updateRates(
      ethers.parseUnits("0.01", 18),
      ethers.parseUnits("19.0", 18)
    );
    expect(await oracle.pdukaToZar()).to.equal(ethers.parseUnits("0.19", 18));
  });

  it("should reject stale oracle reads", async () => {
    await ethers.provider.send("evm_increaseTime", [7200]);
    await ethers.provider.send("evm_mine", []);
    let reverted = false;
    try {
      await oracle.pdukaToZar();
    } catch (e: any) {
      reverted = true;
      expect(String(e.message).toLowerCase()).to.include("stale");
    }
    expect(reverted).to.equal(true);
  });
});
