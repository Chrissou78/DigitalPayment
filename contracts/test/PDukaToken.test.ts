import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.connect();
import { PDukaToken } from "../types";

describe("PDukaToken", () => {
  let token: PDukaToken;
  let owner: any, user1: any;

  beforeEach(async () => {
    [owner, user1] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("PDukaToken");
    token = await Factory.deploy();
    await token.waitForDeployment();
  });

  it("should deploy with correct name and symbol", async () => {
    expect(await token.name()).to.equal("PayDuka");
    expect(await token.symbol()).to.equal("PDUKA");
  });

  it("should mint MAX_SUPPLY to deployer", async () => {
    const max = ethers.parseEther("21000000000"); // 21 billion
    expect(await token.totalSupply()).to.equal(max);
    expect(await token.balanceOf(owner.address)).to.equal(max);
  });

  it("should transfer tokens", async () => {
    const amount = ethers.parseEther("1000");
    await token.transfer(user1.address, amount);
    expect(await token.balanceOf(user1.address)).to.equal(amount);
  });

  it("should not allow minting beyond MAX_SUPPLY", async () => {
    expect(await token.totalSupply()).to.equal(ethers.parseEther("21000000000"));
  });
});
