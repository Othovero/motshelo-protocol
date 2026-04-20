"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import NetworkGuard from "@/components/network-guard"
import BottomNav, { type Tab } from "@/components/bottom-nav"
import HomeScreen from "@/components/screens/home-screen"
import FinancesScreen from "@/components/screens/finances-screen"
import CircleDetailScreen from "@/components/screens/circle-detail-screen"
import CreateCircleScreen from "@/components/screens/create-circle-screen"
import NetworkScreen from "@/components/screens/network-screen"
import DiscoverScreen from "@/components/screens/discover-screen"
import WelcomeScreen from "@/components/screens/welcome-screen"

type Screen = "main" | "circle-detail" | "create-circle"

export default function MotsheloApp() {
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<Tab>("home")
  const [screen, setScreen] = useState<Screen>("main")
  const [selectedCircle, setSelectedCircle] = useState<`0x${string}` | undefined>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const referralCode = searchParams.get("ref")
  const circleParam = searchParams.get("circle")

  useEffect(() => {
    if (circleParam && /^0x[a-fA-F0-9]{40}$/.test(circleParam)) {
      setSelectedCircle(circleParam as `0x${string}`)
      setScreen("circle-detail")
    }
  }, [circleParam])

  if (!isConnected) {
    return <WelcomeScreen onConnect={() => {}} referralCode={referralCode} />
  }

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    setScreen("main")
    router.replace("/")
  }

  const handleOpenCircle = (circleAddress: `0x${string}`) => {
    setSelectedCircle(circleAddress)
    setScreen("circle-detail")
    router.replace(`/?circle=${circleAddress}`)
  }

  if (screen === "circle-detail") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
        <NetworkGuard />
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
          <CircleDetailScreen
            onBack={() => { setScreen("main"); router.replace("/") }}
            circleAddress={selectedCircle}
          />
        </main>
        <BottomNav active={activeTab} onChange={handleTabChange} />
      </div>
    )
  }

  if (screen === "create-circle") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
        <NetworkGuard />
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
          <CreateCircleScreen onBack={() => setScreen("main")} />
        </main>
        <BottomNav active={activeTab} onChange={handleTabChange} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <NetworkGuard />
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {activeTab === "home" && <HomeScreen onOpenCircle={handleOpenCircle} />}
        {activeTab === "discover" && (
          <DiscoverScreen
            onCreateCircle={() => setScreen("create-circle")}
            onOpenCircle={handleOpenCircle}
          />
        )}
        {activeTab === "finance" && <FinancesScreen />}
        {activeTab === "network" && <NetworkScreen />}
        {activeTab === "more" && <MoreScreen />}
      </main>
      <BottomNav active={activeTab} onChange={handleTabChange} />
    </div>
  )
}

function MoreScreen() {
  const items = [
    { label: "Settings", description: "Manage your wallet and preferences" },
    { label: "Security", description: "View non-custodial guarantees" },
    { label: "Help Center", description: "FAQs and support" },
    { label: "About Motshelo", description: "Protocol documentation" },
    { label: "Referral Program", description: "Invite friends and earn rewards" },
  ]

  return (
    <div className="flex flex-col gap-4 pb-4">
      <h1 className="text-2xl font-bold text-foreground">More</h1>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <button
            key={item.label}
            className="flex flex-col items-start rounded-xl bg-card p-4 text-left hover:bg-secondary/50 transition-colors"
          >
            <p className="text-sm font-semibold text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
