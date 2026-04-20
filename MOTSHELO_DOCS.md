# Motshelo Protocol V2 — Technical Documentation

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Contract Reference](#3-contract-reference)
4. [Fee & Yield Model](#4-fee--yield-model)
5. [Circle Lifecycle](#5-circle-lifecycle)
6. [Configuration Options](#6-configuration-options)
7. [Deployment Guide](#7-deployment-guide)
8. [Frontend Integration](#8-frontend-integration)
9. [Events for Indexing](#9-events-for-indexing)
10. [Security Model](#10-security-model)
11. [Audit Log](#11-audit-log)

---

## 1. Overview

Motshelo is a **non-custodial, interest-bearing savings coordination protocol** on BNB Smart Chain (BSC). It lets groups ("circles") pool USDT and either:

- **Rotate** the full pot to one member each round (classic stokvel/chama model)
- **Accumulate** savings until a maturity date, then split proportionally or equally

**V2** integrates **Aave V3 on BSC** — all idle USDT is automatically supplied to Aave's lending pools, generating interest. Revenue comes from a **60/40 yield split** (protocol/user) and a **flat 2% withdrawal fee** on principal. Deposit fees are **0%**.

The smart contract is the only custodian. No admin wallet has access to user funds.

> **Decimal Note:** USDT on BSC (BEP-20) uses **18 decimals**, unlike USDC on other chains which uses 6. All contribution amounts, fee math, and yield calculations operate at 18-decimal precision.

### What Motshelo Does

- Coordinates group savings with trustless, on-chain rules
- Earns yield on idle USDT via Aave V3 automatically
- Distributes 40% of Aave interest to users
- Charges 0% on deposits, 2% on withdrawals

### What Motshelo Does NOT Do

- Promise guaranteed yield, interest, or returns (Aave rates are variable)
- Hold admin keys with access to user funds
- Require KYC (Phase 1)
- Borrow against user deposits on Aave
- Offer perpetual deposits

---

## 2. Architecture

```
┌─────────────────┐     deploys      ┌──────────────────┐
│ MotsheloFactory  │ ──────────────→ │  MotsheloCircle   │ (one per circle)
│  (immutable)     │                 │  (immutable)       │
└────────┬────────┘                 └────────┬───────────┘
         │ registers                         │ supply / withdraw
         ▼                                   ▼
┌─────────────────┐               ┌──────────────────┐
│ MotsheloRegistry│               │   Aave V3 Pool   │
│  (owner-managed) │               │  (Base Mainnet)   │
└─────────────────┘               └────────┬─────────┘
                                           │ aBasUSDC
         ┌─────────────────┐               │ (interest-bearing)
         │  MotsheloNFT    │               ▼
         │  (soulbound)    │     ┌──────────────────┐
         └─────────────────┘     │  FeeCollector     │
                                 │  (owner-managed)  │
                                 └──────────────────┘
```

| Contract | Responsibility | Upgradeable? |
|---|---|---|
| **MotsheloFactory** | Deploys circles, maintains registry, token whitelist, Aave config | No (owner for config) |
| **MotsheloCircle** | Core vault: join, contribute, payout, split, exit, penalties, Aave supply/withdraw | No (fully immutable) |
| **FeeCollector** | Receives 2% withdrawal fees + 60% protocol yield, owner withdraws | Owner-managed |
| **MotsheloRegistry** | Circle metadata for frontend discovery | Owner-managed |
| **MotsheloNFT** | Soulbound ERC-721 badges on cycle completion | No |
| **Aave V3 Pool** | External — manages USDT lending, returns aUSDT | N/A (external protocol) |

### Contract Registry (BSC Mainnet)

| Contract | Address |
|---|---|
| **Aave V3 Pool (BSC)** | `0x6807dc960D6d17351D069670733D59634f9c169B` |
| **USDT (BEP-20, 18 decimals)** | `0x55d398326f99059fF775485246999027b3197955` |
| **aUSDT (aToken)** | `0xf6C6361958652d87e07b46187513575975a6c016` |

**Critical security rule:** User funds inside Circle contracts are NEVER accessible to the developer. Only FeeCollector and Registry have owner privileges. Aave positions are owned solely by each Circle contract.

---

## 3. Contract Reference

### 3.1 MotsheloCircle

#### State Variables

| Variable | Type | Description |
|---|---|---|
| `creator` | `address immutable` | Circle creator, can activate/pause/whitelist |
| `token` | `IERC20 immutable` | USDT address |
| `feeCollector` | `address immutable` | FeeCollector contract |
| `aavePool` | `IPool immutable` | Aave V3 Pool for supply/withdraw |
| `aToken` | `IERC20 immutable` | aUSDT interest-bearing receipt token |
| `status` | `CircleStatus` | OPEN → ACTIVE → COMPLETED (or PAUSED) |
| `members` | `address[]` | All members who joined |
| `memberData` | `mapping` | Per-member tracking struct |
| `currentRound` | `uint256` | Current rotation round (1-indexed) |
| `rotationSize` | `uint256` | Active rotation slots (decrements on removal) |
| `totalDeposited` | `uint256` | Sum of all deposits (18-decimal) |
| `totalPrincipal` | `uint256` | Principal currently supplied to Aave (excludes yield, 18-decimal) |
| `accumulatedFees` | `uint256` | Fees not yet flushed to FeeCollector |
| `netContributionsThisRound` | `uint256` | USDT deposited this round (the actual pot) |
| `contributionsThisRound` | `uint256` | Number of members who contributed this round |

#### MemberData Struct

```solidity
struct MemberData {
    bool isActive;
    uint256 joinedAt;
    uint256 rotationPosition;
    bool hasReceived;           // received rotation payout
    uint256 contributed;        // cumulative contributions in 18-decimal USDT (no deposit fee)
    uint256 missedContributions;
    uint256 lastContributionAt;
    address referrer;
    uint256 consecutiveMisses;
}
```

#### Core Functions

| Function | Caller | Description |
|---|---|---|
| `join(address referrer)` | New member | Pay entry contribution in USDT (0% fee), supplied to Aave |
| `activate()` | Creator | Lock config, start round 1, request VRF if RANDOM |
| `contribute()` | Member | Pay round contribution in USDT (0% fee), supplied to Aave |
| `triggerPayout()` | Anyone | Withdraw from Aave, send pot + 40% yield to rotation recipient |
| `triggerSplit()` | Anyone | Withdraw all from Aave, distribute pool at maturity (SAVINGS_SPLIT) |
| `exitEarly()` | Member | Withdraw from Aave, get refund + 40% proportional yield minus 2% fee |
| `applyMissPenalty(address)` | Anyone | Apply skip/slash/expel after grace period |
| `pauseCircle()` | Creator | Pause all operations except exits |
| `unpauseCircle()` | Creator | Resume operations |

#### Aave Functions

| Function | Visibility | Description |
|---|---|---|
| `getAccruedYield()` | `public view` | Returns `aToken.balanceOf(this) - totalPrincipal` |
| `getAavePosition()` | `external view` | Returns principal, aToken balance, and accrued yield |
| `_supplyToAave(amount)` | `internal` | Approves + supplies USDC to Aave, updates `totalPrincipal` |
| `_withdrawFromAave(amount)` | `internal` | Withdraws USDC from Aave, returns actual amount withdrawn |

### 3.2 MotsheloFactory

| Function | Caller | Description |
|---|---|---|
| `createCircle(token, config, name, desc, imageUri)` | Anyone | Deploy a new circle with Aave config + auto-register |
| `setApprovedToken(token, bool)` | Owner | Whitelist stablecoins |
| `updateDependencies(fee, nft, registry)` | Owner | Update contract references |
| `updateAaveConfig(aavePool, aToken)` | Owner | Update Aave addresses (new circles only) |
| `getAllCircles(offset, limit)` | Anyone | Paginated circle list |

### 3.3 FeeCollector

| Function | Caller | Description |
|---|---|---|
| `receiveFees(token, amount)` | Deployed circles only | Accounting-only (tokens already transferred) |
| `withdrawFees(token, to, amount)` | Owner | Withdraw tracked fees |
| `withdrawAllFees(token, to)` | Owner | Withdraw all tracked fees |
| `sweepUntracked(token, to, amount)` | Owner | Recover accidentally sent tokens |

### 3.4 MotsheloRegistry

| Function | Caller | Description |
|---|---|---|
| `registerCircle(...)` | Factory only | Auto-called on circle creation |
| `verifyCircle(circle)` | Owner | Mark circle as verified |
| `updateMetadata(...)` | Creator or owner | Update circle name/description/image |

### 3.5 MotsheloNFT

| Function | Caller | Description |
|---|---|---|
| `mint(to, circle)` | Deployed circles only | Mint soulbound badge |
| `setBaseURI(uri)` | Owner | Update metadata base URI |

Soulbound enforcement: `_update` override reverts on any transfer between non-zero addresses.

---

## 4. Fee & Yield Model

### V2 Fee Structure

| Fee Type | Rate | Applied To | When |
|---|---|---|---|
| **Deposit Fee** | 0% | — | `join()`, `contribute()` |
| **Withdrawal Fee** | 2% | Principal amount | `triggerPayout()`, `triggerSplit()`, `exitEarly()` |
| **Protocol Yield** | 60% | Accrued Aave interest | On every withdrawal/payout/split |
| **User Yield** | 40% | Accrued Aave interest | Added to user payout |
| **Community Reserve** | 0–1% | Principal (configurable) | On payout/split |

### Flow Diagrams

```
On join() and contribute() — V2 (all amounts in 18-decimal USDT):
  amount      = contributionAmount
  fee         = 0                     → no fees
  net         = amount                → member's contributed balance
  Aave:       _supplyToAave(amount)   → totalPrincipal += amount

On triggerPayout() (Rotation) — V2:
  grossPot    = netContributionsThisRound    (18-decimal USDT)
  yield       = getAccruedYield()            (aToken balance - totalPrincipal)
  protocolYield = yield × 60%               → accumulatedFees
  userYield   = yield × 40%                 → recipient bonus
  wFee        = grossPot × 2%              → accumulatedFees
  reserve     = grossPot × communityBps    → accumulatedFees
  netPayout   = grossPot - wFee - reserve + userYield → recipient
  Aave:       withdraw(grossPot + yield)
              totalPrincipal -= grossPot

On triggerSplit() (Savings) — V2:
  yield       = getAccruedYield()
  protocolYield = yield × 60%               → accumulatedFees
  Aave:       withdraw(type(uint256).max)    → totalPrincipal = 0
  pool        = token.balanceOf(this) - accumulatedFees
  per-member  = proportional to contributed OR equal split
  wFee        = member.contributed × 2%    → accumulatedFees
  reserve     = member.contributed × communityBps → accumulatedFees
  netShare    = share - wFee - reserve      → member

On exitEarly() — V2:
  refund      = member.contributed
  yield       = getAccruedYield() × (refund / totalPrincipal)
  protocolYield = yield × 60%               → accumulatedFees
  userYield   = yield × 40%                 → member bonus
  wFee        = refund × 2%               → accumulatedFees
  netRefund   = refund - wFee + userYield   → member
  Aave:       withdraw(refund + yield)
              totalPrincipal -= refund

Fee flush: accumulatedFees → safeTransfer to FeeCollector → receiveFees() accounting
```

### Revenue Case Study ($100k Deposit, 3.5% APY, 1 Year)

| Item | Value |
|---|---|
| **Initial Principal** | $100,000.00 |
| **Total Yield Accrued (3.5%)** | $3,500.00 |
| **Protocol Yield Share (60%)** | **$2,100.00** |
| **User Yield Share (40%)** | $1,400.00 |
| **Withdrawal Fee (2% of Principal)** | **$2,000.00** |
| **Total Protocol Revenue** | **$4,100.00** |
| **User Final Payout** | **$99,400.00** |
| **Effective User Cost** | **0.6%** (vs 9.75% in V1) |

---

## 5. Circle Lifecycle

### Type A — Rotation

```
OPEN ──join()──→ OPEN ──activate()──→ ACTIVE
    (USDC → Aave)                      │
                                 contribute() × N
                                 (USDC → Aave)
                                       │
                                 triggerPayout()
                                 (Aave → USDC → recipient + 40% yield - 2% fee)
                                       │
                                 ──advanceRound()──→ ACTIVE (next round)
                                       │
                                 (all rounds done)
                                       │
                                       ▼
                                   COMPLETED
                                   (remaining Aave → flush)
                                   (mint NFT badges)
```

### Type B — Savings Split

```
OPEN ──join()──→ OPEN ──activate()──→ ACTIVE
    (USDC → Aave)                      │
                                 contribute() monthly
                                 (USDC → Aave)
                                       │
                                 (maturity reached)
                                       │
                                 triggerSplit()
                                 (Aave → withdraw all)
                                 (distribute pool + 40% yield - 2% fee)
                                       │
                                       ▼
                                   COMPLETED → mint NFT badges
```

### Pause Flow

```
ACTIVE ──pauseCircle()──→ PAUSED
                            │
                     (exitEarly still works — with Aave withdrawal)
                     (contribute/payout/split blocked)
                            │
                     unpauseCircle()──→ ACTIVE
```

### Missing Contribution Penalties

| Policy | Behavior |
|---|---|
| **SKIP** | Member's rotation turn moved to end of queue (only if not yet received) |
| **SLASH** | 10% of their contributed total redistributed to other members |
| **EXPEL** | After 2 consecutive misses, expelled. Funds redistributed to remaining members |

---

## 6. Configuration Options

Set at circle creation. Locked forever once `activate()` is called.

| Parameter | Options | Default (suggested) |
|---|---|---|
| Circle type | `ROTATION` / `SAVINGS_SPLIT` | `ROTATION` |
| Contribution amount | $10–$1,000,000 USDT (18 decimals) | $100 |
| Frequency | `WEEKLY` (604800s) / `MONTHLY` (2592000s) | `MONTHLY` |
| Min members to activate | 2–50 | 3 |
| Max members | 3–50 | 10 |
| Join visibility | `PUBLIC` / `INVITE_ONLY` / `WHITELIST` | `INVITE_ONLY` |
| Payout order (Rotation) | `FIXED` / `RANDOM` (VRF) / `SENIORITY` | `FIXED` |
| Split method (Savings) | `PROPORTIONAL` / `EQUAL` | `PROPORTIONAL` |
| Grace period | 12h / 24h / 48h / 72h | 48h |
| Miss penalty | `SKIP` / `SLASH` / `EXPEL` | `SKIP` |
| Early exit allowed | `true` / `false` | `false` |
| Maturity timestamp | Unix timestamp (Savings only) | — |
| Community reserve | 0–100 bps (0–1%) | 0 |

---

## 7. Deployment Guide

### Prerequisites

- Node.js 18+, Hardhat or Foundry
- BSC RPC endpoint
- Deployer wallet with BNB on BSC
- Chainlink VRF v2 subscription on BSC (if using RANDOM rotation)
- Aave V3 Pool and aToken addresses on BSC

### Contract Addresses (BSC Mainnet)

| Contract | Address | Decimals |
|---|---|---|
| USDT (BEP-20) | `0x55d398326f99059fF775485246999027b3197955` | 18 |
| Aave V3 Pool | `0x6807dc960D6d17351D069670733D59634f9c169B` | — |
| aUSDT | `0xf6C6361958652d87e07b46187513575975a6c016` | 18 |

### Deployment Order

```bash
# Step 1: Deploy FeeCollector (use deployer address as temporary factory)
FeeCollector = deploy(deployer_address)

# Step 2: Deploy MotsheloFactory with Aave config
Factory = deploy(FeeCollector, address(0), address(0), vrfCoordinator, vrfKeyHash, vrfSubId, aavePool, aToken)

# Step 3: Wire FeeCollector to Factory
FeeCollector.updateFactory(Factory)

# Step 4: Deploy Registry
Registry = deploy(Factory)

# Step 5: Deploy NFT
NFT = deploy("https://api.motshelo.xyz/metadata/", Factory)

# Step 6: Wire Factory to Registry and NFT
Factory.updateDependencies(FeeCollector, NFT, Registry)

# Step 7: Approve USDT
Factory.setApprovedToken(USDT_BSC, true)

# Step 8: (If using VRF) Add Factory as VRF consumer
# Done via Chainlink VRF subscription management UI
```

### Hardhat Example

```javascript
const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    const USDT_BSC = "0x55d398326f99059fF775485246999027b3197955";
    const AAVE_POOL = "0x6807dc960D6d17351D069670733D59634f9c169B";
    const AAVE_AUSDT = "0xf6C6361958652d87e07b46187513575975a6c016";
    const VRF_COORDINATOR = "0xc587d9053cd1118f25F645F9E08BB98c9712A4EE"; // BSC mainnet
    const VRF_KEY_HASH = "0x..."; // Your key hash
    const VRF_SUB_ID = 123; // Your subscription ID

    // 1. FeeCollector
    const FeeCollector = await ethers.deployContract("FeeCollector", [deployer.address]);
    await FeeCollector.waitForDeployment();

    // 2. Factory (now includes Aave config)
    const Factory = await ethers.deployContract("MotsheloFactory", [
        await FeeCollector.getAddress(),
        ethers.ZeroAddress, // NFT placeholder
        ethers.ZeroAddress, // Registry placeholder
        VRF_COORDINATOR,
        VRF_KEY_HASH,
        VRF_SUB_ID,
        AAVE_POOL,
        AAVE_AUSDT
    ]);
    await Factory.waitForDeployment();

    // 3. Wire FeeCollector
    await FeeCollector.updateFactory(await Factory.getAddress());

    // 4. Registry
    const Registry = await ethers.deployContract("MotsheloRegistry", [await Factory.getAddress()]);
    await Registry.waitForDeployment();

    // 5. NFT
    const NFT = await ethers.deployContract("MotsheloNFT", [
        "https://api.motshelo.xyz/metadata/",
        await Factory.getAddress()
    ]);
    await NFT.waitForDeployment();

    // 6. Wire Factory
    await Factory.updateDependencies(
        await FeeCollector.getAddress(),
        await NFT.getAddress(),
        await Registry.getAddress()
    );

    // 7. Approve USDT
    await Factory.setApprovedToken(USDT_BSC, true);

    console.log("V2 Deployed (BSC):");
    console.log("  FeeCollector:", await FeeCollector.getAddress());
    console.log("  Factory:", await Factory.getAddress());
    console.log("  Registry:", await Registry.getAddress());
    console.log("  NFT:", await NFT.getAddress());
    console.log("  Aave Pool:", AAVE_POOL);
    console.log("  aUSDT:", AAVE_AUSDT);
}

main().catch(console.error);
```

---

## 8. Frontend Integration

### Reading Circle State

```javascript
const circle = new ethers.Contract(circleAddress, MotsheloCircleABI, provider);

// Circle configuration
const config = await circle.getCircleConfig();
const status = await circle.status();

// Members
const memberCount = await circle.getMemberCount();
const activeMembers = await circle.getActiveMembers();
const memberInfo = await circle.getMemberInfo(userAddress);

// Round info
const currentRound = await circle.currentRound();
const recipient = await circle.getCurrentRecipient();
const window = await circle.getContributionWindow();
const isDue = await circle.isContributionDue(userAddress);

// V2: Aave yield info
const { principal, aaveBalance, yield: accruedYield } = await circle.getAavePosition();
const yieldAmount = await circle.getAccruedYield();

// Discovery (paginated)
const factory = new ethers.Contract(factoryAddress, FactoryABI, provider);
const page = await factory.getAllCircles(0, 20);
const userCircles = await factory.getUserCircles(userAddress);
```

### Writing Transactions

```javascript
const signer = provider.getSigner();
const circle = new ethers.Contract(circleAddress, MotsheloCircleABI, signer);

// User must approve USDT first (full amount — no deposit fee in V2)
// Note: USDT on BSC uses 18 decimals (e.g. 100 USDT = 100e18)
const usdt = new ethers.Contract(USDT_ADDRESS, ERC20ABI, signer);
await usdt.approve(circleAddress, contributionAmount);

// Join (0% fee, USDT goes to Aave)
await circle.join(referrerAddress);

// Contribute (0% fee, USDT goes to Aave)
await circle.contribute();

// Create a new circle
const factory = new ethers.Contract(factoryAddress, FactoryABI, signer);
const tx = await factory.createCircle(
    USDT_ADDRESS,
    {
        circleType: 0,              // ROTATION
        contributionAmount: ethers.parseEther("100"),  // $100 USDT (18 decimals)
        contributionFrequency: 2592000, // MONTHLY
        maxMembers: 10,
        minMembersToActivate: 3,
        payoutOrder: 0,             // FIXED
        splitMethod: 0,             // PROPORTIONAL
        missPolicy: 0,              // SKIP
        gracePeriod: 172800,        // 48h
        earlyExitAllowed: false,
        maturityTimestamp: 0,
        communityReserveBps: 0,
        joinVisibility: 1           // INVITE_ONLY
    },
    "My Savings Circle",
    "Monthly $100 rotation with friends",
    "ipfs://..."
);
const receipt = await tx.wait();
// Parse CircleDeployed event for the new address
```

### Event Indexing

The frontend should index events rather than poll state:

```javascript
// Listen for contributions
circle.on("ContributionMade", (circleAddr, member, amount, round) => {
    console.log(`${member} contributed ${amount} in round ${round}`);
});

// Listen for payouts (now includes yield)
circle.on("PayoutSent", (circleAddr, recipient, amount, round) => {
    console.log(`${recipient} received ${amount} in round ${round}`);
});

// V2: Listen for yield events
circle.on("YieldHarvested", (circleAddr, totalYield, protocolShare, userShare) => {
    console.log(`Yield: ${totalYield} (protocol: ${protocolShare}, user: ${userShare})`);
});

// V2: Track Aave activity
circle.on("AaveSupplied", (circleAddr, amount) => {
    console.log(`Supplied ${ethers.formatEther(amount)} USDT to Aave`);
});

// Listen for new circles
factory.on("CircleDeployed", (circle, creator, circleType, token) => {
    console.log(`New circle: ${circle} by ${creator}`);
});
```

---

## 9. Events for Indexing

| Event | Indexed Fields | Data |
|---|---|---|
| `CircleCreated` | circle, creator | circleType |
| `MemberJoined` | circle, member | position |
| `CircleActivated` | circle | memberCount |
| `ContributionMade` | circle, member | amount, round |
| `PayoutSent` | circle, recipient | amount, round |
| `SplitExecuted` | circle | totalDistributed, memberCount |
| `MemberExited` | circle, member | refundAmount |
| `MissPenaltyApplied` | circle, member | policy |
| `FeesCollected` | circle | amount |
| `BadgeMinted` | member, circle | tokenId |
| `RoundAdvanced` | circle | newRound |
| `CirclePaused` | circle | — |
| `CircleUnpaused` | circle | — |
| `YieldHarvested` | circle | totalYield, protocolShare, userShare |
| `AaveSupplied` | circle | amount |
| `AaveWithdrawn` | circle | amount |

---

## 10. Security Model

### Access Control

| Action | Who Can Do It |
|---|---|
| Join a circle | Anyone (PUBLIC), whitelisted only (INVITE_ONLY/WHITELIST) |
| Activate a circle | Circle creator only |
| Contribute | Active members only |
| Trigger payout/split | Anyone (keeper-friendly) |
| Apply miss penalty | Anyone (keeper-friendly) |
| Pause/unpause circle | Circle creator only |
| Withdraw fees | FeeCollector owner only |
| Approve tokens | Factory owner only |
| Verify circles | Registry owner only |
| Update Aave config | Factory owner only (new circles only) |

### Non-Custodial Guarantees

- Circle contracts are **fully immutable** — no owner, no upgrade path
- The `creator` role is limited to lifecycle management (activate, pause, whitelist)
- Creator **cannot** access funds, change contribution amounts, or redirect payouts
- FeeCollector only accepts fee reports from Factory-deployed circles
- NFT minting only allowed from Factory-deployed circles
- **Aave positions are owned solely by each Circle contract** — no admin can access them

### Reentrancy Protection

- All external state-changing functions use `nonReentrant` modifier
- State updates happen before external calls (checks-effects-interactions)
- SafeERC20 for all token transfers (handles non-standard return values)
- `forceApprove` for Aave token approvals (prevents approval front-running)

### VRF Security

- Random rotation uses Chainlink VRF v2 via `VRFConsumerBaseV2` inheritance
- `fulfillRandomWords` is `internal override` — only callable through Chainlink's validated path
- `triggerPayout()` blocks with `RandomOrderNotReady` until VRF callback completes

### Aave Integration Security

- Only `supply()` and `withdraw()` are called — no borrowing, no flash loans
- Circle contract is the sole owner of its Aave position (aToken balance)
- `totalPrincipal` tracking ensures accurate yield calculation
- Yield calculation protected against underflow (`if balance <= principal return 0`)
- Aave V3 is one of the most audited protocols in DeFi (Trail of Bits, OpenZeppelin, SigmaPrime, Certora)
- In case of Aave disruption, circle creator can pause, and members can still exit

### Rotation Integrity

- `rotationSize` counter tracks the actual number of active rotation slots
- Removing a member (exit/expel) decrements `rotationSize` and shifts all subsequent positions
- Shuffle operates on `rotationSize`, not `members.length`
- Skip penalty only applies to members who haven't received their payout yet

---

## 11. Audit Log

### V1 Bugs (Fixed Before V2)

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | Critical | `_flushFees` sent tokens via `safeTransfer` but `FeeCollector.pushFees` tried `transferFrom` again | Renamed to `receiveFees()` — accounting only, no token pull |
| 2 | Critical | `activate()` set `contributionsThisRound = members.length`, skipping round 1 | Set to 0; join deposit is entry fee, not round contribution |
| 3 | Critical | VRF `fulfillRandomWords` was unprotected `external` function | Inherited `VRFConsumerBaseV2`, made callback `internal override` |
| 4 | Critical | `_shuffleRotationOrder` updated wrong member positions after swap | Read addresses from storage after swap, then update |
| 5 | Critical | `_removeFromRotation` left stale duplicates causing permanent stuck circles | Added `rotationSize` counter, removed `address(0)` guard |
| 6 | Critical | `_expelMember` decremented `totalDeposited` but funds stayed in contract (broke proportional split) | Removed `totalDeposited` decrement in expel (funds are redistributed) |
| 7 | Critical | `exitEarly` refunded entire contribution history (insolvency in rotation circles) | Capped refund to available contract balance |
| 8 | Critical | `join()` set `lastContributionAt = block.timestamp` — blocked round 1 contributions when join and activate in same block | Set to 0 |
| 9 | Medium | `pauseCircle` allowed re-pause, corrupting `_prePauseStatus` → permanent freeze | Guard changed to `status != ACTIVE` |
| 10 | Medium | `_expelMember` set `isActive = false` before `_redistributeSlash` — wrong divisor | Moved `isActive = false` to after redistribution |
| 11 | Medium | Inactive recipient skip wiped round contribution counters | Skip only increments `currentRound`, no counter reset |
| 12 | Medium | Inactive recipient skip at last round left circle stuck in ACTIVE | Added `_completeCircle()` check after increment |
| 13 | Medium | `_calculateRoundPot` returned gross amount (contract didn't hold that much) | Replaced with `netContributionsThisRound` tracking |
| 14 | Medium | `_moveToEndOfQueue` (SKIP) could corrupt positions for already-paid members | Added `hasReceived` guard |
| 15 | Medium | FeeCollector `pushFees` had zero access control | Checks `isDeployedCircle` via Factory |
| 16 | Medium | Registry `registerCircle` had no access control | Added `onlyFactory` modifier |
| 17 | Medium | No token whitelist in Factory | Added `approvedTokens` mapping |
| 18 | Medium | `exitEarly` mid-round left inflated pot for recipient | Subtracts round contribution from `netContributionsThisRound` |
| 19 | Medium | EQUAL split dust permanently trapped in completed circles | Remainder sent to last active member |
| 20 | Medium | `unpauseCircle` had dead ternary (both branches identical) | Simplified to `status = _prePauseStatus` |
| 21 | Low | `INVITE_ONLY` join visibility had no enforcement | Treated same as WHITELIST |
| 22 | Low | Slash dust silently trapped | Remainder assigned to first eligible member |
| 23 | Low | `FeeCollector` used raw `transfer` instead of SafeERC20 | Switched to `safeTransfer` |
| 24 | Low | Registry had one-step ownership transfer | Upgraded to `Ownable2Step` |
| 25 | Low | NFT supported only one minter address | Used Factory `isDeployedCircle` check |
| 26 | Low | No pause functionality despite PAUSED enum existing | Added `pauseCircle()`/`unpauseCircle()` |
| 27 | Low | No paginated getter for circles in Factory | Added `getAllCircles(offset, limit)` |
| 28 | Low | Maturity timestamp not validated as future date | Added `maturityTimestamp > block.timestamp` check |
| 29 | Low | `withdrawAllFees` used `balanceOf` instead of tracked amount | Uses `collectedFees[token]` as source of truth |
| 30 | Low | Custom `_toString` duplicated OZ `Strings.toString` | Replaced with OZ import |

### V2 Changes

| # | Type | Change | Details |
|---|---|---|---|
| 31 | Feature | Aave V3 integration | Added `IPool` interface, `aavePool`/`aToken` immutables, `_supplyToAave()`/`_withdrawFromAave()` |
| 32 | Feature | Yield tracking | Added `totalPrincipal` state var, `getAccruedYield()`, `getAavePosition()` |
| 33 | Feature | 60/40 yield split | Protocol gets 60% of Aave interest, users get 40% on payout/split/exit |
| 34 | Breaking | Deposit fee abolished | `FEE_BPS = 500` removed; `join()` and `contribute()` charge 0% |
| 35 | Breaking | Withdrawal fee reduced | New `WITHDRAWAL_FEE_BPS = 200` (2%) applied to principal only |
| 36 | Breaking | MAX_CONTRIBUTION raised | From 5,000 USDC to 1,000,000 USDC for institutional deposits |
| 37 | Feature | Auto Aave supply on deposit | `join()` and `contribute()` call `_supplyToAave()` |
| 38 | Feature | Aave withdraw on payout | `triggerPayout()` withdraws from Aave (principal + yield) |
| 39 | Feature | Aave withdraw on split | `triggerSplit()` withdraws all from Aave, distributes with yield |
| 40 | Feature | Aave withdraw on exit | `exitEarly()` withdraws proportional principal + yield from Aave |
| 41 | Feature | Circle completion cleanup | `_completeCircle()` withdraws remaining Aave balance, flushes to FeeCollector |
| 42 | Feature | Factory Aave config | Added `aavePool`/`aToken` state, `updateAaveConfig()`, passed to circles |
| 43 | Feature | New events | `YieldHarvested`, `AaveSupplied`, `AaveWithdrawn`, `AaveConfigUpdated` |
| 44 | Enhancement | Constructor validation | Added zero-address checks for `_aavePool` and `_aToken` |

---

## Source File

All contracts are in a single file: **`motshelo.sol`**

- Solidity `^0.8.20`
- Dependencies: OpenZeppelin Contracts v5, Chainlink VRF v2
- Target chain: BNB Smart Chain (BSC)
- Token: USDT BEP-20 (18 decimals) at `0x55d398326f99059fF775485246999027b3197955`
- Yield source: Aave V3 Pool (BSC) at `0x6807dc960D6d17351D069670733D59634f9c169B`

### Install Dependencies (Hardhat)

```bash
npm install @openzeppelin/contracts @chainlink/contracts
```

### Install Dependencies (Foundry)

```bash
forge install OpenZeppelin/openzeppelin-contracts
forge install smartcontractkit/chainlink
```
