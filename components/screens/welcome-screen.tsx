"use client"

import {
  Shield,
  Users,
  TrendingUp,
  ChevronRight,
  CircleDot,
  Zap,
} from "lucide-react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useAccount } from "wagmi"
import { useEffect, useState } from "react"

const features = [
  {
    icon: Users,
    title: "Community Savings Circles",
    description: "Pool USDT with friends and family in transparent, trustless circles.",
  },
  {
    icon: TrendingUp,
    title: "Earn Yield via Aave V3",
    description: "Your pooled funds earn interest while waiting for payout rounds.",
  },
  {
    icon: Shield,
    title: "Non-Custodial & Secure",
    description: "Smart contracts on BNB Chain hold your funds. No middleman, ever.",
  },
]

interface WelcomeScreenProps {
  onConnect: () => void
  referralCode?: string | null
}

export default function WelcomeScreen({ onConnect, referralCode }: WelcomeScreenProps) {
  const { isConnected } = useAccount()
  const [step, setStep] = useState<"welcome" | "features">("welcome")

  useEffect(() => {
    if (isConnected) {
      onConnect()
    }
  }, [isConnected, onConnect])

  if (step === "features") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
        <div className="flex-1 flex flex-col px-6 pt-12 pb-8">
          <button
            onClick={() => setStep("welcome")}
            className="text-sm text-muted-foreground mb-8 self-start"
          >
            Back
          </button>

          <div className="flex-1 flex flex-col gap-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground text-balance">
                How Motshelo Works
              </h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                A digital stokvel powered by smart contracts on BNB Smart Chain.
              </p>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              {features.map((feature, i) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 rounded-xl bg-card p-4"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-motshelo-glow">
                    <feature.icon className="size-5 text-motshelo-blue" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-motshelo-blue/20 text-[10px] font-bold text-motshelo-blue">
                        {i + 1}
                      </span>
                      <p className="text-sm font-semibold text-foreground">{feature.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-secondary/50 p-4 mt-auto">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">Rotation circles:</span> Each member contributes monthly and takes turns receiving the full pot.{" "}
                <span className="text-foreground font-medium">Savings circles:</span> Everyone saves together and splits the pot + yield at the end.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <ConnectButton label="Connect Wallet" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <div className="flex-1 flex flex-col px-6 pt-16 pb-8">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-motshelo-blue to-[oklch(0.55_0.16_200)] shadow-[0_0_60px_oklch(0.65_0.18_230/0.3)]">
              <CircleDot className="size-12 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <div className="absolute -top-2 -right-2 size-4 rounded-full bg-motshelo-teal/80 animate-pulse" />
            <div className="absolute -bottom-1 -left-3 size-3 rounded-full bg-motshelo-blue/60 animate-pulse [animation-delay:500ms]" />
            <div className="absolute top-1/2 -right-5 size-2.5 rounded-full bg-chart-3/50 animate-pulse [animation-delay:1000ms]" />
          </div>

          <h1 className="text-3xl font-bold text-foreground text-center text-balance">
            Motshelo
          </h1>
          <p className="text-base text-motshelo-blue font-medium mt-1">
            The Digital Stokvel
          </p>
          <p className="text-sm text-muted-foreground mt-3 text-center max-w-[260px] leading-relaxed">
            Pool savings with your community. Earn yield. Build wealth together on-chain.
          </p>

          {referralCode && (
            <div className="flex items-center gap-2 mt-6 rounded-full bg-motshelo-teal/10 border border-motshelo-teal/20 px-4 py-2">
              <Zap className="size-3.5 text-motshelo-teal" />
              <span className="text-xs text-motshelo-teal font-medium">
                Invited with code: {referralCode}
              </span>
            </div>
          )}

          <div className="flex items-center gap-6 mt-8">
            <div className="flex flex-col items-center gap-1">
              <p className="text-lg font-bold text-foreground">$2.4M+</p>
              <p className="text-[10px] text-muted-foreground">Total Value Locked</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col items-center gap-1">
              <p className="text-lg font-bold text-foreground">1,200+</p>
              <p className="text-[10px] text-muted-foreground">Active Members</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col items-center gap-1">
              <p className="text-lg font-bold text-foreground">340+</p>
              <p className="text-[10px] text-muted-foreground">Circles</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-auto">
          <div className="flex justify-center">
            <ConnectButton label="Connect Wallet" />
          </div>

          <button
            onClick={() => setStep("features")}
            className="flex items-center justify-center gap-2 rounded-xl bg-card py-3.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            How does it work?
            <ChevronRight className="size-4 text-muted-foreground" />
          </button>

          <p className="text-[10px] text-muted-foreground text-center mt-2 leading-relaxed">
            By connecting, you agree to the{" "}
            <span className="text-motshelo-blue">Terms of Service</span> and{" "}
            <span className="text-motshelo-blue">Privacy Policy</span>.
            <br />
            Powered by BNB Smart Chain &middot; Aave V3
          </p>
        </div>
      </div>
    </div>
  )
}
