"use client";

import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { motsheloCircleAbi, erc20Abi } from "@/lib/contracts/abis";
import { getAddresses } from "@/lib/contracts/addresses";

const circleAbi = motsheloCircleAbi;
const tokenAbi = erc20Abi;

function useCircleWrite() {
  const { data: hash, writeContract, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, isError: isReceiptError } =
    useWaitForTransactionReceipt({ hash });

  return {
    hash,
    writeContract,
    isPending,
    isConfirming,
    isSuccess,
    isError: !!error || isReceiptError,
    error,
    reset,
  };
}

export function useApproveAndJoin(circleAddress: `0x${string}`) {
  const chainId = useChainId();
  const usdtAddress = getAddresses(chainId).usdt;

  const approval = useCircleWrite();
  const join = useCircleWrite();

  function approveUsdt(amount: bigint) {
    approval.writeContract({
      address: usdtAddress,
      abi: tokenAbi,
      functionName: "approve",
      args: [circleAddress, amount],
    });
  }

  function joinCircle(referrer: `0x${string}`) {
    join.writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "join",
      args: [referrer],
    });
  }

  return {
    approveUsdt,
    joinCircle,
    approval: {
      isPending: approval.isPending,
      isConfirming: approval.isConfirming,
      isSuccess: approval.isSuccess,
      error: approval.error,
    },
    join: {
      isPending: join.isPending,
      isConfirming: join.isConfirming,
      isSuccess: join.isSuccess,
      error: join.error,
    },
  };
}

export function useApproveAndContribute(circleAddress: `0x${string}`) {
  const chainId = useChainId();
  const usdtAddress = getAddresses(chainId).usdt;

  const approval = useCircleWrite();
  const contribute = useCircleWrite();

  function approveUsdt(amount: bigint) {
    approval.writeContract({
      address: usdtAddress,
      abi: tokenAbi,
      functionName: "approve",
      args: [circleAddress, amount],
    });
  }

  function contributeToCircle() {
    contribute.writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "contribute",
    });
  }

  return {
    approveUsdt,
    contributeToCircle,
    approval: {
      isPending: approval.isPending,
      isConfirming: approval.isConfirming,
      isSuccess: approval.isSuccess,
      error: approval.error,
    },
    contribute: {
      isPending: contribute.isPending,
      isConfirming: contribute.isConfirming,
      isSuccess: contribute.isSuccess,
      error: contribute.error,
    },
  };
}

export function useTriggerPayout(circleAddress: `0x${string}`) {
  const w = useCircleWrite();
  function trigger() {
    w.writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "triggerPayout",
    });
  }
  return { trigger, ...w };
}

export function useTriggerSplit(circleAddress: `0x${string}`) {
  const w = useCircleWrite();
  function trigger() {
    w.writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "triggerSplit",
    });
  }
  return { trigger, ...w };
}

export function useEmergencySplit(circleAddress: `0x${string}`) {
  const w = useCircleWrite();
  function trigger() {
    w.writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "emergencySplit",
    });
  }
  return { trigger, ...w };
}

export function useExitEarly(circleAddress: `0x${string}`) {
  const w = useCircleWrite();
  function exit() {
    w.writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "exitEarly",
    });
  }
  return { exit, ...w };
}

export function useActivateCircle(circleAddress: `0x${string}`) {
  const w = useCircleWrite();
  function activate() {
    w.writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "activate",
    });
  }
  return { activate, ...w };
}

export function usePauseCircle(circleAddress: `0x${string}`) {
  const w = useCircleWrite();
  function pause() {
    w.writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "pauseCircle",
    });
  }
  return { pause, ...w };
}

export function useUnpauseCircle(circleAddress: `0x${string}`) {
  const w = useCircleWrite();
  function unpause() {
    w.writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "unpauseCircle",
    });
  }
  return { unpause, ...w };
}

export function useAddToWhitelist(circleAddress: `0x${string}`) {
  const w = useCircleWrite();
  function add(addresses: `0x${string}`[]) {
    w.writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "addToWhitelist",
      args: [addresses],
    });
  }
  return { add, ...w };
}

export function useRemoveFromWhitelist(circleAddress: `0x${string}`) {
  const w = useCircleWrite();
  function remove(addresses: `0x${string}`[]) {
    w.writeContract({
      address: circleAddress,
      abi: circleAbi,
      functionName: "removeFromWhitelist",
      args: [addresses],
    });
  }
  return { remove, ...w };
}
