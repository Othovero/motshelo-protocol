"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { decodeEventLog } from "viem";
import { useChainId } from "wagmi";
import { motsheloFactoryAbi } from "@/lib/contracts/abis";
import { getAddresses } from "@/lib/contracts/addresses";

const abi = motsheloFactoryAbi;

function useFactoryAddress() {
  const chainId = useChainId();
  return getAddresses(chainId).factory;
}

export function useAllCircles(offset: number, limit: number) {
  const address = useFactoryAddress();
  return useReadContract({
    address,
    abi,
    functionName: "getAllCircles",
    args: [BigInt(offset), BigInt(limit)],
    query: { enabled: address !== "0x0000000000000000000000000000000000000000" },
  });
}

export function useUserCircles(userAddress: `0x${string}` | undefined) {
  const address = useFactoryAddress();
  return useReadContract({
    address,
    abi,
    functionName: "getUserCircles",
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled:
        !!userAddress &&
        address !== "0x0000000000000000000000000000000000000000",
    },
  });
}

export function useCircleCount() {
  const address = useFactoryAddress();
  return useReadContract({
    address,
    abi,
    functionName: "getCircleCount",
    query: { enabled: address !== "0x0000000000000000000000000000000000000000" },
  });
}

export type CircleConfigStruct = {
  circleType: number;
  contributionAmount: bigint;
  contributionFrequency: bigint;
  maxMembers: bigint;
  minMembersToActivate: bigint;
  payoutOrder: number;
  splitMethod: number;
  missPolicy: number;
  gracePeriod: bigint;
  earlyExitAllowed: boolean;
  maturityTimestamp: bigint;
  communityReserveBps: bigint;
  joinVisibility: number;
};

export function useCreateCircle() {
  const chainId = useChainId();
  const factoryAddress = getAddresses(chainId).factory;
  const usdtAddress = getAddresses(chainId).usdt;

  const {
    data: hash,
    writeContract,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } =
    useWaitForTransactionReceipt({ hash });

  const circleDeployedAddress = receipt?.logs
    ? (() => {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "CircleDeployed") {
              return (decoded.args as { circle: `0x${string}` }).circle;
            }
          } catch {
            // not our event
          }
        }
        return undefined;
      })()
    : undefined;

  function create(
    config: CircleConfigStruct,
    name: string,
    description: string,
    imageUri: string
  ) {
    writeContract({
      address: factoryAddress,
      abi,
      functionName: "createCircle",
      args: [usdtAddress, config, name, description, imageUri],
    });
  }

  return {
    create,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
    deployedAddress: circleDeployedAddress,
  };
}
