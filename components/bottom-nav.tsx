"use client"

import { Home, CreditCard, TrendingUp, Share2, MoreHorizontal } from "lucide-react"

type Tab = "home" | "discover" | "finance" | "network" | "more"

const tabs: { key: Tab; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "discover", label: "Circles", icon: CreditCard },
  { key: "finance", label: "Finance", icon: TrendingUp },
  { key: "network", label: "Network", icon: Share2 },
  { key: "more", label: "More", icon: MoreHorizontal },
]

export default function BottomNav({
  active,
  onChange,
}: {
  active: Tab
  onChange: (tab: Tab) => void
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl" aria-label="Main navigation">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {tabs.map((tab) => {
          const isActive = active === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                isActive ? "text-motshelo-blue" : "text-muted-foreground"
              }`}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <tab.icon className={`size-5 ${isActive ? "text-motshelo-blue" : ""}`} />
              <span className={`text-[10px] font-medium ${isActive ? "text-motshelo-blue" : ""}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export type { Tab }
