"use client"

import { Badge } from "@/components/ui/badge"
import { useAllCircles, useCircleCount } from "@/hooks/use-motshelo-factory"
import { useCircleConfig, useCircleStatus, useMemberCount, useAavePosition } from "@/hooks/use-motshelo-circle"
import { useRegistryMetadata } from "@/hooks/use-registry"
import { formatUsdt, shortenAddress, STATUS_LABELS, FREQUENCY_LABELS } from "@/lib/format"
import {
  Search,
  CircleDot,
  Users,
  TrendingUp,
  CheckCircle2,
  Plus,
} from "lucide-react"
import { useState } from "react"

function DiscoverCircleCard({
  circleAddress,
  onOpen,
}: {
  circleAddress: `0x${string}`;
  onOpen: (addr: `0x${string}`) => void;
}) {
  const { data: config } = useCircleConfig(circleAddress)
  const { data: memberCount } = useMemberCount(circleAddress)
  const { data: aave } = useAavePosition(circleAddress)
  const { data: meta } = useRegistryMetadata(circleAddress)

  if (!config) {
    return (
      <div className="rounded-xl bg-card p-4 animate-pulse">
        <div className="h-4 bg-secondary rounded w-1/2 mb-2" />
        <div className="h-3 bg-secondary rounded w-3/4" />
      </div>
    )
  }

  const circleType = Number(config.circleType)
  const contribution = formatUsdt(config.contributionAmount)
  const freq = FREQUENCY_LABELS[config.contributionFrequency.toString()] || "?"
  const members = memberCount ? Number(memberCount) : 0
  const maxMem = Number(config.maxMembers)
  const totalPot = aave ? formatUsdt(aave[1]) : "0.00"
  const yieldAmt = aave ? formatUsdt(aave[2]) : "0.00"
  const name = meta?.name || shortenAddress(circleAddress)
  const verified = meta?.isVerified || false

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
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground">{name}</p>
              {verified && (
                <CheckCircle2 className="size-3.5 text-motshelo-teal" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {members}/{maxMem} members
              <span className="mx-1.5 text-border">|</span>
              {circleType === 0 ? "Rotation" : "Savings"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div>
          <p className="text-xs text-muted-foreground">Contribution</p>
          <p className="text-sm font-bold text-foreground">
            ${contribution}/{freq.toLowerCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total Pot</p>
          <p className="text-sm font-bold text-foreground">${totalPot}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Yield</p>
          <p className="text-sm font-bold text-motshelo-teal">+${yieldAmt}</p>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onOpen(circleAddress)
        }}
        className="mt-3 w-full rounded-lg bg-motshelo-blue/10 py-2 text-xs font-semibold text-motshelo-blue hover:bg-motshelo-blue/20 transition-colors"
      >
        View Circle
      </button>
    </div>
  )
}

export default function DiscoverScreen({
  onCreateCircle,
  onOpenCircle,
}: {
  onCreateCircle: () => void;
  onOpenCircle?: (addr: `0x${string}`) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const { data: circles, isLoading } = useAllCircles(0, 20)

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Discover</h1>
        <button
          onClick={onCreateCircle}
          className="flex items-center gap-1.5 rounded-xl bg-motshelo-blue px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-motshelo-blue/90 transition-colors"
        >
          <Plus className="size-3.5" />
          Create
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search circles by address..."
          className="w-full rounded-xl bg-card pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 ring-1 ring-border focus:ring-motshelo-blue focus:outline-none transition-all"
        />
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-card p-4 animate-pulse">
              <div className="h-4 bg-secondary rounded w-1/2 mb-2" />
              <div className="h-3 bg-secondary rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {circles && circles.length > 0 && (
        <div className="flex flex-col gap-3">
          {circles
            .filter((addr) =>
              searchQuery
                ? addr.toLowerCase().includes(searchQuery.toLowerCase())
                : true
            )
            .map((addr) => (
              <DiscoverCircleCard
                key={addr}
                circleAddress={addr}
                onOpen={onOpenCircle || (() => {})}
              />
            ))}
        </div>
      )}

      {circles && circles.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary mb-3">
            <Search className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No circles found</p>
          <p className="text-xs text-muted-foreground mt-1">Be the first to create one!</p>
        </div>
      )}
    </div>
  )
}
