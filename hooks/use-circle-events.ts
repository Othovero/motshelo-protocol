"use client";

import { useWatchContractEvent } from "wagmi";
import { type Log } from "viem";
import { motsheloCircleAbi } from "@/lib/contracts/abis";
import { useState, useCallback } from "react";

const abi = motsheloCircleAbi;

export type CircleEvent = {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
};

export function useCircleEvents(circleAddress: `0x${string}` | undefined) {
  const [events, setEvents] = useState<CircleEvent[]>([]);

  const onLog = useCallback((logs: Log[]) => {
    const newEvents = logs.map((log) => ({
      eventName: (log as unknown as { eventName?: string }).eventName || "Unknown",
      args: (log as unknown as { args?: Record<string, unknown> }).args || {},
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? ("0x" as `0x${string}`),
    }));
    setEvents((prev) => [...newEvents, ...prev].slice(0, 50));
  }, []);

  useWatchContractEvent({
    address: circleAddress,
    abi,
    eventName: "ContributionMade",
    onLogs: onLog,
    enabled: !!circleAddress,
  });

  useWatchContractEvent({
    address: circleAddress,
    abi,
    eventName: "PayoutSent",
    onLogs: onLog,
    enabled: !!circleAddress,
  });

  useWatchContractEvent({
    address: circleAddress,
    abi,
    eventName: "MemberJoined",
    onLogs: onLog,
    enabled: !!circleAddress,
  });

  useWatchContractEvent({
    address: circleAddress,
    abi,
    eventName: "MemberExited",
    onLogs: onLog,
    enabled: !!circleAddress,
  });

  useWatchContractEvent({
    address: circleAddress,
    abi,
    eventName: "YieldHarvested",
    onLogs: onLog,
    enabled: !!circleAddress,
  });

  useWatchContractEvent({
    address: circleAddress,
    abi,
    eventName: "RoundAdvanced",
    onLogs: onLog,
    enabled: !!circleAddress,
  });

  useWatchContractEvent({
    address: circleAddress,
    abi,
    eventName: "CircleActivated",
    onLogs: onLog,
    enabled: !!circleAddress,
  });

  useWatchContractEvent({
    address: circleAddress,
    abi,
    eventName: "SplitExecuted",
    onLogs: onLog,
    enabled: !!circleAddress,
  });

  return events;
}
