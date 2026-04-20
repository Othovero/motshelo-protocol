"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAccount } from "wagmi"
import {
  useCircleConfig,
  useCircleStatus,
  useActiveMembers,
  useCurrentRound,
  useCurrentRecipient,
  useContributionWindow,
  useIsContributionDue,
  useAavePosition,
  useAccruedYield,
  useCircleCreator,
  useMemberInfo,
  useRotationSize,
} from "@/hooks/use-motshelo-circle"
import { useRegistryMetadata } from "@/hooks/use-registry"
import { useApproveAndContribute, useExitEarly, useTriggerPayout, useTriggerSplit, useEmergencySplit, useActivateCircle, useApproveAndJoin } from "@/hooks/use-circle-actions"
import {
  formatUsdt,
  shortenAddress,
  STATUS_LABELS,
  CIRCLE_TYPE_LABELS,
  FREQUENCY_LABELS,
  GRACE_LABELS,
  MISS_POLICY_LABELS,
  PAYOUT_ORDER_LABELS,
  VISIBILITY_LABELS,
  getErrorMessage,
} from "@/lib/format"
import { toast } from "sonner"
import {
  ArrowLeft,
  Share2,
  TrendingUp,
  Users,
  Clock,
  Shield,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ChevronRight,
  HandshakeIcon,
  Loader2,
  Zap,
} from "lucide-react"
import { useEffect } from "react"

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "now"
  const days = Math.floor(seconds / 86400)
  const months = Math.floor(days / 30)
  const remainDays = days % 30
  if (months > 0) return `${months}mo ${remainDays}d`
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h`
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

function LivePot({ circleAddress }: { circleAddress: `0x${string}` }) {
  const { data: aave } = useAavePosition(circleAddress)

  const totalPot = aave ? formatUsdt(aave[1]) : "0.00"
  const yieldAmt = aave ? formatUsdt(aave[2]) : "0.00"

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[oklch(0.35_0.12_230)] to-[oklch(0.25_0.08_260)] p-5">
      <div className="absolute top-0 right-0 h-28 w-28 translate-x-6 -translate-y-6 rounded-full bg-[oklch(0.5_0.15_230/0.15)] blur-2xl" />
      <div className="absolute bottom-0 left-0 h-20 w-20 -translate-x-4 translate-y-4 rounded-full bg-[oklch(0.6_0.14_165/0.1)] blur-xl" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[oklch(0.8_0.05_230)]">Live Pot</p>
            <h2 className="text-3xl font-bold tracking-tight text-foreground mt-1">
              ${totalPot}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-xs text-[oklch(0.8_0.05_230)]">Accrued Yield</p>
            <p className="text-lg font-bold text-motshelo-teal mt-1">
              +${yieldAmt}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-motshelo-teal animate-pulse" />
            <span className="text-[10px] text-[oklch(0.8_0.05_230)]">Aave V3 Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="size-3 text-[oklch(0.8_0.05_230)]" />
            <span className="text-[10px] text-[oklch(0.8_0.05_230)]">Non-Custodial</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function RotationTracker({ circleAddress }: { circleAddress: `0x${string}` }) {
  const { data: activeMembers } = useActiveMembers(circleAddress)
  const { data: round } = useCurrentRound(circleAddress)
  const { data: rotSize } = useRotationSize(circleAddress)
  const { data: recipient } = useCurrentRecipient(circleAddress)
  const { address: userAddress } = useAccount()

  const currentRound = round ? Number(round) : 0
  const totalRounds = rotSize ? Number(rotSize) : 0
  const progress = totalRounds > 0 ? (currentRound / totalRounds) * 100 : 0

  return (
    <div className="rounded-xl bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Rotation Progress</h3>
        <Badge className="bg-motshelo-blue/15 text-motshelo-blue border-0 text-[10px]">
          Round {currentRound}/{totalRounds}
        </Badge>
      </div>

      <div className="mb-4">
        <div className="h-2 w-full rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-motshelo-blue to-motshelo-teal transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {activeMembers?.map((member, i) => {
          const isUser = member.toLowerCase() === userAddress?.toLowerCase()
          const isCurrent = member.toLowerCase() === recipient?.toLowerCase()

          return (
            <div
              key={member}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                isCurrent
                  ? "bg-motshelo-blue/10 ring-1 ring-motshelo-blue/30"
                  : "bg-secondary/30"
              }`}
            >
              <div className="flex size-6 items-center justify-center text-xs font-bold text-muted-foreground">
                {i + 1}
              </div>
              <Avatar className="size-7">
                <AvatarFallback className={`text-[10px] font-bold ${
                  isUser
                    ? "bg-motshelo-blue/20 text-motshelo-blue"
                    : "bg-secondary text-muted-foreground"
                }`}>
                  {member.slice(2, 4).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">
                  {shortenAddress(member)} {isUser && <span className="text-motshelo-blue">(You)</span>}
                </p>
              </div>
              <div>
                {isCurrent ? (
                  <div className="flex items-center gap-1">
                    <div className="size-2 rounded-full bg-motshelo-blue animate-pulse" />
                    <span className="text-[10px] font-medium text-motshelo-blue">Next</span>
                  </div>
                ) : (
                  <Circle className="size-4 text-muted-foreground/40" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActionCenter({ circleAddress }: { circleAddress: `0x${string}` }) {
  const { address: userAddress } = useAccount()
  const { data: config } = useCircleConfig(circleAddress)
  const { data: statusRaw } = useCircleStatus(circleAddress)
  const { data: isDue } = useIsContributionDue(circleAddress, userAddress)
  const { data: memberInfo } = useMemberInfo(circleAddress, userAddress)
  const { data: creatorAddr } = useCircleCreator(circleAddress)
  const { data: activeMembers } = useActiveMembers(circleAddress)

  const status = statusRaw !== undefined ? Number(statusRaw) : -1
  const isCreator = creatorAddr?.toLowerCase() === userAddress?.toLowerCase()
  const isMember = memberInfo?.isActive || false
  const contribution = config ? config.contributionAmount : 0n
  const circleTypeNum = config ? Number(config.circleType) : 0
  const minToActivate = config ? Number(config.minMembersToActivate) : 0
  const memberCount = activeMembers?.length ?? 0
  const canActivate = memberCount >= minToActivate

  const { approveUsdt: approveJoin, joinCircle, approval: joinApproval, join } = useApproveAndJoin(circleAddress)
  const { approveUsdt: approveContrib, contributeToCircle, approval: contribApproval, contribute } = useApproveAndContribute(circleAddress)
  const { trigger: triggerPayout, isPending: isPayoutPending, isConfirming: isPayoutConfirming, isSuccess: isPayoutSuccess, error: payoutError } = useTriggerPayout(circleAddress)
  const { trigger: triggerSplit, isPending: isSplitPending, isConfirming: isSplitConfirming, isSuccess: isSplitSuccess, error: splitError } = useTriggerSplit(circleAddress)
  const { trigger: emergencySplit, isPending: isEmergPending, isConfirming: isEmergConfirming, isSuccess: isEmergSuccess, error: emergError } = useEmergencySplit(circleAddress)
  const { activate, isPending: isActivatePending, isConfirming: isActivateConfirming, isSuccess: isActivateSuccess, error: activateError } = useActivateCircle(circleAddress)

  useEffect(() => {
    if (joinApproval.isSuccess && !join.isPending && !join.isSuccess) {
      joinCircle("0x0000000000000000000000000000000000000000" as `0x${string}`)
    }
  }, [joinApproval.isSuccess, join.isPending, join.isSuccess, joinCircle])

  useEffect(() => {
    if (contribApproval.isSuccess && !contribute.isPending && !contribute.isSuccess) {
      contributeToCircle()
    }
  }, [contribApproval.isSuccess, contribute.isPending, contribute.isSuccess, contributeToCircle])

  useEffect(() => {
    if (join.isSuccess) toast.success("Successfully joined the circle!")
    if (contribute.isSuccess) toast.success("Contribution submitted!")
    if (isPayoutSuccess) toast.success("Payout triggered!")
    if (isSplitSuccess) toast.success("Pot split executed! Funds distributed.")
    if (isEmergSuccess) toast.success("Emergency split complete! Funds returned (2% fee applied).")
    if (isActivateSuccess) toast.success("Circle activated!")
  }, [join.isSuccess, contribute.isSuccess, isPayoutSuccess, isSplitSuccess, isEmergSuccess, isActivateSuccess])

  useEffect(() => {
    if (join.error) toast.error(getErrorMessage(join.error))
    if (contribute.error) toast.error(getErrorMessage(contribute.error))
    if (payoutError) toast.error(getErrorMessage(payoutError))
    if (splitError) toast.error(getErrorMessage(splitError))
    if (emergError) toast.error(getErrorMessage(emergError))
    if (activateError) toast.error(getErrorMessage(activateError))
  }, [join.error, contribute.error, payoutError, splitError, emergError, activateError])

  const anyPending = joinApproval.isPending || join.isPending || join.isConfirming ||
    contribApproval.isPending || contribute.isPending || contribute.isConfirming ||
    isPayoutPending || isPayoutConfirming || isSplitPending || isSplitConfirming ||
    isEmergPending || isEmergConfirming || isActivatePending || isActivateConfirming

  function copyInviteLink() {
    const url = `${window.location.origin}/?circle=${circleAddress}`
    navigator.clipboard.writeText(url).then(
      () => toast.success("Invite link copied to clipboard!"),
      () => toast.error("Failed to copy link")
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* JOIN — shown when circle is OPEN and user is not a member */}
      {status === 0 && !isMember && (
        <button
          onClick={() => approveJoin(contribution as bigint)}
          disabled={anyPending}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-motshelo-blue py-3.5 text-sm font-semibold text-primary-foreground hover:bg-motshelo-blue/90 transition-colors disabled:opacity-60"
        >
          {(joinApproval.isPending || join.isPending || join.isConfirming) ? (
            <><Loader2 className="size-4 animate-spin" /> Joining...</>
          ) : (
            <><Zap className="size-4" /> Join Circle (${formatUsdt(contribution as bigint)} USDT)</>
          )}
        </button>
      )}

      {/* ACTIVATE — shown to creator when circle is OPEN and they have joined */}
      {status === 0 && isCreator && isMember && (
        <button
          onClick={() => activate()}
          disabled={anyPending || !canActivate}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-motshelo-teal py-3.5 text-sm font-semibold text-accent-foreground hover:bg-motshelo-teal/90 transition-colors disabled:opacity-60"
        >
          {(isActivatePending || isActivateConfirming) ? (
            <><Loader2 className="size-4 animate-spin" /> Activating...</>
          ) : !canActivate ? (
            <>Need {minToActivate - memberCount} more member{minToActivate - memberCount !== 1 ? "s" : ""} to activate</>
          ) : (
            <>Activate Circle ({memberCount} members ready)</>
          )}
        </button>
      )}

      {/* Prompt creator to join first before they can activate */}
      {status === 0 && isCreator && !isMember && (
        <div className="flex items-center justify-center gap-2 w-full rounded-xl bg-card py-3 text-xs font-medium text-muted-foreground ring-1 ring-border">
          <Shield className="size-3.5 text-motshelo-blue" />
          Join &amp; deposit your share first, then you can activate
        </div>
      )}

      {/* CONTRIBUTE — shown when circle is ACTIVE and contribution is due */}
      {status === 1 && isMember && isDue && (
        <button
          onClick={() => approveContrib(contribution as bigint)}
          disabled={anyPending}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-motshelo-blue py-3.5 text-sm font-semibold text-primary-foreground hover:bg-motshelo-blue/90 transition-colors disabled:opacity-60"
        >
          {(contribApproval.isPending || contribute.isPending || contribute.isConfirming) ? (
            <><Loader2 className="size-4 animate-spin" /> Contributing...</>
          ) : (
            <><HandshakeIcon className="size-4" /> Contribute ${formatUsdt(contribution as bigint)} USDT</>
          )}
        </button>
      )}

      {status === 1 && isMember && !isDue && (
        <div className="flex items-center justify-center gap-2 w-full rounded-xl bg-card py-3.5 text-sm font-medium text-muted-foreground ring-1 ring-border">
          <CheckCircle2 className="size-4 text-motshelo-teal" />
          Contributed this round
        </div>
      )}

      {/* TRIGGER PAYOUT — for ROTATION circles when ACTIVE */}
      {status === 1 && circleTypeNum === 0 && (
        <button
          onClick={() => triggerPayout()}
          disabled={anyPending}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-card py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors ring-1 ring-border disabled:opacity-60"
        >
          {(isPayoutPending || isPayoutConfirming) ? (
            <><Loader2 className="size-4 animate-spin" /> Processing...</>
          ) : (
            "Trigger Payout"
          )}
        </button>
      )}

      {/* MATURITY SPLIT — for SAVINGS_SPLIT at maturity */}
      {status === 1 && circleTypeNum === 1 && config && BigInt(Math.floor(Date.now() / 1000)) >= config.maturityTimestamp && (
        <button
          onClick={() => triggerSplit()}
          disabled={anyPending}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-motshelo-blue to-motshelo-teal py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {(isSplitPending || isSplitConfirming) ? (
            <><Loader2 className="size-4 animate-spin" /> Splitting pot...</>
          ) : (
            "Split Pot & Distribute (Maturity Reached)"
          )}
        </button>
      )}

      {/* MATURITY COUNTDOWN — show time remaining */}
      {status === 1 && circleTypeNum === 1 && config && BigInt(Math.floor(Date.now() / 1000)) < config.maturityTimestamp && (
        <div className="flex items-center justify-center gap-2 w-full rounded-xl bg-card py-3 text-xs font-medium text-muted-foreground ring-1 ring-border">
          <Clock className="size-3.5 text-motshelo-blue" />
          Maturity in {formatTimeRemaining(Number(config.maturityTimestamp) - Math.floor(Date.now() / 1000))}
        </div>
      )}

      {/* EMERGENCY SPLIT — creator can end early, returns funds minus 2% fee */}
      {status === 1 && circleTypeNum === 1 && isCreator && (
        <button
          onClick={() => emergencySplit()}
          disabled={anyPending}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-destructive/10 py-3 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors ring-1 ring-destructive/30 disabled:opacity-60"
        >
          {(isEmergPending || isEmergConfirming) ? (
            <><Loader2 className="size-4 animate-spin" /> Processing emergency split...</>
          ) : (
            <><AlertTriangle className="size-4" /> Emergency Split (2% withdrawal fee)</>
          )}
        </button>
      )}

      {/* INVITE — always visible, copies shareable link */}
      <button
        onClick={copyInviteLink}
        className="flex items-center justify-center gap-2 w-full rounded-xl bg-card py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors ring-1 ring-border"
      >
        <Share2 className="size-4" />
        Copy Invite Link
      </button>
    </div>
  )
}

function FinancialBreakdown({ circleAddress }: { circleAddress: `0x${string}` }) {
  const { data: config } = useCircleConfig(circleAddress)
  const { data: aave } = useAavePosition(circleAddress)
  const { data: activeMembers } = useActiveMembers(circleAddress)

  const yieldTotal = aave ? aave[2] : 0n
  const protocolShare = (yieldTotal * 6000n) / 10000n
  const userShare = yieldTotal - protocolShare

  const contributionAmt = config ? config.contributionAmount : 0n
  const maxMem = config ? Number(config.maxMembers) : 0
  const currentMembers = activeMembers?.length ?? 0
  const memberCountForCalc = BigInt(currentMembers > 0 ? currentMembers : maxMem)
  const freq = config ? Number(config.contributionFrequency) : 1
  const maturity = config ? Number(config.maturityTimestamp) : 0
  const nowSec = Math.floor(Date.now() / 1000)

  const totalDuration = maturity > nowSec ? maturity - nowSec : 0
  const estimatedRounds = freq > 0 ? BigInt(Math.max(1, Math.ceil(totalDuration / freq))) : 1n

  const totalPerMember = contributionAmt * estimatedRounds
  const expectedTotalPot = totalPerMember * memberCountForCalc
  const withdrawalFee = (totalPerMember * 200n) / 10000n
  const expectedIndividualReturn = totalPerMember - withdrawalFee

  return (
    <div className="rounded-xl bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Financial Projection</h3>
      <div className="flex flex-col gap-2.5">
        <BreakdownRow
          label="Your Total Investment"
          value={`$${formatUsdt(totalPerMember)} (${formatUsdt(contributionAmt)} x ${estimatedRounds.toString()} rounds)`}
        />
        <BreakdownRow
          label="Expected Total Pot"
          value={`$${formatUsdt(expectedTotalPot)} (${currentMembers || maxMem} members)`}
          highlight
        />
        <BreakdownRow
          label="Expected Return (after fees)"
          value={`$${formatUsdt(expectedIndividualReturn)}`}
          highlight
        />
        <BreakdownRow
          label="Withdrawal Fee"
          value={`$${formatUsdt(withdrawalFee)} (2%)`}
        />
        {maturity > 0 && (
          <BreakdownRow
            label="Maturity Date"
            value={new Date(maturity * 1000).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" })}
          />
        )}
        <div className="my-1 h-px bg-border" />
        <BreakdownRow label="Yield Split" value="60% protocol / 40% you" />
        <BreakdownRow label="Your Yield Share" value={`$${formatUsdt(userShare)}`} highlight />
        <BreakdownRow
          label="Grace Period"
          value={config ? (GRACE_LABELS[config.gracePeriod.toString()] || "?") : "..."}
        />
        <BreakdownRow
          label="Miss Penalty"
          value={config ? (MISS_POLICY_LABELS[Number(config.missPolicy)] || "?") : "..."}
        />
        <BreakdownRow
          label="Payout Order"
          value={config ? (PAYOUT_ORDER_LABELS[Number(config.payoutOrder)] || "?") : "..."}
        />
        <BreakdownRow
          label="Early Exit"
          value={config?.earlyExitAllowed ? "Allowed" : "Not allowed"}
        />
      </div>
    </div>
  )
}

function BreakdownRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-medium ${highlight ? "text-motshelo-teal" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  )
}

function CircleInfo({ circleAddress }: { circleAddress: `0x${string}` }) {
  const { data: config } = useCircleConfig(circleAddress)
  const { data: memberCount } = useActiveMembers(circleAddress)

  return (
    <div className="rounded-xl bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Circle Details</h3>
      <div className="flex flex-col gap-2.5">
        <BreakdownRow
          label="Type"
          value={config ? (CIRCLE_TYPE_LABELS[Number(config.circleType)] === "ROTATION" ? "Rotation" : "Savings Split") : "..."}
        />
        <BreakdownRow
          label="Contribution"
          value={config ? `$${formatUsdt(config.contributionAmount)} USDT` : "..."}
        />
        <BreakdownRow
          label="Frequency"
          value={config ? (FREQUENCY_LABELS[config.contributionFrequency.toString()] || "?") : "..."}
        />
        <BreakdownRow
          label="Members"
          value={memberCount ? `${memberCount.length}/${config ? Number(config.maxMembers) : "?"}` : "..."}
        />
        <BreakdownRow
          label="Visibility"
          value={config ? (VISIBILITY_LABELS[Number(config.joinVisibility)]?.replace("_", " ") || "?") : "..."}
        />
      </div>
    </div>
  )
}

export default function CircleDetailScreen({
  onBack,
  circleAddress,
}: {
  onBack: () => void;
  circleAddress?: `0x${string}`;
}) {
  const { data: config } = useCircleConfig(circleAddress)
  const { data: statusRaw } = useCircleStatus(circleAddress)
  const { data: meta } = useRegistryMetadata(circleAddress)
  const { exit, isPending: isExitPending, isConfirming: isExitConfirming, isSuccess: isExitSuccess, error: exitError } = useExitEarly(circleAddress || "0x0000000000000000000000000000000000000000")

  const status = statusRaw !== undefined ? Number(statusRaw) : -1
  const name = meta?.name || (circleAddress ? shortenAddress(circleAddress) : "Circle")
  const description = meta?.description || "On-chain savings circle powered by Motshelo Protocol."

  useEffect(() => {
    if (isExitSuccess) toast.success("You have exited the circle.")
    if (exitError) toast.error(getErrorMessage(exitError))
  }, [isExitSuccess, exitError])

  if (!circleAddress) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">No circle selected.</p>
        <button onClick={onBack} className="mt-4 text-sm text-motshelo-blue">Go back</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-full bg-card hover:bg-secondary transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="size-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">{name}</h1>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge
          className={
            status === 1
              ? "bg-motshelo-teal/15 text-motshelo-teal border-0 text-[10px]"
              : "bg-secondary text-muted-foreground border-0 text-[10px]"
          }
        >
          {STATUS_LABELS[status] || "..."}
        </Badge>
      </div>

      <LivePot circleAddress={circleAddress} />
      <ActionCenter circleAddress={circleAddress} />
      {config && Number(config.circleType) === 0 && (
        <RotationTracker circleAddress={circleAddress} />
      )}
      <FinancialBreakdown circleAddress={circleAddress} />
      <CircleInfo circleAddress={circleAddress} />

      {config?.earlyExitAllowed && (
        <button
          onClick={() => exit()}
          disabled={isExitPending || isExitConfirming}
          className="flex items-center justify-between rounded-xl bg-card p-4 hover:bg-secondary transition-colors disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              {(isExitPending || isExitConfirming) ? "Exiting..." : "Exit Circle Early"}
            </span>
          </div>
          <ChevronRight className="size-4 text-destructive/50" />
        </button>
      )}
    </div>
  )
}
