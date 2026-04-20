"use client"

import { useState, useEffect } from "react"
import { parseEther } from "viem"
import { useCreateCircle, type CircleConfigStruct } from "@/hooks/use-motshelo-factory"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/format"
import {
  ArrowLeft,
  ArrowRight,
  CircleDot,
  Users,
  Banknote,
  Shield,
  Check,
  Loader2,
} from "lucide-react"

type CircleType = "ROTATION" | "SAVINGS_SPLIT"
type PayoutOrder = "FIXED" | "RANDOM" | "SENIORITY"
type SplitMethod = "PROPORTIONAL" | "EQUAL"
type MissPolicy = "SKIP" | "SLASH" | "EXPEL"
type Visibility = "PUBLIC" | "INVITE_ONLY" | "WHITELIST"
type Frequency = "WEEKLY" | "MONTHLY"
type Duration = "1_MONTH" | "3_MONTHS" | "6_MONTHS" | "1_YEAR"

interface CircleFormConfig {
  name: string
  description: string
  circleType: CircleType
  payoutOrder: PayoutOrder
  splitMethod: SplitMethod
  contributionAmount: string
  frequency: Frequency
  duration: Duration
  maxMembers: number
  minMembers: number
  missPolicy: MissPolicy
  gracePeriod: number
  earlyExit: boolean
  visibility: Visibility
}

const CIRCLE_TYPE_MAP: Record<CircleType, number> = { ROTATION: 0, SAVINGS_SPLIT: 1 }
const PAYOUT_ORDER_MAP: Record<PayoutOrder, number> = { FIXED: 0, RANDOM: 1, SENIORITY: 2 }
const SPLIT_METHOD_MAP: Record<SplitMethod, number> = { PROPORTIONAL: 0, EQUAL: 1 }
const MISS_POLICY_MAP: Record<MissPolicy, number> = { SKIP: 0, SLASH: 1, EXPEL: 2 }
const VISIBILITY_MAP: Record<Visibility, number> = { PUBLIC: 0, INVITE_ONLY: 1, WHITELIST: 2 }
const FREQUENCY_MAP: Record<Frequency, bigint> = { WEEKLY: 604800n, MONTHLY: 2592000n }

function durationToTimestamp(duration: Duration): bigint {
  const now = BigInt(Math.floor(Date.now() / 1000))
  const months: Record<Duration, bigint> = {
    "1_MONTH": 30n * 86400n,
    "3_MONTHS": 90n * 86400n,
    "6_MONTHS": 180n * 86400n,
    "1_YEAR": 365n * 86400n,
  }
  return now + months[duration]
}

const steps = [
  { num: 1, label: "Identity", icon: CircleDot },
  { num: 2, label: "Type", icon: Users },
  { num: 3, label: "Economics", icon: Banknote },
]

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, i) => (
        <div key={step.num} className="flex items-center gap-2">
          <div
            className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
              currentStep > step.num
                ? "bg-motshelo-teal text-background"
                : currentStep === step.num
                  ? "bg-motshelo-blue text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {currentStep > step.num ? <Check className="size-3.5" /> : step.num}
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-8 rounded-full transition-all ${
                currentStep > step.num ? "bg-motshelo-teal" : "bg-secondary"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function OptionCard({ selected, onClick, icon, title, description }: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; description: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl p-4 text-left transition-all ring-1 ${
        selected ? "bg-motshelo-blue/10 ring-motshelo-blue/40" : "bg-card ring-border hover:ring-muted-foreground/30"
      }`}
    >
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-motshelo-blue/20" : "bg-secondary"}`}>
        {icon}
      </div>
      <div>
        <p className={`text-sm font-semibold ${selected ? "text-motshelo-blue" : "text-foreground"}`}>{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{description}</p>
      </div>
    </button>
  )
}

function SmallOption({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-all ring-1 ${
        selected
          ? "bg-motshelo-blue/10 text-motshelo-blue ring-motshelo-blue/40"
          : "bg-card text-muted-foreground ring-border hover:ring-muted-foreground/30"
      }`}
    >
      {label}
    </button>
  )
}

function Step1({ config, setConfig }: { config: CircleFormConfig; setConfig: (c: CircleFormConfig) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Name your Circle</h2>
        <p className="text-xs text-muted-foreground mt-1">Give your savings circle a name and description.</p>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="circle-name" className="text-xs font-medium text-muted-foreground mb-1.5 block">Circle Name</label>
          <input id="circle-name" type="text" value={config.name} onChange={(e) => setConfig({ ...config, name: e.target.value })} placeholder="e.g. Ubuntu Savers" className="w-full rounded-xl bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 ring-1 ring-border focus:ring-motshelo-blue focus:outline-none transition-all" />
        </div>
        <div>
          <label htmlFor="circle-desc" className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
          <textarea id="circle-desc" value={config.description} onChange={(e) => setConfig({ ...config, description: e.target.value })} placeholder="Describe what your circle is about..." rows={3} className="w-full rounded-xl bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 ring-1 ring-border focus:ring-motshelo-blue focus:outline-none transition-all resize-none" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Visibility</label>
          <div className="flex gap-2">
            {(["PUBLIC", "INVITE_ONLY", "WHITELIST"] as Visibility[]).map((v) => (
              <SmallOption key={v} selected={config.visibility === v} onClick={() => setConfig({ ...config, visibility: v })} label={v.replace("_", " ")} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Step2({ config, setConfig }: { config: CircleFormConfig; setConfig: (c: CircleFormConfig) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Choose Circle Type</h2>
        <p className="text-xs text-muted-foreground mt-1">Select how funds will be distributed.</p>
      </div>
      <div className="flex flex-col gap-3">
        <OptionCard selected={config.circleType === "ROTATION"} onClick={() => setConfig({ ...config, circleType: "ROTATION" })}
          icon={<CircleDot className={`size-5 ${config.circleType === "ROTATION" ? "text-motshelo-blue" : "text-muted-foreground"}`} />}
          title="Rotation" description="Each member takes turns receiving the full pot. Classic stokvel model." />
        <OptionCard selected={config.circleType === "SAVINGS_SPLIT"} onClick={() => setConfig({ ...config, circleType: "SAVINGS_SPLIT" })}
          icon={<Users className={`size-5 ${config.circleType === "SAVINGS_SPLIT" ? "text-motshelo-blue" : "text-muted-foreground"}`} />}
          title="Savings Split" description="Save together until maturity, then split the pool proportionally or equally." />
      </div>
      {config.circleType === "ROTATION" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Payout Order</label>
          <div className="flex gap-2">
            {(["FIXED", "RANDOM", "SENIORITY"] as PayoutOrder[]).map((p) => (
              <SmallOption key={p} selected={config.payoutOrder === p} onClick={() => setConfig({ ...config, payoutOrder: p })} label={p} />
            ))}
          </div>
        </div>
      )}
      {config.circleType === "SAVINGS_SPLIT" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Split Method</label>
          <div className="flex gap-2">
            {(["PROPORTIONAL", "EQUAL"] as SplitMethod[]).map((s) => (
              <SmallOption key={s} selected={config.splitMethod === s} onClick={() => setConfig({ ...config, splitMethod: s })} label={s} />
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Miss Penalty</label>
        <div className="flex gap-2">
          {(["SKIP", "SLASH", "EXPEL"] as MissPolicy[]).map((m) => (
            <SmallOption key={m} selected={config.missPolicy === m} onClick={() => setConfig({ ...config, missPolicy: m })} label={m} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Step3({ config, setConfig }: { config: CircleFormConfig; setConfig: (c: CircleFormConfig) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Set Economics</h2>
        <p className="text-xs text-muted-foreground mt-1">Define contribution amounts and member limits.</p>
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="contribution-amt" className="text-xs font-medium text-muted-foreground mb-1.5 block">Contribution Amount (USDT)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input id="contribution-amt" type="number" value={config.contributionAmount} onChange={(e) => setConfig({ ...config, contributionAmount: e.target.value })} placeholder="100" className="w-full rounded-xl bg-card pl-8 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 ring-1 ring-border focus:ring-motshelo-blue focus:outline-none transition-all" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Frequency</label>
          <div className="flex gap-2">
            {(["WEEKLY", "MONTHLY"] as Frequency[]).map((f) => (
              <SmallOption key={f} selected={config.frequency === f} onClick={() => setConfig({ ...config, frequency: f })} label={f} />
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Circle Duration</label>
          <div className="flex gap-2">
            {([
              { label: "1 Month", value: "1_MONTH" as Duration },
              { label: "3 Months", value: "3_MONTHS" as Duration },
              { label: "6 Months", value: "6_MONTHS" as Duration },
              { label: "1 Year", value: "1_YEAR" as Duration },
            ]).map((d) => (
              <SmallOption key={d.value} selected={config.duration === d.value} onClick={() => setConfig({ ...config, duration: d.value })} label={d.label} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="min-members" className="text-xs font-medium text-muted-foreground mb-1.5 block">Min Members</label>
            <input id="min-members" type="number" value={config.minMembers} onChange={(e) => setConfig({ ...config, minMembers: parseInt(e.target.value) || 2 })} min={2} max={50} className="w-full rounded-xl bg-card px-4 py-3 text-sm text-foreground ring-1 ring-border focus:ring-motshelo-blue focus:outline-none transition-all" />
          </div>
          <div>
            <label htmlFor="max-members" className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Members</label>
            <input id="max-members" type="number" value={config.maxMembers} onChange={(e) => setConfig({ ...config, maxMembers: parseInt(e.target.value) || 10 })} min={3} max={50} className="w-full rounded-xl bg-card px-4 py-3 text-sm text-foreground ring-1 ring-border focus:ring-motshelo-blue focus:outline-none transition-all" />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3 ring-1 ring-border">
          <div>
            <p className="text-sm font-medium text-foreground">Allow Early Exit</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Members can leave before completion (2% fee applies)</p>
          </div>
          <button onClick={() => setConfig({ ...config, earlyExit: !config.earlyExit })}
            className={`relative h-6 w-11 rounded-full transition-colors ${config.earlyExit ? "bg-motshelo-blue" : "bg-secondary"}`}
            role="switch" aria-checked={config.earlyExit}
          >
            <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-foreground transition-transform ${config.earlyExit ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Grace Period</label>
          <div className="flex gap-2">
            {[{ label: "12h", value: 43200 }, { label: "24h", value: 86400 }, { label: "48h", value: 172800 }, { label: "72h", value: 259200 }].map((g) => (
              <SmallOption key={g.value} selected={config.gracePeriod === g.value} onClick={() => setConfig({ ...config, gracePeriod: g.value })} label={g.label} />
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-xl bg-motshelo-blue/5 p-4 ring-1 ring-motshelo-blue/20">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="size-4 text-motshelo-blue" />
          <span className="text-xs font-semibold text-motshelo-blue">Fee Summary</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Deposit Fee</span>
            <span className="text-motshelo-teal font-medium">0%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Withdrawal Fee</span>
            <span className="text-foreground font-medium">2% on principal</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Yield Split</span>
            <span className="text-foreground font-medium">40% to you</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CreateCircleScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1)
  const [config, setConfig] = useState<CircleFormConfig>({
    name: "",
    description: "",
    circleType: "ROTATION",
    payoutOrder: "FIXED",
    splitMethod: "PROPORTIONAL",
    contributionAmount: "100",
    frequency: "MONTHLY",
    duration: "3_MONTHS",
    maxMembers: 10,
    minMembers: 3,
    missPolicy: "SKIP",
    gracePeriod: 172800,
    earlyExit: false,
    visibility: "PUBLIC",
  })

  const { create, isPending, isConfirming, isSuccess, error, deployedAddress } = useCreateCircle()

  useEffect(() => {
    if (isSuccess && deployedAddress) {
      toast.success(`Circle deployed at ${deployedAddress}`)
      onBack()
    }
  }, [isSuccess, deployedAddress, onBack])

  useEffect(() => {
    if (error) toast.error(getErrorMessage(error))
  }, [error])

  function handleDeploy() {
    const maturityTs = config.circleType === "SAVINGS_SPLIT"
      ? durationToTimestamp(config.duration)
      : 0n

    const struct: CircleConfigStruct = {
      circleType: CIRCLE_TYPE_MAP[config.circleType],
      contributionAmount: parseEther(config.contributionAmount || "0"),
      contributionFrequency: FREQUENCY_MAP[config.frequency],
      maxMembers: BigInt(config.maxMembers),
      minMembersToActivate: BigInt(config.minMembers),
      payoutOrder: PAYOUT_ORDER_MAP[config.payoutOrder],
      splitMethod: SPLIT_METHOD_MAP[config.splitMethod],
      missPolicy: MISS_POLICY_MAP[config.missPolicy],
      gracePeriod: BigInt(config.gracePeriod),
      earlyExitAllowed: config.earlyExit,
      maturityTimestamp: maturityTs,
      communityReserveBps: 0n,
      joinVisibility: VISIBILITY_MAP[config.visibility],
    }

    create(struct, config.name, config.description, "")
  }

  const deploying = isPending || isConfirming

  return (
    <div className="flex flex-col min-h-[calc(100dvh-80px)]">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={step === 1 ? onBack : () => setStep(step - 1)}
          className="flex size-9 items-center justify-center rounded-full bg-card hover:bg-secondary transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="size-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Create Circle</h1>
          <p className="text-xs text-muted-foreground">Step {step} of 3</p>
        </div>
      </div>

      <StepIndicator currentStep={step} />

      <div className="flex-1 mt-5">
        {step === 1 && <Step1 config={config} setConfig={setConfig} />}
        {step === 2 && <Step2 config={config} setConfig={setConfig} />}
        {step === 3 && <Step3 config={config} setConfig={setConfig} />}
      </div>

      <div className="mt-6 pb-4">
        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-motshelo-blue py-3.5 text-sm font-semibold text-primary-foreground hover:bg-motshelo-blue/90 transition-colors"
          >
            Continue
            <ArrowRight className="size-4" />
          </button>
        ) : (
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-motshelo-teal py-3.5 text-sm font-semibold text-accent-foreground hover:bg-motshelo-teal/90 transition-colors disabled:opacity-60"
          >
            {deploying ? (
              <><Loader2 className="size-4 animate-spin" /> Deploying Circle...</>
            ) : (
              <><Shield className="size-4" /> Deploy Circle</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
