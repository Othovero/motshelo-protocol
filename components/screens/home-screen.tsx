"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount } from "wagmi"
import { useUserCircles } from "@/hooks/use-motshelo-factory"
import { useUsdtBalance } from "@/hooks/use-usdt"
import { useCircleConfig, useCircleStatus, useAavePosition, useCurrentRound, useCurrentRecipient } from "@/hooks/use-motshelo-circle"
import { formatUsdt, shortenAddress, STATUS_LABELS, CIRCLE_TYPE_LABELS, FREQUENCY_LABELS } from "@/lib/format"
import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  MoreHorizontal,
  Eye,
  EyeOff,
  Sparkles,
  Shield,
  ChevronRight,
  TrendingUp,
  Users,
  CircleDot,
} from "lucide-react"
import { useState } from "react"

function BalanceCard() {
  const [visible, setVisible] = useState(true)
  const { address } = useAccount()
  const { data: balance } = useUsdtBalance(address)

  const displayBalance = balance !== undefined ? formatUsdt(balance) : "0.00"

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[oklch(0.35_0.12_230)] to-[oklch(0.25_0.08_260)] p-5">
      <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-[oklch(0.45_0.15_230/0.2)] blur-2xl" />
      <div className="absolute bottom-0 left-0 h-24 w-24 -translate-x-6 translate-y-6 rounded-full bg-[oklch(0.6_0.14_165/0.15)] blur-2xl" />

      <div className="relative">
        <p className="text-xs text-[oklch(0.8_0.05_230)]">USDT Balance</p>
        <div className="flex items-center gap-3 mt-1">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {visible ? `$${displayBalance}` : "$****.**"}
          </h2>
          <button
            onClick={() => setVisible(!visible)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={visible ? "Hide balance" : "Show balance"}
          >
            {visible ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5 mt-2.5">
          <Sparkles className="size-3 text-motshelo-teal" />
          <span className="text-[11px] text-[oklch(0.75_0.08_165)]">
            Earning yield via Aave V3 across your circles
          </span>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <ActionButton icon={<ArrowUpRight className="size-4" />} label="Send" />
          <ActionButton icon={<ArrowDownLeft className="size-4" />} label="Request" />
          <ActionButton icon={<Plus className="size-4" />} label="Add funds" />
          <ActionButton icon={<MoreHorizontal className="size-4" />} label="More" />
        </div>
      </div>
    </div>
  )
}

function ActionButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex flex-1 flex-col items-center gap-1.5 rounded-xl bg-[oklch(0.3_0.06_230/0.5)] py-2.5 text-foreground hover:bg-[oklch(0.35_0.08_230/0.5)] transition-colors">
      <div className="flex size-8 items-center justify-center rounded-full bg-[oklch(0.4_0.1_230/0.4)]">
        {icon}
      </div>
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  )
}

function NonCustodialBanner() {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-motshelo-glow">
        <Shield className="size-5 text-motshelo-blue" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Non-Custodial Savings</p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
          Your funds are secured by smart contracts. Earn yield via Aave V3.
        </p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
    </div>
  )
}

function CircleCardLive({
  circleAddress,
  onOpen,
}: {
  circleAddress: `0x${string}`;
  onOpen: (addr: `0x${string}`) => void;
}) {
  const { data: config } = useCircleConfig(circleAddress)
  const { data: statusRaw } = useCircleStatus(circleAddress)
  const { data: aave } = useAavePosition(circleAddress)
  const { data: round } = useCurrentRound(circleAddress)

  if (!config) {
    return (
      <div className="rounded-xl bg-card p-4 animate-pulse">
        <div className="h-4 bg-secondary rounded w-1/2 mb-2" />
        <div className="h-3 bg-secondary rounded w-3/4" />
      </div>
    )
  }

  const status = statusRaw !== undefined ? Number(statusRaw) : 0
  const circleType = Number(config.circleType)
  const contributionAmt = formatUsdt(config.contributionAmount)
  const freq = FREQUENCY_LABELS[config.contributionFrequency.toString()] || "?"
  const totalMembers = Number(config.maxMembers)
  const currentRound = round ? Number(round) : 0
  const yieldAmt = aave ? formatUsdt(aave[2]) : "0.00"
  const totalPot = aave ? formatUsdt(aave[1]) : "0.00"

  return (
    <div
      onClick={() => onOpen(circleAddress)}
      className="rounded-xl bg-card p-4 hover:bg-secondary/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-motshelo-glow">
            {circleType === 0 ? (
              <CircleDot className="size-5 text-motshelo-blue" />
            ) : (
              <Users className="size-5 text-motshelo-teal" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground font-mono">
              {shortenAddress(circleAddress)}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalMembers} max
              <span className="mx-1.5 text-border">|</span>
              ${contributionAmt}/{freq.toLowerCase()}
            </p>
          </div>
        </div>
        <Badge
          variant={status === 1 ? "default" : "secondary"}
          className={
            status === 1
              ? "bg-motshelo-teal/15 text-motshelo-teal border-0 text-[10px]"
              : "bg-secondary text-muted-foreground border-0 text-[10px]"
          }
        >
          {STATUS_LABELS[status] || "UNKNOWN"}
        </Badge>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Total Pot</p>
          <p className="text-sm font-bold text-foreground">${totalPot}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Yield</p>
          <p className="text-sm font-bold text-motshelo-teal">+${yieldAmt}</p>
        </div>
      </div>

      {currentRound > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground">
              Round {currentRound}/{totalMembers}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-motshelo-blue transition-all"
              style={{ width: `${Math.min((currentRound / totalMembers) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function MyCirclesSection({ onOpenCircle }: { onOpenCircle: (addr: `0x${string}`) => void }) {
  const { address } = useAccount()
  const { data: circles, isLoading } = useUserCircles(address)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">My Circles</h3>
        {circles && circles.length > 0 && (
          <span className="text-xs text-muted-foreground">{circles.length} total</span>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2.5">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-card p-4 animate-pulse">
              <div className="h-4 bg-secondary rounded w-1/2 mb-2" />
              <div className="h-3 bg-secondary rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {circles && circles.length === 0 && (
        <div className="rounded-xl bg-card p-6 text-center">
          <CircleDot className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No circles yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Join or create a circle to get started
          </p>
        </div>
      )}

      {circles && circles.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {circles.map((addr) => (
            <CircleCardLive key={addr} circleAddress={addr} onOpen={onOpenCircle} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function HomeScreen({ onOpenCircle }: { onOpenCircle?: (addr: `0x${string}`) => void }) {
  const { address } = useAccount()

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-10 ring-2 ring-motshelo-blue/30">
            <AvatarFallback className="bg-motshelo-blue/20 text-motshelo-blue text-sm font-bold">
              {address ? address.slice(2, 4).toUpperCase() : "??"}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs text-muted-foreground">Good morning</p>
            <p className="text-sm font-semibold text-foreground">
              {address ? shortenAddress(address) : "Not connected"}
            </p>
          </div>
        </div>
        <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
      </div>

      <BalanceCard />
      <NonCustodialBanner />
      <MyCirclesSection onOpenCircle={onOpenCircle || (() => {})} />
    </div>
  )
}
