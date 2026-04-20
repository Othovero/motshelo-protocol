import { ethers } from "hardhat";

/*
 * Deployment follows the 8-step sequence from the contract header.
 * Aave addresses are BSC mainnet — they work on a forked local node.
 * For BSC testnet (no Aave), replace with mock addresses or skip Aave features.
 */

const BSC_USDT = "0x55d398326f99059fF775485246999027b3197955";
const BSC_AAVE_POOL = "0x6807dc960D6d17351D069670733D59634f9c169B";
const BSC_AUSDT = "0xf6C6361958652d87e07b46187513575975a6c016";

const BSC_VRF_COORDINATOR = "0xc587d9053cd1118f25F645F9E08BB98c9712A4EE";
const BSC_VRF_KEY_HASH =
  "0x114f3da0a805b6a67d6e9cd2ec746f7028f1b7376365af575cfea3550dd1aa04";
const VRF_SUB_ID = parseInt(process.env.VRF_SUBSCRIPTION_ID || "0");

const NFT_BASE_URI = "https://motshelo.xyz/api/nft/";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB\n");

  // 1. Deploy FeeCollector (temp factory = deployer)
  console.log("1/7  Deploying FeeCollector...");
  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const feeCollector = await FeeCollector.deploy(deployer.address);
  await feeCollector.waitForDeployment();
  const fcAddr = await feeCollector.getAddress();
  console.log("     FeeCollector:", fcAddr);

  // 2. Deploy MotsheloFactory
  console.log("2/7  Deploying MotsheloFactory...");
  const Factory = await ethers.getContractFactory("MotsheloFactory");
  const factory = await Factory.deploy(
    fcAddr,
    ethers.ZeroAddress, // nft placeholder
    ethers.ZeroAddress, // registry placeholder
    BSC_VRF_COORDINATOR,
    BSC_VRF_KEY_HASH,
    VRF_SUB_ID,
    BSC_AAVE_POOL,
    BSC_AUSDT
  );
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("     Factory:", factoryAddr);

  // 3. FeeCollector.updateFactory(factory)
  console.log("3/7  Wiring FeeCollector -> Factory...");
  await (await feeCollector.updateFactory(factoryAddr)).wait();

  // 4. Deploy MotsheloRegistry
  console.log("4/7  Deploying MotsheloRegistry...");
  const Registry = await ethers.getContractFactory("MotsheloRegistry");
  const registry = await Registry.deploy(factoryAddr);
  await registry.waitForDeployment();
  const regAddr = await registry.getAddress();
  console.log("     Registry:", regAddr);

  // 5. Deploy MotsheloNFT
  console.log("5/7  Deploying MotsheloNFT...");
  const NFT = await ethers.getContractFactory("MotsheloNFT");
  const nft = await NFT.deploy(NFT_BASE_URI, factoryAddr);
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("     NFT:", nftAddr);

  // 6. Factory.updateDependencies
  console.log("6/7  Wiring Factory dependencies...");
  await (await factory.updateDependencies(fcAddr, nftAddr, regAddr)).wait();

  // 7. Factory.setApprovedToken(USDT, true)
  console.log("7/7  Approving USDT token...");
  await (await factory.setApprovedToken(BSC_USDT, true)).wait();

  console.log("\n========================================");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log(`  FeeCollector:  ${fcAddr}`);
  console.log(`  Factory:       ${factoryAddr}`);
  console.log(`  Registry:      ${regAddr}`);
  console.log(`  NFT:           ${nftAddr}`);
  console.log(`  USDT:          ${BSC_USDT}`);
  console.log(`  Aave Pool:     ${BSC_AAVE_POOL}`);
  console.log(`  aUSDT:         ${BSC_AUSDT}`);
  console.log("========================================");
  console.log("\nCopy these into lib/contracts/addresses.ts");
  console.log("\nStep 8 (manual): Fund Chainlink VRF subscription and add Factory as consumer at vrf.chain.link");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
