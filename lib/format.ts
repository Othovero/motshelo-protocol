import { formatEther, parseEther } from "viem";

export function formatUsdt(wei: bigint | undefined): string {
  if (wei === undefined || wei === null) return "0.00";
  const str = formatEther(wei);
  const num = parseFloat(str);
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatUsdtShort(wei: bigint | undefined): string {
  if (wei === undefined || wei === null) return "$0";
  const num = parseFloat(formatEther(wei));
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(2)}`;
}

export function parseUsdt(amount: string): bigint {
  return parseEther(amount);
}

export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const STATUS_LABELS: Record<number, string> = {
  0: "OPEN",
  1: "ACTIVE",
  2: "COMPLETED",
  3: "PAUSED",
};

export const CIRCLE_TYPE_LABELS: Record<number, string> = {
  0: "ROTATION",
  1: "SAVINGS_SPLIT",
};

export const PAYOUT_ORDER_LABELS: Record<number, string> = {
  0: "FIXED",
  1: "RANDOM",
  2: "SENIORITY",
};

export const SPLIT_METHOD_LABELS: Record<number, string> = {
  0: "PROPORTIONAL",
  1: "EQUAL",
};

export const MISS_POLICY_LABELS: Record<number, string> = {
  0: "SKIP",
  1: "SLASH",
  2: "EXPEL",
};

export const VISIBILITY_LABELS: Record<number, string> = {
  0: "PUBLIC",
  1: "INVITE_ONLY",
  2: "WHITELIST",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  "604800": "Weekly",
  "2592000": "Monthly",
};

export const GRACE_LABELS: Record<string, string> = {
  "43200": "12h",
  "86400": "24h",
  "172800": "48h",
  "259200": "72h",
};

export const SOLIDITY_ERRORS: Record<string, string> = {
  CircleNotOpen: "This circle is not accepting new members.",
  CircleNotActive: "This circle is not currently active.",
  CirclePausedError: "This circle is paused by the creator.",
  AlreadyMember: "You are already a member of this circle.",
  NotMember: "You are not a member of this circle.",
  MaxMembersReached: "This circle has reached its maximum member limit.",
  NotWhitelisted: "You are not whitelisted for this circle.",
  InsufficientMembers: "Not enough members to activate.",
  OnlyCreator: "Only the circle creator can do this.",
  NotInContributionWindow: "Contribution window is closed.",
  AlreadyContributedThisRound: "You already contributed this round.",
  NotAllMembersContributed: "Not all members have contributed yet.",
  AlreadyReceivedPayout: "Recipient already received their payout.",
  MaturityNotReached: "The maturity date has not been reached.",
  EarlyExitNotAllowed: "Early exit is not allowed for this circle.",
  InvalidConfiguration: "Invalid circle configuration.",
  GracePeriodNotExpired: "The grace period has not expired yet.",
  MemberNotMissed: "This member has not missed a contribution.",
  CircleCompleted: "This circle has already completed.",
  RandomOrderNotReady: "Random payout order is not ready yet.",
  InvalidAddress: "Invalid address provided.",
  TokenNotApproved: "This token is not approved for use.",
};

export function getErrorMessage(error: Error | null | undefined): string {
  if (!error) return "An unknown error occurred.";
  const msg = error.message || "";
  for (const [key, value] of Object.entries(SOLIDITY_ERRORS)) {
    if (msg.includes(key)) return value;
  }
  if (msg.includes("User rejected")) return "Transaction was rejected.";
  if (msg.includes("insufficient funds")) return "Insufficient funds for gas.";
  return "Transaction failed. Please try again.";
}
