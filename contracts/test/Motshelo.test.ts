import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const CircleType = { ROTATION: 0, SAVINGS_SPLIT: 1 } as const;
const CircleStatus = { OPEN: 0, ACTIVE: 1, COMPLETED: 2, PAUSED: 3 } as const;
const PayoutOrder = { FIXED: 0, RANDOM: 1, SENIORITY: 2 } as const;
const SplitMethod = { PROPORTIONAL: 0, EQUAL: 1 } as const;
const MissPolicy = { SKIP: 0, SLASH: 1, EXPEL: 2 } as const;
const JoinVisibility = { PUBLIC: 0, INVITE_ONLY: 1, WHITELIST: 2 } as const;

const WEEKLY = 604800n;
const GRACE_48H = 172800n;
const CONTRIBUTION = ethers.parseEther("100");
const TEST_YIELD = ethers.parseEther("20");

function defaultConfig(overrides: Record<string, unknown> = {}) {
  return {
    circleType: CircleType.ROTATION,
    contributionAmount: CONTRIBUTION,
    contributionFrequency: WEEKLY,
    maxMembers: 5n,
    minMembersToActivate: 2n,
    payoutOrder: PayoutOrder.FIXED,
    splitMethod: SplitMethod.PROPORTIONAL,
    missPolicy: MissPolicy.SKIP,
    gracePeriod: GRACE_48H,
    earlyExitAllowed: true,
    maturityTimestamp: 0n,
    communityReserveBps: 0n,
    joinVisibility: JoinVisibility.PUBLIC,
    ...overrides,
  };
}

async function deployProtocolFixture() {
  const [deployer, alice, bob] = await ethers.getSigners();

  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const usdt = await MockUSDT.deploy();
  await usdt.waitForDeployment();

  const MockAToken = await ethers.getContractFactory("MockAToken");
  const aToken = await MockAToken.deploy();
  await aToken.waitForDeployment();

  const MockAavePool = await ethers.getContractFactory("MockAavePool");
  const aavePool = await MockAavePool.deploy(await usdt.getAddress(), await aToken.getAddress());
  await aavePool.waitForDeployment();
  await aToken.setPool(await aavePool.getAddress());

  await usdt.mint(alice.address, ethers.parseEther("100000"));
  await usdt.mint(bob.address, ethers.parseEther("100000"));

  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const feeCollector = await FeeCollector.deploy(deployer.address);
  await feeCollector.waitForDeployment();

  const Factory = await ethers.getContractFactory("MotsheloFactory");
  const factory = await Factory.deploy(
    await feeCollector.getAddress(),
    ethers.ZeroAddress,
    ethers.ZeroAddress,
    deployer.address,
    ethers.keccak256(ethers.toUtf8Bytes("test-key-hash")),
    0,
    await aavePool.getAddress(),
    await aToken.getAddress()
  );
  await factory.waitForDeployment();

  await feeCollector.updateFactory(await factory.getAddress());

  const Registry = await ethers.getContractFactory("MotsheloRegistry");
  const registry = await Registry.deploy(await factory.getAddress());
  await registry.waitForDeployment();

  const NFT = await ethers.getContractFactory("MotsheloNFT");
  const nft = await NFT.deploy("https://motshelo.xyz/nft/", await factory.getAddress());
  await nft.waitForDeployment();

  await factory.updateDependencies(
    await feeCollector.getAddress(),
    await nft.getAddress(),
    await registry.getAddress()
  );
  await factory.setApprovedToken(await usdt.getAddress(), true);

  return { deployer, alice, bob, usdt, aToken, aavePool, feeCollector, factory, registry, nft };
}

async function createCircle(
  factory: Awaited<ReturnType<typeof deployProtocolFixture>>["factory"],
  usdtAddress: string,
  creator: Awaited<ReturnType<typeof ethers.getSigners>>[number],
  config = defaultConfig()
) {
  await factory.connect(creator).createCircle(
    usdtAddress,
    config,
    "Test Circle",
    "A test circle",
    ""
  );
  const count = await factory.getCircleCount();
  const circleAddr = await factory.allCircles(count - 1n);
  return ethers.getContractAt("MotsheloCircle", circleAddr);
}

describe("Motshelo Protocol (unit tests with mocks)", function () {
  it("deploys and wires protocol dependencies", async function () {
    const { factory, feeCollector, registry, nft, usdt } = await loadFixture(deployProtocolFixture);

    expect(await factory.feeCollector()).to.equal(await feeCollector.getAddress());
    expect(await factory.registry()).to.equal(await registry.getAddress());
    expect(await factory.nftContract()).to.equal(await nft.getAddress());
    expect(await feeCollector.factory()).to.equal(await factory.getAddress());
    expect(await factory.approvedTokens(await usdt.getAddress())).to.equal(true);
  });

  it("creates a circle, joins members, and activates", async function () {
    const { factory, usdt, alice, bob } = await loadFixture(deployProtocolFixture);
    const circle = await createCircle(factory, await usdt.getAddress(), alice);
    const circleAddress = await circle.getAddress();

    await usdt.connect(alice).approve(circleAddress, CONTRIBUTION);
    await circle.connect(alice).join(ethers.ZeroAddress);
    await usdt.connect(bob).approve(circleAddress, CONTRIBUTION);
    await circle.connect(bob).join(ethers.ZeroAddress);

    expect(await circle.getMemberCount()).to.equal(2n);
    expect(await circle.status()).to.equal(CircleStatus.OPEN);

    await circle.connect(alice).activate();
    expect(await circle.status()).to.equal(CircleStatus.ACTIVE);
    expect(await circle.currentRound()).to.equal(1n);

    const [principal, aaveBalance, accruedYield] = await circle.getAavePosition();
    expect(principal).to.equal(CONTRIBUTION * 2n);
    expect(aaveBalance).to.equal(CONTRIBUTION * 2n);
    expect(accruedYield).to.equal(0n);
  });

  it("handles payout and fee split with mocked yield", async function () {
    const { factory, usdt, aavePool, feeCollector, alice, bob } = await loadFixture(deployProtocolFixture);
    const circle = await createCircle(factory, await usdt.getAddress(), alice);
    const circleAddress = await circle.getAddress();

    await usdt.connect(alice).approve(circleAddress, CONTRIBUTION * 2n);
    await circle.connect(alice).join(ethers.ZeroAddress);
    await usdt.connect(bob).approve(circleAddress, CONTRIBUTION * 2n);
    await circle.connect(bob).join(ethers.ZeroAddress);
    await circle.connect(alice).activate();

    await circle.connect(alice).contribute();
    await circle.connect(bob).contribute();

    await aavePool.accrueYield(circleAddress, TEST_YIELD);

    await expect(circle.triggerPayout())
      .to.emit(circle, "PayoutSent")
      .to.emit(circle, "YieldHarvested");

    const expectedWithdrawalFee = (CONTRIBUTION * 2n * 200n) / 10000n;
    const expectedProtocolYieldShare = (TEST_YIELD * 6000n) / 10000n;
    const expectedTotalFees = expectedWithdrawalFee + expectedProtocolYieldShare;

    expect(await feeCollector.collectedFees(await usdt.getAddress())).to.equal(expectedTotalFees);
  });

  it("applies 2% early-exit fee and blocks exit when disabled", async function () {
    const { factory, usdt, alice, bob } = await loadFixture(deployProtocolFixture);
    const circle = await createCircle(factory, await usdt.getAddress(), alice);
    const circleAddress = await circle.getAddress();

    await usdt.connect(alice).approve(circleAddress, CONTRIBUTION);
    await circle.connect(alice).join(ethers.ZeroAddress);
    await usdt.connect(bob).approve(circleAddress, CONTRIBUTION);
    await circle.connect(bob).join(ethers.ZeroAddress);
    await circle.connect(alice).activate();

    const bobBalanceBefore = await usdt.balanceOf(bob.address);
    await circle.connect(bob).exitEarly();
    const bobBalanceAfter = await usdt.balanceOf(bob.address);
    expect(bobBalanceAfter - bobBalanceBefore).to.equal((CONTRIBUTION * 98n) / 100n);

    const noExitConfig = defaultConfig({ earlyExitAllowed: false });
    const secondCircle = await createCircle(factory, await usdt.getAddress(), alice, noExitConfig);
    const secondCircleAddress = await secondCircle.getAddress();

    await usdt.connect(alice).approve(secondCircleAddress, CONTRIBUTION);
    await secondCircle.connect(alice).join(ethers.ZeroAddress);
    await usdt.connect(bob).approve(secondCircleAddress, CONTRIBUTION);
    await secondCircle.connect(bob).join(ethers.ZeroAddress);
    await secondCircle.connect(alice).activate();

    await expect(
      secondCircle.connect(bob).exitEarly()
    ).to.be.revertedWithCustomError(secondCircle, "EarlyExitNotAllowed");
  });

  it("registers metadata on circle creation", async function () {
    const { factory, usdt, alice, registry } = await loadFixture(deployProtocolFixture);
    await factory.connect(alice).createCircle(
      await usdt.getAddress(),
      defaultConfig(),
      "Ubuntu Savers",
      "Monthly rotation circle",
      "https://example.com/img.png"
    );

    const circleAddr = await factory.allCircles(0);
    const meta = await registry.circleMetadata(circleAddr);
    expect(meta.name).to.equal("Ubuntu Savers");
    expect(meta.description).to.equal("Monthly rotation circle");
    expect(meta.imageUri).to.equal("https://example.com/img.png");
    expect(await registry.registeredCircles(circleAddr)).to.equal(true);
  });
});
