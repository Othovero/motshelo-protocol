# Motshelo Protocol V2 — Security Audit & Change Log

**Audit Date:** February 26, 2026
**Scope:** V1 → V2 migration: Aave V3 integration, fee model restructuring
**File:** `motshelo.sol`
**Chain:** BNB Smart Chain (BSC)

---

## 1. Executive Summary

The V2 update transforms MotsheloCircle from a static non-custodial vault into an interest-bearing coordinator via **Aave V3 on BSC**. All idle USDT (BEP-20, 18 decimals) is automatically supplied to Aave V3 Lending Pools, generating yield that is split 60/40 between the protocol and users. Deposit fees are abolished (0%), and withdrawal fees are reduced to a flat 2% on principal.

### Risk Rating

| Category | V1 Rating | V2 Rating | Notes |
|---|---|---|---|
| **Smart Contract Risk** | Low | Medium | Aave composability introduces external dependency |
| **Centralization Risk** | Low | Low | Unchanged — non-custodial model preserved |
| **Economic Risk** | Low | Low-Medium | Yield variability, potential Aave liquidity constraints |
| **Operational Risk** | Low | Low | No new admin powers over user funds |

---

## 2. Change Inventory

### 2.1 New External Dependencies

| Component | Address (BSC Mainnet) | Risk |
|---|---|---|
| **Aave V3 Pool (BSC)** | `0x6807dc960D6d17351D069670733D59634f9c169B` | Battle-tested, multiple audits |
| **USDT (BEP-20, 18 decimals)** | `0x55d398326f99059fF775485246999027b3197955` | Binance-pegged stablecoin |
| **aUSDT (aToken)** | `0xf6C6361958652d87e07b46187513575975a6c016` | Rebasing interest-bearing receipt |

### 2.2 New Interface

```solidity
interface IPool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}
```

**Assessment:** Minimal interface surface. Only `supply` and `withdraw` are used — no borrowing, no flash loans, no complex interactions. This limits composability risk.

### 2.3 Constant Changes

| Constant | V1 Value | V2 Value | Rationale |
|---|---|---|---|
| `FEE_BPS` | 500 (5%) | **Removed** | Replaced by granular fee constants |
| `WITHDRAWAL_FEE_BPS` | N/A | 200 (2%) | Flat 2% on principal withdrawals |
| `PROTOCOL_YIELD_BPS` | N/A | 6000 (60%) | Protocol's share of Aave yield |
| `MAX_CONTRIBUTION` | 5,000 USDT | 1,000,000 USDT | Accommodates institutional deposits ($100k+); now 18-decimal |

### 2.4 New State Variables

| Variable | Type | Purpose |
|---|---|---|
| `aavePool` | `IPool immutable` | Aave V3 Pool reference |
| `aToken` | `IERC20 immutable` | aUSDT interest-bearing receipt token |
| `totalPrincipal` | `uint256` | Principal supplied to Aave (excludes yield) |

### 2.5 New Events

| Event | Purpose |
|---|---|
| `YieldHarvested(circle, totalYield, protocolShare, userShare)` | Emitted on every yield distribution |
| `AaveSupplied(circle, amount)` | Tracks USDC supplied to Aave |
| `AaveWithdrawn(circle, amount)` | Tracks USDC withdrawn from Aave |

### 2.6 New View Functions

| Function | Purpose |
|---|---|
| `getAccruedYield()` | Returns `aToken.balanceOf(this) - totalPrincipal` |
| `getAavePosition()` | Returns principal, aToken balance, and accrued yield |

---

## 3. Function-Level Audit

### 3.1 `join()` — MODIFIED

**V1 Behavior:** Charged 5% deposit fee, kept net in contract.
**V2 Behavior:** 0% fee, full amount supplied to Aave.

| Check | Status | Notes |
|---|---|---|
| Fee removal | PASS | No fee calculation, full amount to member |
| Aave supply | PASS | `_supplyToAave()` called after transfer |
| `totalPrincipal` tracking | PASS | Incremented inside `_supplyToAave` |
| `totalDeposited` tracking | PASS | Incremented by full amount (was net in V1) |
| Reentrancy | PASS | `nonReentrant` modifier preserved |
| Whitelist/visibility | PASS | Unchanged |

### 3.2 `contribute()` — MODIFIED

**V1 Behavior:** Charged 5% deposit fee, kept net in contract.
**V2 Behavior:** 0% fee, full amount supplied to Aave.

| Check | Status | Notes |
|---|---|---|
| Fee removal | PASS | No fee calculation, full amount to member |
| Aave supply | PASS | `_supplyToAave()` called after transfer |
| `netContributionsThisRound` | PASS | Tracks full amount (was net in V1) |
| Round tracking | PASS | `contributionsThisRound` incremented correctly |
| Reentrancy | PASS | `nonReentrant` modifier preserved |

### 3.3 `triggerPayout()` — MODIFIED (Critical)

**V1 Behavior:** 5% fee on pot, community reserve deducted, net to recipient.
**V2 Behavior:** 2% fee on pot, 60/40 yield split, Aave withdraw, net + user yield to recipient.

| Check | Status | Notes |
|---|---|---|
| Yield calculation | PASS | `getAccruedYield()` uses aToken balance - totalPrincipal |
| Protocol yield share (60%) | PASS | `(yield * 6000) / 10000` |
| User yield share (40%) | PASS | `yield - protocolYieldShare` (avoids rounding loss) |
| Withdrawal fee (2%) | PASS | `(grossPot * 200) / 10000` |
| Community reserve | PASS | Unchanged from V1 |
| Net payout formula | PASS | `grossPot - wFee - communityReserve + userYieldShare` |
| Aave withdrawal | PASS | Withdraws `grossPot + yield` (exact amount needed) |
| `totalPrincipal` update | PASS | Decremented by `grossPot` (principal portion only) |
| Fee flush | PASS | All fees (withdrawal + community + protocol yield) flushed |
| Inactive recipient skip | PASS | Logic unchanged from V1 |
| Round advancement | PASS | Logic unchanged from V1 |
| Reentrancy | PASS | `nonReentrant` modifier preserved |

**Risk:** If Aave liquidity is insufficient, `withdraw()` could revert, blocking payouts. Mitigation: USDT is highly liquid on BSC; this is an edge-case "bank run" scenario.

### 3.4 `triggerSplit()` — MODIFIED (Critical)

**V1 Behavior:** 5% fee per share, contract balance split.
**V2 Behavior:** 2% fee on each member's principal, 60/40 yield split, full Aave withdrawal.

| Check | Status | Notes |
|---|---|---|
| Full Aave withdrawal | PASS | `type(uint256).max` withdraws entire aToken balance |
| `totalPrincipal` reset | PASS | Set to 0 after full withdrawal |
| Protocol yield share | PASS | Added to `accumulatedFees` before distribution |
| Distributable pool | PASS | `token.balanceOf(this) - accumulatedFees` |
| Per-member fee | PASS | 2% on `data.contributed` (actual principal, not share) |
| Proportional split | PASS | Yield naturally distributed via proportional share of pool |
| Equal split | PASS | Each member gets equal share of distributable pool |
| Dust handling | PASS | Remainder sent to last active member (unchanged) |
| Reentrancy | PASS | `nonReentrant` modifier preserved |

### 3.5 `exitEarly()` — MODIFIED

**V1 Behavior:** 5% fee on refund, capped to available balance.
**V2 Behavior:** 2% fee on principal, proportional yield share (40%), Aave withdrawal.

| Check | Status | Notes |
|---|---|---|
| Aave balance cap | PASS | `refundAmount` capped to `aToken.balanceOf(this)` |
| Proportional yield | PASS | `(yield * refundAmount) / totalPrincipal` |
| Yield split | PASS | 60% protocol, 40% user on member's portion |
| Aave withdrawal | PASS | Withdraws `refundAmount + memberYieldPortion` |
| `totalPrincipal` update | PASS | Decremented by `refundAmount` |
| Fee flush | PASS | Fees flushed after transfer |
| Round contribution rollback | PASS | Logic unchanged from V1 |
| Rotation removal | PASS | `_removeFromRotation` called (unchanged) |
| Reentrancy | PASS | `nonReentrant` modifier preserved |

**Risk:** Division by zero if `totalPrincipal == 0`. Mitigated by ternary check.

### 3.6 `_supplyToAave()` — NEW

| Check | Status | Notes |
|---|---|---|
| Zero-amount guard | PASS | Returns early if amount is 0 |
| Token approval | PASS | Uses `forceApprove` (OZ v5 SafeERC20) — resets allowance first |
| Supply call | PASS | `referralCode = 0` (no Aave referral) |
| Principal tracking | PASS | `totalPrincipal += amount` |
| Event emission | PASS | `AaveSupplied` emitted |

### 3.7 `_withdrawFromAave()` — NEW

| Check | Status | Notes |
|---|---|---|
| Zero-amount guard | PASS | Returns 0 if amount is 0 |
| Withdrawal | PASS | Returns actual withdrawn amount from Aave |
| Event emission | PASS | `AaveWithdrawn` emitted |
| No principal tracking | BY DESIGN | Caller manages `totalPrincipal` for flexibility |

### 3.8 `getAccruedYield()` — NEW

| Check | Status | Notes |
|---|---|---|
| Underflow protection | PASS | Returns 0 if `aToken balance <= totalPrincipal` |
| View function | PASS | No state modification |

### 3.9 `_completeCircle()` — MODIFIED

**V2 Addition:** Withdraws all remaining Aave funds on circle completion, flushes as protocol revenue.

| Check | Status | Notes |
|---|---|---|
| Aave cleanup | PASS | Withdraws `type(uint256).max` if aToken balance > 0 |
| `totalPrincipal` reset | PASS | Set to 0 |
| Remaining balance | PASS | Added to `accumulatedFees` and flushed |
| NFT minting | PASS | Logic unchanged from V1 |

### 3.10 `activate()` — UNCHANGED

No changes. Functions identically to V1.

### 3.11 `applyMissPenalty()` — UNCHANGED

No changes. Slash redistribution is accounting-only (changes `contributed` values). Funds remain in Aave. Works correctly in V2 context.

### 3.12 `pauseCircle()` / `unpauseCircle()` — UNCHANGED

No changes.

---

## 4. Factory Changes

### 4.1 New State Variables

| Variable | Type | Purpose |
|---|---|---|
| `aavePool` | `address` | Passed to new circles |
| `aToken` | `address` | Passed to new circles |

### 4.2 Constructor — MODIFIED

Now requires `_aavePool` and `_aToken` parameters. Both validated as non-zero.

### 4.3 `createCircle()` — MODIFIED

Passes `aavePool` and `aToken` to `MotsheloCircle` constructor.

### 4.4 `updateAaveConfig()` — NEW

| Check | Status | Notes |
|---|---|---|
| Owner-only | PASS | `onlyOwner` modifier |
| Zero-address validation | PASS | Both params validated |
| Event emission | PASS | `AaveConfigUpdated` emitted |

**Note:** Changing Aave config only affects NEW circles. Existing circles use immutable references.

---

## 5. Unchanged Contracts

| Contract | Changes | Notes |
|---|---|---|
| **FeeCollector** | None | Receives fees identically (just different amounts) |
| **MotsheloRegistry** | None | No fee/yield awareness needed |
| **MotsheloNFT** | None | Badge minting logic unchanged |

---

## 6. Security Considerations

### 6.1 Composability Risk (NEW in V2)

**Risk:** Aave V3 pool could be exploited, paused, or become illiquid.
**Impact:** Circle withdrawals/payouts would revert until Aave recovers.
**Mitigation:**
- Aave V3 is one of the most audited protocols in DeFi (Trail of Bits, OpenZeppelin, SigmaPrime, Certora)
- USDT on BSC has deep liquidity
- Circle creator can `pauseCircle()` during Aave disruptions
- Members can still `exitEarly()` when paused (existing V1 safety feature)

### 6.2 Yield Accounting Integrity

**Risk:** `totalPrincipal` drift causing incorrect yield calculations.
**Analysis:**
- `totalPrincipal` is incremented ONLY in `_supplyToAave()` (called from `join()`, `contribute()`)
- `totalPrincipal` is decremented in `triggerPayout()` (by pot), `exitEarly()` (by refund), `_completeCircle()` (to 0), `triggerSplit()` (to 0)
- All paths are covered; no orphaned principal tracking

**Risk:** Rounding errors in yield split.
**Mitigation:** `userYieldShare = yield - protocolYieldShare` ensures no dust is lost (protocol absorbs rounding).

### 6.3 Front-Running

**Risk:** MEV bots could sandwich Aave supply/withdraw calls.
**Impact:** Negligible — USDT has minimal slippage on Aave, and supply/withdraw are not price-sensitive operations.

### 6.4 Token Approval Safety

**Analysis:** Uses `forceApprove` (OpenZeppelin SafeERC20 v5) which resets allowance to 0 before setting new value. This prevents the approval front-running attack on tokens with non-standard approve behavior.

### 6.5 Aave Withdrawal Edge Cases

**Scenario:** Aave pool doesn't have enough liquidity to fulfill withdrawal.
**Behavior:** `aavePool.withdraw()` will revert, blocking the Motshelo operation.
**Impact:** Temporary — resolves when Aave liquidity normalizes.
**Recommendation:** Frontend should display Aave utilization rate warnings.

### 6.6 Non-Custodial Preservation

| Property | V1 | V2 | Status |
|---|---|---|---|
| Admin cannot access user funds | Yes | Yes | PRESERVED |
| Circle contracts are immutable | Yes | Yes | PRESERVED |
| Creator limited to lifecycle mgmt | Yes | Yes | PRESERVED |
| No upgrade path for circles | Yes | Yes | PRESERVED |
| Aave position owned by circle | N/A | Yes | Circle contract is sole owner of its Aave position |

---

## 7. Economic Model Comparison

### 7.1 Fee Impact ($100,000 Deposit, 3.5% APY, 1 Year)

| Metric | V1 | V2 | Change |
|---|---|---|---|
| **Deposit Fee** | $5,000 (5%) | $0 (0%) | -100% |
| **Effective Principal** | $95,000 | $100,000 | +5.3% |
| **Aave Yield** | $0 | $3,500 | NEW |
| **Protocol Yield Share** | $0 | $2,100 (60%) | NEW |
| **User Yield Share** | $0 | $1,400 (40%) | NEW |
| **Withdrawal Fee** | $4,750 (5% of $95k) | $2,000 (2% of $100k) | -57.9% |
| **Total Protocol Revenue** | $9,750 | $4,100 | -57.9% |
| **User Net Cost** | $9,750 (9.75%) | $600 (0.6%) | -93.8% |

### 7.2 Break-Even Analysis

Protocol revenue per $100k at 3.5% APY:
- V2 annual revenue: $4,100 (vs V1: $9,750)
- V2 requires ~2.4x more TVL to match V1 revenue
- V2 optimizes for volume over margin — designed to attract institutional capital

---

## 8. Deployment Checklist

- [ ] Verify Aave V3 Pool address on BSC: `0x6807dc960D6d17351D069670733D59634f9c169B`
- [ ] Verify aUSDT address on BSC: `0xf6C6361958652d87e07b46187513575975a6c016`
- [ ] Verify USDT (BEP-20) address on BSC: `0x55d398326f99059fF775485246999027b3197955`
- [ ] Confirm USDT uses 18 decimals — all contribution amounts must use 18-decimal precision
- [ ] Deploy FeeCollector with deployer as temporary factory
- [ ] Deploy MotsheloFactory with all params including Aave config
- [ ] Wire FeeCollector → Factory
- [ ] Deploy Registry and NFT
- [ ] Wire Factory → Dependencies
- [ ] Approve USDC token
- [ ] Fund VRF subscription
- [ ] Test on BSC Testnet before mainnet
- [ ] Verify all contracts on BscScan

---

## 9. Recommendations

1. **Monitoring:** Set up alerts for `YieldHarvested` events to track protocol revenue in real-time.
2. **Circuit Breaker:** Consider adding an emergency withdrawal function that bypasses Aave if Aave is paused/broken (future upgrade for Factory-level emergency).
3. **Yield Display:** Frontend should show real-time yield via `getAavePosition()` and `getAccruedYield()`.
4. **Aave Health:** Frontend should monitor Aave USDC utilization rate and warn users if > 90%.
5. **Gas Optimization:** `triggerPayout()` now makes 2 external calls to Aave (withdraw) + 2 transfers. Consider batching for gas savings in future versions.

---

## 10. Conclusion

The V2 update is **architecturally sound**. The Aave integration follows best practices (minimal interface, proper approval patterns, non-custodial ownership). The fee model change from 5%/5% to 0%/2%+yield is economically coherent for attracting larger deposits. All V1 security properties (non-custodial, reentrancy-safe, access-controlled) are preserved. The primary new risk vector — Aave composability — is mitigated by Aave's extensive audit history and USDT's deep liquidity on BSC.

**Decimal Note:** USDT on BSC uses 18 decimals. All BPS-based fee/yield math (`WITHDRAWAL_FEE_BPS`, `PROTOCOL_YIELD_BPS`, `SLASH_PERCENTAGE`, `communityReserveBps`) operates on ratios via `BPS_DENOMINATOR = 10000`, which is decimal-agnostic and works correctly at any precision.

**Verdict:** PASS — Ready for testnet deployment and further third-party audit.
