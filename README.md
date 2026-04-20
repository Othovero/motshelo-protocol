# Motshelo Protocol

A decentralized savings circle (stokvel/chama) protocol on BNB Smart Chain. Groups pool USDT, earn Aave V3 yield on idle funds, and rotate payouts trustlessly — no custodian, no admin keys.

## What It Does

- **Savings circles**: members join, contribute each round, one member gets the pot per round
- **Automatic yield**: idle USDT is supplied to Aave V3, earning interest for the group
- **Fee model**: 0% deposit fee · 2% withdrawal fee · 60/40 Aave yield split (protocol/users)
- **Fully on-chain**: smart contract is the only custodian

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, wagmi, MetaMask SDK |
| Smart Contracts | Solidity, Hardhat, TypeChain |
| Yield | Aave V3 on BSC |
| Token | USDT (BEP-20, 18 decimals) |

## Project Structure

```
motshelo-protocol/
├── app/                        # Next.js app router
├── components/
│   ├── screens/                # UI screens (home, create, circle detail, etc.)
│   └── ui/                     # shadcn/ui components
├── hooks/                      # wagmi read/write hooks
├── lib/
│   └── contracts/
│       ├── abis.ts             # Contract ABIs for wagmi
│       └── addresses.ts        # Deployed contract addresses (auto-generated locally)
├── contracts/                  # Hardhat project
│   ├── contracts/
│   │   ├── motshelo.sol        # Main protocol contract
│   │   └── mocks/MockAave.sol  # MockUSDT + MockAave for local dev
│   ├── scripts/
│   │   ├── deploy-local.ts     # Local deploy (mocks + funds test wallets)
│   │   ├── deploy.ts           # Production deploy (BSC mainnet/testnet)
│   │   └── export-abi.ts       # Export ABIs from artifacts
│   └── test/Motshelo.test.ts   # 5 unit tests (~1s, all pass)
├── motshelo.sol                # Source contract reference
├── DEPLOYMENT_GUIDE.md         # Full deployment + local dev guide
├── MOTSHELO_DOCS.md            # Technical architecture docs
└── MOTSHELO_V2_AUDIT.md        # Security audit log
```

## Quick Start (Local Dev)

No real money. Everything runs on your machine with mock contracts.

**Terminal 1 — start local blockchain:**
```bash
cd contracts
npx hardhat node
```

**Terminal 2 — deploy contracts + fund test wallets:**
```bash
cd contracts
npx hardhat run scripts/deploy-local.ts --network localhost
```

**Terminal 3 — start frontend:**
```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### MetaMask Setup

Add a network in MetaMask:
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `56`
- Currency: `BNB`

Import a test account (each has 100,000 USDT + 10,000 BNB):

| Account | Address | Private Key |
|---------|---------|-------------|
| #0 deployer | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| #1 alice | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| #2 bob | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

> These are public Hardhat test keys — never use them on mainnet.

## Run Tests

```bash
cd contracts
npx hardhat test
```

```
  Motshelo Protocol (unit tests with mocks)
    ✓ deploys and wires protocol dependencies
    ✓ creates a circle, joins members, and activates
    ✓ handles payout and fee split with mocked yield
    ✓ applies 2% early-exit fee and blocks exit when disabled
    ✓ registers metadata on circle creation

  5 passing (1s)
```

## Environment Variables

**`contracts/.env`** (never commit — copy from `.env.example`):
```env
DEPLOYER_PRIVATE_KEY=0x...
BSC_RPC_URL=https://bsc-mainnet.nodereal.io/v1/YOUR_KEY
BSCSCAN_API_KEY=YOUR_KEY
VRF_SUBSCRIPTION_ID=0
FORK_BSC=          # set to "true" to fork BSC mainnet locally
```

**`.env.local`** (root, never commit):
```env
NEXT_PUBLIC_WC_PROJECT_ID=YOUR_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_USE_LOCAL=true
```

## Architecture

```
MotsheloFactory  ──deploys──▶  MotsheloCircle  ──supply/withdraw──▶  Aave V3
      │                               │
      ▼                               ▼
MotsheloRegistry              FeeCollector (2% fees + 60% yield)
      │
      ▼
MotsheloNFT (soulbound badge on cycle completion)
```

See [`MOTSHELO_DOCS.md`](./MOTSHELO_DOCS.md) for full architecture and contract reference.  
See [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) for testnet/mainnet deployment steps.  
See [`MOTSHELO_V2_AUDIT.md`](./MOTSHELO_V2_AUDIT.md) for the security audit log.

## Circle Lifecycle

1. **Create** — set contribution amount, member limit, payout order
2. **Join** — members join and lock in their contribution commitment
3. **Activate** — creator activates once minimum members have joined
4. **Contribute** — members contribute each round; USDT flows to Aave
5. **Payout** — recipient receives the round pot (minus 2% fee)
6. **Repeat** — until all members have received a payout
7. **Exit** — members can exit early (98% refund)

## Deploy to BSC

**Testnet:**
```bash
cd contracts
npx hardhat run scripts/deploy.ts --network bscTestnet
```

**Mainnet:**
```bash
cd contracts
npx hardhat run scripts/deploy.ts --network bsc
```

Check [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) for the full pre-flight checklist before mainnet.

## License

MIT
