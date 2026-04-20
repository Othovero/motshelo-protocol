# Motshelo Protocol V2: Aave Integration & Revenue Model Update

This technical document outlines the transition of the Motshelo Protocol from a static non-custodial vault to an interest-bearing coordinator utilizing **Aave V3 on Base**. This update focuses on institutional-grade capital efficiency, particularly for high-net-worth users ($100k+ deposits).

---

## 1. Executive Summary

The V2 update pivots the protocol’s revenue model to favor capital retention and yield generation.

* **Idle funds** are now automatically supplied to Aave V3.
* **Deposit fees** are abolished (0%) to lower the barrier to entry for large investors.
* **Yield-sharing** is introduced, with a 60/40 split favoring the protocol treasury.
* **Withdrawal fees** are reduced to a flat 2%.

---

## 2. Updated Architecture

In V1, USDC remained idle in the `MotsheloCircle` contract. In V2, the contract acts as a gateway to Aave V3 Liquidity Pools.

### Component Interaction

1. **MotsheloCircle**: Tracks member balances and principal.
2. **Aave V3 Pool**: Manages the lending/borrowing of the group's pooled USDC.
3. **aBasUSDC (aToken)**: An interest-bearing token held by the Circle contract representing its claim on Aave.

### Contract Registry (Base Mainnet)

| Contract | Address |
| --- | --- |
| **Aave V3 Pool (Proxy)** | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |
| **Native USDC** | `0x833589fCD6eDb6E08f4c7C34381f1ed19eeEFf30` |
| **aBasUSDC (aToken)** | `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB` |

---

## 3. The 60/40 Yield & 2% Fee Model

The goal is to provide a "low-cost entry" for larger investors while ensuring protocol sustainability through yield and exit fees.

### Fee Structure

* **Deposit Fee**: 0% (Optimized for $100k+ inflows).
* **Withdrawal Fee**: 2% (Applied to the **Principal** only).
* **Yield Split**:
* **Protocol Share**: 60% of all interest accrued on Aave.
* **User Share**: 40% of all interest accrued on Aave.



### Revenue Calculation Case Study ($100k Investor)

*Assumptions: $100,000 USDC deposit, 3.5% Aave Supply APY, 1-year duration.*

| Item | Value |
| --- | --- |
| **Initial Principal** | $100,000.00 |
| **Total Yield Accrued (3.5%)** | $3,500.00 |
| **Protocol Yield Share (60%)** | **$2,100.00** |
| **User Yield Share (40%)** | $1,400.00 |
| **Withdrawal Fee (2% of Principal)** | **$2,000.00** |
| **Total Protocol Revenue** | **$4,100.00** |
| **User Final Payout** | **$99,400.00** |

*Note: For the user, the "cost" of the service is effectively reduced from 5% (V1) to 0.6% (V2) due to the yield offset.*

---

## 4. Technical Implementation (Solidity)

The `MotsheloCircle` contract must implement `IPool` interfaces to communicate with Aave.

### Accrued Interest Calculation

Since `aTokens` increase in balance automatically, the contract tracks `totalPrincipal` separately.

```solidity
uint256 public totalPrincipal; // Amount deposited by users

function getAccruedYield() public view returns (uint256) {
    uint256 currentBalance = IERC20(aBasUSDC).balanceOf(address(this));
    if (currentBalance <= totalPrincipal) return 0;
    return currentBalance - totalPrincipal;
}

```

### Withdrawal Logic

When a member withdraws, the contract calculates the 60% protocol cut of the yield and the 2% principal fee.

```solidity
function withdraw(uint256 amount) external {
    uint256 yield = getAccruedYield();
    uint256 protocolYieldShare = (yield * 60) / 100;
    uint256 userYieldShare = yield - protocolYieldShare;

    // 2% Fee on principal
    uint256 exitFee = (amount * 2) / 100;
    
    // Total for User: Principal + 40% Yield - 2% Fee
    uint256 totalPayout = amount + userYieldShare - exitFee;

    // Interaction with Aave
    AAVE_POOL.withdraw(USDC_ADDRESS, type(uint256).max, address(this));
    
    // Transfer funds
    IERC20(USDC).safeTransfer(msg.sender, totalPayout);
    IERC20(USDC).safeTransfer(treasury, exitFee + protocolYieldShare);
}

```

---

## 5. Security & Risk Management

Integrating Aave introduces **Composability Risk**.

1. **Non-Custodial**: Motshelo never takes ownership of the keys to the Aave position; the Circle contract is the sole owner.
2. **Liquidity**: USDC is highly liquid on Base; however, in a "bank run" scenario on Aave, withdrawals could be delayed.
3. **Audits**: Aave V3 is one of the most audited protocols in DeFi history. Motshelo relies on this hardened infrastructure to protect the $100k+ "Whale" deposits.