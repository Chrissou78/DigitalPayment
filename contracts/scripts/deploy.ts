import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1. PDuka Token
  const Token = await ethers.getContractFactory("PDukaToken");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("PDukaToken:", tokenAddr);

  // 2. Oracle (seed price $0.005, USD/ZAR ~18.50)
  const Oracle = await ethers.getContractFactory("PDukaOracle");
  const initialPdukaUsd = ethers.parseEther("0.005");
  const initialUsdZar = ethers.parseEther("18.5");
  const oracle = await Oracle.deploy(initialPdukaUsd, initialUsdZar);
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("PDukaOracle:", oracleAddr);

  // 3. Treasury
  const Treasury = await ethers.getContractFactory("PDukaTreasury");
  const treasury = await Treasury.deploy(tokenAddr, oracleAddr);
  await treasury.waitForDeployment();
  const treasuryAddr = await treasury.getAddress();
  console.log("PDukaTreasury:", treasuryAddr);

  // 4. Add 5 initial vault addresses (could be multisig or cold wallets)
  // In production these would be hardware wallet addresses
  const vaultAddresses = [
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
    "0x3333333333333333333333333333333333333333",
    "0x4444444444444444444444444444444444444444",
    "0x5555555555555555555555555555555555555555",
  ];
  for (const vault of vaultAddresses) {
    await treasury.addVault(vault);
    console.log("  Vault added:", vault);
  }

  // 5. Pool
  const Pool = await ethers.getContractFactory("PDukaPool");
  const pool = await Pool.deploy(tokenAddr, treasuryAddr, oracleAddr);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("PDukaPool:", poolAddr);

  // 6. Staking Pool
  const Staking = await ethers.getContractFactory("StakingPool");
  const staking = await Staking.deploy(tokenAddr);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log("StakingPool:", stakingAddr);

  // 7. Fund the pool (8.4B ecosystem + 3.15B liquidity = 11.55B)
  const poolFund = ethers.parseEther("11550000000");
  await token.approve(poolAddr, poolFund);
  await pool.deposit(poolFund, ethers.encodeBytes32String("INITIAL_POOL"));
  console.log("Pool funded: 11.55B PDUKA");

  // 8. Fund staking (4.2B yield reserve)
  const stakeFund = ethers.parseEther("4200000000");
  await token.transfer(stakingAddr, stakeFund);
  console.log("StakingPool funded: 4.2B PDUKA");

  // 9. Team/dev allocation held by deployer (3.15B vesting + 2.1B team = 5.25B)
  // Remaining in deployer wallet, locked by vesting schedule off-chain

  console.log("\n═══ Deployment Complete ═══");
  console.log("Token:    ", tokenAddr);
  console.log("Oracle:   ", oracleAddr);
  console.log("Treasury: ", treasuryAddr);
  console.log("Pool:     ", poolAddr);
  console.log("Staking:  ", stakingAddr);
  console.log("Vaults:   ", vaultAddresses.length);
  console.log("\nPDUKA/USD: $0.005");
  console.log("USD/ZAR:   R18.50");
  console.log("PDUKA/ZAR: R0.0925");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
