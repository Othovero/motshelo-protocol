# Motshelo Smart Contract Analysis

## Overview

**Motshelo** is a Solidity smart contract protocol deployed on **BNB Smart Chain (BSC)**. It implements a decentralized, non-custodial community savings and coordination platform inspired by the traditional African "Motshelo" concept—a rotating savings group where members pool resources and take turns receiving funds.

**V2** integrates **Aave V3 on BSC** for yield generation. The protocol now:
- Automatically supplies idle USDT (BEP-20, 18 decimals) to Aave V3 lending pools
- Splits accrued yield 60/40 between protocol and users
- Charges 0% on deposits, 2% on withdrawals
- Supports contributions up to $1,000,000 USDT for institutional deposits

---

## Contract Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Motshelo Protocol V2                           │
├─────────────────────────────────────────────────────────────────┤
│  5 Contracts: Factory, Circle, FeeCollector, Registry, NFT       │
│  External: Aave V3 Pool (yield generation)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │
│  │   Factory   │   │   Circle    │   │  Aave V3    │           │
│  │  - Deploy   │   │  - Join     │   │  - Supply   │           │
│  │  - Config   │   │  - Contrib  │   │  - Withdraw │           │
│  │  - Registry │   │  - Payout   │   │  - Yield    │           │
│  └─────────────┘   └─────────────┘   └─────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. StorageSlot Library (Lines 9-118)

A utility library for low-level storage slot access. Provides type-safe access to storage at specific memory slots using inline assembly.

**Purpose**: Enables efficient storage patterns, particularly useful for upgradeable contracts and gas optimization.

**Supported Types**:
- `AddressSlot`
- `BooleanSlot`
- `Bytes32Slot`
- `Uint256Slot`
- `Int256Slot`
- `StringSlot`
- `BytesSlot`

### 2. ReentrancyGuard (Lines 120-207)

An abstract security contract that prevents reentrancy attacks.

**How It Works**:
```solidity
modifier nonReentrant() {
    _nonReentrantBefore();  // Sets status to ENTERED
    _;                       // Execute function
    _nonReentrantAfter();   // Resets status to NOT_ENTERED
}
```

**Key Constants**:
- `NOT_ENTERED = 1` - Default state
- `ENTERED = 2` - Currently executing protected function

### 3. IERC20 Interface (Lines 209-217)

Minimal ERC20 interface for interacting with USDT token:
- `balanceOf()` - Check token balance
- `transfer()` - Send tokens
- `transferFrom()` - Transfer tokens on behalf of another address

---

## Contract Configuration

### Financial Parameters (V2)

| Parameter | Value | Description |
|-----------|-------|-------------|
| `MIN_CONTRIBUTION` | 10 USDT (10e18) | Minimum contribution per round |
| `MAX_CONTRIBUTION` | 1,000,000 USDT (1000000e18) | Maximum contribution per round |
| `WITHDRAWAL_FEE_BPS` | 200 (2%) | Fee on principal at withdrawal |
| `PROTOCOL_YIELD_BPS` | 6000 (60%) | Protocol's share of Aave yield |
| Deposit Fee | 0% | No fee on deposits (V2) |
| User Yield Share | 40% | User's share of Aave yield |
| Token Decimals | 18 | USDT on BSC uses 18 decimals |

### Revenue Model (V2)

| Fee Type | Rate | Applied To |
|----------|------|------------|
| Deposit | 0% | join(), contribute() |
| Withdrawal | 2% | Principal on payout/split/exit |
| Protocol Yield | 60% | Aave V3 accrued interest |
| User Yield | 40% | Aave V3 accrued interest |
| Community Reserve | 0–1% | Configurable per circle |

### Revenue Case Study ($100k, 3.5% APY, 1 Year)

| Item | Value |
|------|-------|
| Principal | $100,000 |
| Aave Yield | $3,500 |
| Protocol Revenue | $4,100 (2% fee + 60% yield) |
| User Net Cost | 0.6% |

---

## Data Structures

### UserInfo Struct
```solidity
struct UserInfo {
    uint id;              // Unique user identifier
    address account;      // Wallet address
    uint joinedAt;        // Timestamp of first deposit
    uint referrer;        // Referrer's ID
    uint totalDeposit;    // Lifetime deposits
    uint currentDeposit;  // Active deposits
    uint totalTeam;       // Total team size (all levels)
    uint directTeam;      // Direct referrals count
    uint totalBusiness;   // Total team volume
    uint directBusiness;  // Direct team volume
    uint rank;            // Current rank (0-8)
}
```

### IncomeInfo Struct
```solidity
struct IncomeInfo {
    uint totalIncome;       // Total earnings ever
    uint totalLost;         // Missed income (didn't qualify)
    uint totalLevelIncome;  // Referral commissions
    uint networkReward;     // Available network reward balance
    uint totalRoiIncome;    // Total ROI earned
    uint roiIncome;         // Available ROI balance
    uint totalRankIncome;   // Total rank rewards
}
```

### Cycle Struct
```solidity
struct Cycle {
    uint amount;           // Deposit amount
    uint startedAt;        // Start timestamp
    uint endAt;            // End timestamp
    uint roiTaken;         // Days of ROI claimed
    uint cycleType;        // 0=deposit, 1=reinvest
    uint lastClaimed;      // Last ROI claim timestamp
    bool principalClaimed; // Principal withdrawn?
}
```

### IncomeHistory Struct
```solidity
struct IncomeHistory {
    uint incomeType;  // 0=ROI, 1=Level, 2=Rank
    uint amount;      // Income amount
    uint from;        // Source user ID (for level income)
    uint layer;       // Level number (for level income)
    uint time;        // Timestamp
    bool isLost;      // Was income lost due to not qualifying?
}
```

---

## Core Functions Explained

### 1. Registration Flow

```solidity
function register(uint _ref) external
```

**Process**:
1. Validates referrer has deposited OR is the default referrer
2. Checks user isn't already registered
3. Generates unique ID: `block.timestamp + (totalRegisters * 7)`
4. Creates user record with referrer link
5. Increments total registrations

**Diagram**:
```
User → register(_ref) → Validate Referrer → Generate ID → Link to Referrer → Done
```

### 2. Deposit Flow

```solidity
function deposit(uint _amount) external nonReentrant
```

**Process**:
1. Verify user is registered
2. Check minimum deposit (10 USDT)
3. Calculate cycle-based max deposit limit
4. Transfer USDT from user to contract
5. Send 5% fee to management
6. Create new cycle record
7. Distribute level commissions to upline

**Fee Flow**:
```
User deposits 100 USDT:
├── 5 USDT → Management wallet
└── 95 USDT → Contract (user's investment)
```

### 3. Level Income Distribution

```solidity
function _updateLayerInfo(uint _id, uint _amount, bool _isNew) private
```

When a user deposits, commissions flow up 20 levels:

```
New Deposit (100 USDT)
    │
    ├── Level 1 (Referrer): 5% = 5 USDT
    ├── Level 2: 3% = 3 USDT
    ├── Level 3: 2% = 2 USDT
    ├── Level 4-6: 2%-1% each
    ├── Level 7-10: 1% each
    ├── Level 11-15: 0.5% each
    └── Level 16-20: 0.25% each
```

**Qualification Check**: Each level requires:
- Minimum active deposit
- Minimum active direct referrals
- If not qualified, income is marked as "lost"

### 4. ROI Claiming

```solidity
function claimRoi() external returns (uint _roi)
```

**Process**:
1. Loop through user's active cycles (newest first)
2. Calculate days since last claim
3. Compute ROI: `amount × 3.33% × days`
4. Update cycle's `roiTaken` and `lastClaimed`
5. Credit ROI to user's available balance

**Example**:
```
Deposit: 100 USDT
Daily ROI: 100 × 3.33% = 3.33 USDT
30-Day Total: 3.33 × 30 = 99.9 USDT (~100%)
```

### 5. Principal Claim / Reinvest

```solidity
function claimPrincipal(uint _index, uint _type) external nonReentrant
```

After 30-day cycle completes:
- **Type 0 (Withdraw)**: Get principal back minus 5% fee
- **Type 1 (Reinvest)**: Principal goes into new cycle

### 6. Withdrawal Functions

```solidity
function withdrawRoi(uint _amount, uint _type) external nonReentrant
function withdrawNetworkReward(uint _amount, uint _type) external nonReentrant
```

Both allow:
- **Type 0**: Withdraw to wallet (5% fee)
- **Type 1**: Reinvest into new cycle

### 7. Rank Achievement

```solidity
function updateRank() external
```

Users call this to claim rank rewards when qualified:
1. Check if user has directs meeting requirements
2. Must achieve within time limit
3. Rank rewards added to network reward balance

---

## Security Features

### 1. Reentrancy Protection
All external functions that transfer funds use `nonReentrant` modifier.

### 2. Input Validation
- Minimum deposit/withdrawal amounts enforced
- Cycle limits prevent over-depositing
- Registration requires valid referrer

### 3. Access Control
- Admin can renounce ownership
- Management receives fees automatically
- No admin functions to drain funds

### 4. Safe Math
Solidity 0.8.x has built-in overflow/underflow protection.

---

## Income Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                        USER DEPOSIT                             │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   5% Fee    │───────► Management Wallet
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │   ROI    │     │  Level   │     │   Rank   │
   │ 3.33%/d  │     │ Income   │     │ Rewards  │
   │ 30 days  │     │ 20 Lvls  │     │ 8 Levels │
   └────┬─────┘     └────┬─────┘     └────┬─────┘
        │                │                │
        └────────────────┴────────────────┘
                         │
                  ┌──────▼──────┐
                  │   Withdraw  │
                  │   or        │
                  │   Reinvest  │
                  └──────┬──────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
       ┌───────────┐         ┌───────────┐
       │ Withdraw  │         │ Reinvest  │
       │ -5% Fee   │         │ New Cycle │
       └───────────┘         └───────────┘
```

---

## Replicating for Educational Projects

### Step 1: Project Setup

```bash
# Create new Hardhat project
mkdir my-defi-project
cd my-defi-project
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
```

### Step 2: Core Contract Template

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract EducationalDeFi is ReentrancyGuard {
    IERC20 public depositToken;
    
    // Configuration - customize these
    uint public constant MIN_DEPOSIT = 10e18;
    uint public constant CYCLE_DAYS = 30;
    uint public constant DAILY_RETURN = 333; // 3.33%
    uint public constant FEE_PERCENT = 500;  // 5%
    uint public constant BASE_DIVIDER = 10000;
    
    // User data structures
    struct User {
        uint id;
        address wallet;
        uint referrer;
        uint totalDeposit;
    }
    
    struct Cycle {
        uint amount;
        uint startTime;
        uint endTime;
        bool claimed;
    }
    
    mapping(address => uint) public userIds;
    mapping(uint => User) public users;
    mapping(uint => Cycle[]) public userCycles;
    
    uint public totalUsers;
    address public admin;
    address public feeCollector;
    
    constructor(address _token, address _feeCollector) {
        depositToken = IERC20(_token);
        feeCollector = _feeCollector;
        admin = msg.sender;
    }
    
    // Implement core functions...
}
```

### Step 3: Key Patterns to Implement

#### A. User Registration with Referrals
```solidity
function register(uint _referrer) external {
    require(userIds[msg.sender] == 0, "Already registered");
    require(users[_referrer].wallet != address(0), "Invalid referrer");
    
    totalUsers++;
    userIds[msg.sender] = totalUsers;
    users[totalUsers] = User({
        id: totalUsers,
        wallet: msg.sender,
        referrer: _referrer,
        totalDeposit: 0
    });
}
```

#### B. Deposit with Fee Collection
```solidity
function deposit(uint _amount) external nonReentrant {
    require(_amount >= MIN_DEPOSIT, "Below minimum");
    
    uint fee = (_amount * FEE_PERCENT) / BASE_DIVIDER;
    
    depositToken.transferFrom(msg.sender, address(this), _amount);
    depositToken.transfer(feeCollector, fee);
    
    uint userId = userIds[msg.sender];
    userCycles[userId].push(Cycle({
        amount: _amount - fee,
        startTime: block.timestamp,
        endTime: block.timestamp + (CYCLE_DAYS * 1 days),
        claimed: false
    }));
}
```

#### C. ROI Calculation
```solidity
function calculateROI(uint _userId) public view returns (uint) {
    uint totalROI = 0;
    Cycle[] storage cycles = userCycles[_userId];
    
    for (uint i = 0; i < cycles.length; i++) {
        if (!cycles[i].claimed) {
            uint elapsed = block.timestamp - cycles[i].startTime;
            uint days = elapsed / 1 days;
            if (days > CYCLE_DAYS) days = CYCLE_DAYS;
            
            totalROI += (cycles[i].amount * DAILY_RETURN * days) / BASE_DIVIDER;
        }
    }
    return totalROI;
}
```

#### D. Multi-Level Distribution
```solidity
function distributeToUpline(uint _userId, uint _amount) internal {
    uint[] memory commissions = new uint[](5);
    commissions[0] = 500;  // 5%
    commissions[1] = 300;  // 3%
    commissions[2] = 200;  // 2%
    commissions[3] = 100;  // 1%
    commissions[4] = 100;  // 1%
    
    uint upline = users[_userId].referrer;
    for (uint i = 0; i < 5 && upline != 0; i++) {
        uint commission = (_amount * commissions[i]) / BASE_DIVIDER;
        // Credit to upline's balance
        upline = users[upline].referrer;
    }
}
```

### Step 4: Testing Checklist

- [ ] User registration with valid/invalid referrers
- [ ] Deposit minimum and maximum limits
- [ ] ROI calculation accuracy
- [ ] Fee deduction correctness
- [ ] Multi-level commission distribution
- [ ] Withdrawal with fees
- [ ] Reentrancy attack prevention
- [ ] Edge cases (zero amounts, expired cycles)

### Step 5: Deployment Script

```javascript
// scripts/deploy.js
const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    
    // Deploy mock USDT for testing
    const MockToken = await hre.ethers.getContractFactory("MockERC20");
    const token = await MockToken.deploy("Test USDT", "USDT", 18);
    
    // Deploy main contract
    const DeFi = await hre.ethers.getContractFactory("EducationalDeFi");
    const defi = await DeFi.deploy(token.address, deployer.address);
    
    console.log("Token:", token.address);
    console.log("DeFi Contract:", defi.address);
}

main().catch(console.error);
```

---

## Educational Variations

### 1. Scholarship Fund
- Replace ROI with milestone-based fund releases
- Ranks = Academic achievements
- Referrals = Study group formation

### 2. Course Completion Rewards
- Deposits = Course fees
- ROI = Progress-based token rewards
- Levels = Course modules completed

### 3. Research Grant Pool
- Collective funding for research projects
- Milestone-based fund release
- Peer review system for rank advancement

### 4. Student Loan Pool
- Students contribute to collective pool
- Low-interest loans to members
- Good repayment = rank advancement

---

## Important Considerations

### Legal & Compliance
- DeFi projects may require regulatory compliance
- Investment schemes may be classified as securities
- Consult legal experts before deployment

### Economic Sustainability
- High ROI rates (100% monthly) are unsustainable long-term
- New deposits fund existing user ROIs (Ponzi-like structure)
- Educational versions should use realistic parameters

### Security Audits
- Always audit smart contracts before mainnet
- Use established libraries (OpenZeppelin)
- Implement emergency pause mechanisms

---

## Files & Resources

| Resource | Description |
|----------|-------------|
| `motshelo.sol` | Contract source (V2 with Aave V3 on BSC) |
| USDT (BEP-20) | `0x55d398326f99059fF775485246999027b3197955` (18 decimals) |
| Aave V3 Pool (BSC) | `0x6807dc960D6d17351D069670733D59634f9c169B` |
| aUSDT (aToken) | `0xf6C6361958652d87e07b46187513575975a6c016` |
| OpenZeppelin | Security library: [docs.openzeppelin.com](https://docs.openzeppelin.com) |
| Hardhat | Development framework: [hardhat.org](https://hardhat.org) |
| BSC Testnet | Test deployment: [testnet.bscscan.com](https://testnet.bscscan.com) |

---

## Summary

The Motshelo V2 protocol is a comprehensive, non-custodial DeFi savings coordinator combining:

1. **Savings Circles** - Rotation and savings-split models for group coordination
2. **Aave V3 Yield** - Idle USDC earns interest automatically
3. **Fair Fee Model** - 0% deposits, 2% withdrawals, 60/40 yield split
4. **Institutional Scale** - Supports up to $1M USDC contributions
5. **Soulbound NFTs** - Completion badges for participating members

Key V2 improvements over V1:
- Aave V3 on BSC integration for capital efficiency
- 93.8% reduction in user cost (0.6% vs 9.75%)
- Deposit fees abolished to attract larger inflows
- USDT (BEP-20, 18 decimals) for BSC-native stablecoin support
- `totalPrincipal` tracking for accurate yield accounting
- `getAccruedYield()` and `getAavePosition()` view functions for transparency

---

*Document generated for educational purposes. This analysis does not constitute financial or legal advice.*
