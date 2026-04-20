"use client";

import { useReadContract } from "wagmi";
import { motsheloCircleAbi } from "@/lib/contracts/abis";

const abi = motsheloCircleAbi;

export function useCircleConfig(circleAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "getCircleConfig",
    query: { enabled: !!circleAddress },
  });
}

export function useCircleStatus(circleAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "status",
    query: { enabled: !!circleAddress },
  });
}

export function useMemberInfo(
  circleAddress: `0x${string}` | undefined,
  member: `0x${string}` | undefined
) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "getMemberInfo",
    args: member ? [member] : undefined,
    query: { enabled: !!circleAddress && !!member },
  });
}

export function useActiveMembers(circleAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "getActiveMembers",
    query: { enabled: !!circleAddress },
  });
}

export function useMemberCount(circleAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "getMemberCount",
    query: { enabled: !!circleAddress },
  });
}

export function useCurrentRound(circleAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "currentRound",
    query: { enabled: !!circleAddress },
  });
}

export function useContributionWindow(
  circleAddress: `0x${string}` | undefined
) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "getContributionWindow",
    query: { enabled: !!circleAddress },
  });
}

export function useIsContributionDue(
  circleAddress: `0x${string}` | undefined,
  member: `0x${string}` | undefined
) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "isContributionDue",
    args: member ? [member] : undefined,
    query: { enabled: !!circleAddress && !!member },
  });
}

export function useAavePosition(circleAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "getAavePosition",
    query: { enabled: !!circleAddress },
  });
}

export function useAccruedYield(circleAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "getAccruedYield",
    query: { enabled: !!circleAddress },
  });
}

export function useCurrentRecipient(
  circleAddress: `0x${string}` | undefined
) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "getCurrentRecipient",
    query: { enabled: !!circleAddress },
  });
}

export function useCircleCreator(circleAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "creator",
    query: { enabled: !!circleAddress },
  });
}

export function useContributionAmount(
  circleAddress: `0x${string}` | undefined
) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "contributionAmount",
    query: { enabled: !!circleAddress },
  });
}

export function useRotationSize(circleAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "rotationSize",
    query: { enabled: !!circleAddress },
  });
}

export function useTotalDeposited(circleAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: circleAddress,
    abi,
    functionName: "totalDeposited",
    query: { enabled: !!circleAddress },
  });
}
