"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { erc20Abi } from "@/lib/contracts/abis";
import { getAddresses } from "@/lib/contracts/addresses";

const abi = erc20Abi;

function useUsdtAddress() {
  const chainId = useChainId();
  return getAddresses(chainId).usdt;
}

export function useUsdtBalance(owner: `0x${string}` | undefined) {
  const usdtAddress = useUsdtAddress();
  return useReadContract({
    address: usdtAddress,
    abi,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: { enabled: !!owner },
  });
}

export function useUsdtAllowance(
  owner: `0x${string}` | undefined,
  spender: `0x${string}` | undefined
) {
  const usdtAddress = useUsdtAddress();
  return useReadContract({
    address: usdtAddress,
    abi,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!owner && !!spender },
  });
}

export function useApproveUsdt() {
  const usdtAddress = useUsdtAddress();
  const { data: hash, writeContract, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function approve(spender: `0x${string}`, amount: bigint) {
    writeContract({
      address: usdtAddress,
      abi,
      functionName: "approve",
      args: [spender, amount],
    });
  }

  return { approve, hash, isPending, isConfirming, isSuccess, error, reset };
}
