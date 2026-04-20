"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { shortenAddress } from "@/lib/format"
import {
  Users,
  Copy,
  Check,
  ChevronRight,
  CircleDot,
  Share2,
  UserPlus,
  Link2,
} from "lucide-react"

function NetworkStats() {
  const stats = [
    { label: "Invited", value: 0, icon: UserPlus },
    { label: "Active", value: 0, icon: Users },
    { label: "Circles Made", value: 0, icon: CircleDot },
  ]

  return (
    <div className="flex gap-2">
      {stats.map((s) => (
        <div key={s.label} className="flex-1 rounded-xl bg-card p-3 flex flex-col items-center gap-1.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-motshelo-blue/15">
            <s.icon className="size-4 text-motshelo-blue" />
          </div>
          <p className="text-lg font-bold text-foreground">{s.value}</p>
          <p className="text-[10px] text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

function ReferralCodeCard() {
  const { address } = useAccount()
  const [copied, setCopied] = useState(false)

  const referralLink = address
    ? `${typeof window !== "undefined" ? window.location.origin : ""}?ref=${address}`
    : ""

  const handleCopy = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-[oklch(0.35_0.12_230)] to-[oklch(0.25_0.08_260)] p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-[oklch(0.45_0.15_230/0.2)] blur-2xl" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="size-4 text-[oklch(0.8_0.05_230)]" />
          <p className="text-xs text-[oklch(0.8_0.05_230)]">Your Referral Link</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-lg bg-[oklch(0.2_0.04_230/0.6)] px-4 py-2.5 overflow-hidden">
            <p className="text-sm font-medium text-foreground tracking-wider font-mono truncate">
              {address ? shortenAddress(address) : "Connect wallet"}
            </p>
          </div>
          <button
            onClick={handleCopy}
            disabled={!address}
            className="flex size-10 items-center justify-center rounded-lg bg-motshelo-blue text-primary-foreground hover:bg-motshelo-blue/90 transition-colors shrink-0 disabled:opacity-40"
            aria-label="Copy referral link"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </div>

        <button className="flex items-center gap-2 mt-3 text-xs font-medium text-motshelo-teal hover:text-motshelo-teal/80 transition-colors">
          <Share2 className="size-3.5" />
          Share invite link
        </button>
      </div>
    </div>
  )
}

export default function NetworkScreen() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Network</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Grow the Motshelo community. Invite friends using your wallet address as a referrer.
        </p>
      </div>

      <ReferralCodeCard />
      <NetworkStats />

      <div className="rounded-xl bg-card p-6 text-center">
        <Users className="size-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium text-foreground">Referral tracking coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">
          On-chain referral data from MemberJoined events will be indexed here.
        </p>
      </div>

      <button className="flex items-center justify-center gap-2 rounded-xl bg-motshelo-blue py-3.5 text-sm font-semibold text-primary-foreground hover:bg-motshelo-blue/90 transition-colors">
        <UserPlus className="size-4" />
        Invite Someone New
      </button>
    </div>
  )
}
