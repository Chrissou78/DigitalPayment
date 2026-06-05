import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "dotenv/config";

const POLYGON_RPC = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
const AMOY_RPC = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const DEPLOYER_KEY = process.env.SETTLEMENT_PRIVATE_KEY || "0x" + "0".repeat(64);

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  paths: {
    sources: "src",
  },
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    amoy: {
      type: "http",
      chainType: "l1",
      url: AMOY_RPC,
      chainId: 80002,
      accounts: [DEPLOYER_KEY],
    },
    polygon: {
      type: "http",
      chainType: "l1",
      url: POLYGON_RPC,
      chainId: 137,
      accounts: [DEPLOYER_KEY],
    },
  },
});