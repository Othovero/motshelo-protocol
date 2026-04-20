"use client";

import { useReadContract, useChainId } from "wagmi";
import { motsheloRegistryAbi } from "@/lib/contracts/abis";
import { getAddresses } from "@/lib/contracts/addresses";

const abi = motsheloRegistryAbi;

export function useRegistryMetadata(circleAddress: `0x${string}` | undefined) {
  const chainId = useChainId();
  const registryAddress = getAddresses(chainId).registry;

  const { data, ...rest } = useReadContract({
    address: registryAddress,
    abi,
    functionName: "circleMetadata",
    args: circleAddress ? [circleAddress] : undefined,
    query: {
      enabled:
        !!circleAddress &&
        registryAddress !== "0x0000000000000000000000000000000000000000",
    },
  });

  const parsed = data
    ? {
        name: data[0] as string,
        description: data[1] as string,
        imageUri: data[2] as string,
        createdAt: data[3] as bigint,
        isVerified: data[4] as boolean,
      }
    : undefined;

  return { data: parsed, ...rest };
}

export function useIsRegistered(circleAddress: `0x${string}` | undefined) {
  const chainId = useChainId();
  const registryAddress = getAddresses(chainId).registry;

  return useReadContract({
    address: registryAddress,
    abi,
    functionName: "registeredCircles",
    args: circleAddress ? [circleAddress] : undefined,
    query: {
      enabled:
        !!circleAddress &&
        registryAddress !== "0x0000000000000000000000000000000000000000",
    },
  });
}
