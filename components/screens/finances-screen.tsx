"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { useUserCircles } from "@/hooks/use-motshelo-factory"
import { useUsdtBalance } from "@/hooks/use-usdt"
import { useAavePosition, useCircleConfig } from "@/hooks/use-motshelo-circle"
import { formatUsdt, shortenAddress, FREQUENCY_LABELS } from "@/lib/format"
import {
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Info,
  Sparkles,
  ChevronRight,
  Calculator,
  Users,
  Coins,
  ChevronDown,
  CircleDot,
  Wallet,
} from "lucide-react"

function WalletOverview() {
  const { address } = useAccount()
  const { data: balance } = useUsdtBalance(address)
  const { data: circles } = useUserCircles(address)

  return (
    <div className="rounded-xl bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-motshelo-blue/15">
            <Wallet className="size-3 text-motshelo-blue" />
          </div>
          <span className="text-sm text-muted-foreground">Wallet Balance</span>
        </div>
        <button className="text-muted-foreground hover:text-foreground" aria-label="Info">
          <Info className="size-4" />
        </button>
      </div>
      <h2 className="text-3xl font-bold text-foreground mt-2">
        ${balance !== undefined ? formatUsdt(balance) : "0.00"}
      </h2>
      <p className="text-xs text-muted-foreground mt-1">
        USDT &middot; {circles ? circles.length : 0} active circles
      </p>
    </div>
  )
}

function CircleYieldRow({ circleAddress }: { circleAddress: `0x${string}` }) {
  const { data: aave } = useAavePosition(circleAddress)
  const { data: config } = useCircleConfig(circleAddress)

  const principal = aave ? formatUsdt(aave[0]) : "0.00"
  const balance = aave ? formatUsdt(aave[1]) : "0.00"
  const yieldAmt = aave ? formatUsdt(aave[2]) : "0.00"
  const freq = config
    ? FREQUENCY_LABELS[config.contributionFrequency.toString()] || ""
    : ""

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex size-10 items-center justify-center rounded-full bg-motshelo-blue/15">
        <CircleDot className="size-4 text-motshelo-blue" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground font-mono">
          {shortenAddress(circleAddress)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Principal: ${principal} &middot; {freq}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-motshelo-teal">+${yieldAmt}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Yield</p>
      </div>
    </div>
  )
}

function YieldOverview() {
  const { address } = useAccount()
  const { data: circles } = useUserCircles(address)

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">Yield by Circle</h3>
        <div className="flex items-center gap-1">
          <TrendingUp className="size-3 text-motshelo-teal" />
          <span className="text-xs text-motshelo-teal font-medium">Aave V3</span>
        </div>
      </div>

      {circles && circles.length > 0 ? (
        <div className="rounded-xl bg-card divide-y divide-border">
          {circles.map((addr) => (
            <CircleYieldRow key={addr} circleAddress={addr} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-card p-6 text-center">
          <TrendingUp className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No yield data yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Join a circle to start earning yield via Aave V3
          </p>
        </div>
      )}
    </section>
  )
}

function AIInsightCard() {
  return (
    <div className="rounded-xl bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex size-7 items-center justify-center rounded-full bg-chart-3/15">
          <Sparkles className="size-3.5 text-chart-3" />
        </div>
        <h4 className="text-sm font-semibold text-foreground">AI Insight</h4>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Your funds are earning yield in Aave V3 while in savings circles. The 40/60 split means 40% of yield goes to members and 60% supports the protocol.
      </p>
      <button className="flex items-center gap-1 mt-3 text-xs font-medium text-motshelo-blue hover:text-motshelo-blue/80 transition-colors">
        Show more insights
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  )
}

type Frequency = "Weekly" | "Monthly"
type Duration = "1" | "3" | "6" | "12"

const AAVE_APY = 3.5
const YIELD_USER_SHARE = 0.4
const WITHDRAWAL_FEE = 0.02

function YieldCalculator() {
  const [open, setOpen] = useState(false)
  const [contribution, setContribution] = useState("100")
  const [members, setMembers] = useState("8")
  const [frequency, setFrequency] = useState<Frequency>("Monthly")
  const [duration, setDuration] = useState<Duration>("6")

  const contributionNum = parseFloat(contribution) || 0
  const membersNum = parseInt(members) || 1
  const durationNum = parseInt(duration) || 1

  const cyclesPerMonth = frequency === "Weekly" ? 4 : 1
  const totalCycles = cyclesPerMonth * durationNum
  const totalPot = contributionNum * membersNum * totalCycles
  const yourContributions = contributionNum * totalCycles
  const avgBalance = totalPot / 2
  const yieldEarned = avgBalance * (AAVE_APY / 100) * (durationNum / 12)
  const yourYieldShare = yieldEarned * YIELD_USER_SHARE * (1 / membersNum)
  const expectedReturn = yourContributions + yourYieldShare
  const netGain = yourYieldShare
  const withdrawalCost = yourContributions * WITHDRAWAL_FEE

  const durationLabels: Record<Duration, string> = { "1": "1 Month", "3": "3 Months", "6": "6 Months", "12": "1 Year" }

  return (
    <div className="rounded-xl bg-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-motshelo-blue/15">
            <Calculator className="size-4 text-motshelo-blue" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">Yield Calculator</p>
            <p className="text-[10px] text-muted-foreground">Project your circle returns</p>
          </div>
        </div>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4">
          <div className="h-px bg-border" />
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Contribution (USDT)</label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input type="number" value={contribution} onChange={(e) => setContribution(e.target.value)} className="w-full rounded-lg bg-secondary pl-10 pr-4 py-2.5 text-sm text-foreground ring-1 ring-border focus:ring-motshelo-blue focus:outline-none" placeholder="100" min="1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Number of Members</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input type="number" value={members} onChange={(e) => setMembers(e.target.value)} className="w-full rounded-lg bg-secondary pl-10 pr-4 py-2.5 text-sm text-foreground ring-1 ring-border focus:ring-motshelo-blue focus:outline-none" placeholder="8" min="2" max="50" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Frequency</label>
            <div className="flex gap-2">
              {(["Weekly", "Monthly"] as Frequency[]).map((f) => (
                <button key={f} onClick={() => setFrequency(f)} className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${frequency === f ? "bg-motshelo-blue text-primary-foreground" : "bg-secondary text-muted-foreground ring-1 ring-border"}`}>{f}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Duration</label>
            <div className="flex gap-2">
              {(["1", "3", "6", "12"] as Duration[]).map((d) => (
                <button key={d} onClick={() => setDuration(d)} className={`flex-1 rounded-lg py-2 text-[11px] font-medium transition-all ${duration === d ? "bg-motshelo-blue text-primary-foreground" : "bg-secondary text-muted-foreground ring-1 ring-border"}`}>{durationLabels[d]}</button>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-secondary/60 p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Your contributions</span><span className="text-sm font-semibold text-foreground">${yourContributions.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Circle total pot</span><span className="text-sm font-semibold text-foreground">${totalPot.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Est. yield (your 40% share)</span><span className="text-sm font-semibold text-motshelo-teal">+${yourYieldShare.toFixed(2)}</span></div>
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Withdrawal fee (2%)</span><span className="text-sm text-destructive font-medium">-${withdrawalCost.toFixed(2)}</span></div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-foreground">Expected return</span><span className="text-base font-bold text-foreground">${expectedReturn.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Net gain</span><div className="flex items-center gap-1"><TrendingUp className="size-3 text-motshelo-teal" /><span className="text-sm font-bold text-motshelo-teal">+${netGain.toFixed(2)}</span></div></div>
          </div>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            Based on ~{AAVE_APY}% APY via Aave V3 on BNB Smart Chain. Actual yields may vary. 40/60 split: 40% to members, 60% to protocol reserve.
          </p>
        </div>
      )}
    </div>
  )
}

export default function FinancesScreen() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <h1 className="text-2xl font-bold text-foreground">Finances</h1>
      <WalletOverview />
      <YieldOverview />
      <YieldCalculator />
      <AIInsightCard />
    </div>
  )
}
