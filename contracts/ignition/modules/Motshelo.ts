import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deployment order follows the 8-step sequence from the contract header:
 * 1. Deploy FeeCollector (temp factory = deployer)
 * 2. Deploy MotsheloFactory (with FeeCollector + Aave config)
 * 3. FeeCollector.updateFactory(factory)
 * 4. Deploy MotsheloRegistry(factory)
 * 5. Deploy MotsheloNFT(factory)
 * 6. Factory.updateDependencies(feeCollector, nft, registry)
 * 7. Factory.setApprovedToken(USDT, true)
 * 8. Fund Chainlink VRF subscription (manual step)
 */

const BSC_USDT = "0x55d398326f99059fF775485246999027b3197955";
const BSC_AAVE_POOL = "0x6807dc960D6d17351D069670733D59634f9c169B";
const BSC_AUSDT = "0xf6C6361958652d87e07b46187513575975a6c016";

const BSC_VRF_COORDINATOR = "0xc587d9053cd1118f25F645F9E08BB98c9712A4EE";
const BSC_VRF_KEY_HASH =
  "0x114f3da0a805b6a67d6e9cd2ec746f7028f1b7376365af575cfea3550dd1aa04";

const MotsheloModule = buildModule("Motshelo", (m) => {
  const deployer = m.getAccount(0);
  const vrfSubId = m.getParameter("vrfSubscriptionId", 0n);
  const nftBaseURI = m.getParameter(
    "nftBaseURI",
    "https://motshelo.xyz/api/nft/"
  );

  // 1. Deploy FeeCollector with deployer as temporary factory
  const feeCollector = m.contract("FeeCollector", [deployer]);

  // 2. Deploy MotsheloFactory
  const factory = m.contract("MotsheloFactory", [
    feeCollector,
    "0x0000000000000000000000000000000000000000", // nft placeholder
    "0x0000000000000000000000000000000000000000", // registry placeholder
    BSC_VRF_COORDINATOR,
    BSC_VRF_KEY_HASH,
    vrfSubId,
    BSC_AAVE_POOL,
    BSC_AUSDT,
  ]);

  // 3. FeeCollector.updateFactory(factory)
  m.call(feeCollector, "updateFactory", [factory], { id: "fc_setFactory" });

  // 4. Deploy MotsheloRegistry
  const registry = m.contract("MotsheloRegistry", [factory]);

  // 5. Deploy MotsheloNFT
  const nft = m.contract("MotsheloNFT", [nftBaseURI, factory]);

  // 6. Factory.updateDependencies
  m.call(
    factory,
    "updateDependencies",
    [feeCollector, nft, registry],
    { id: "factory_setDeps" }
  );

  // 7. Factory.setApprovedToken(USDT, true)
  m.call(factory, "setApprovedToken", [BSC_USDT, true], {
    id: "factory_approveUSDT",
  });

  return { feeCollector, factory, registry, nft };
});

export default MotsheloModule;
