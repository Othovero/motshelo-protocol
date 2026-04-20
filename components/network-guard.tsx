"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { bsc } from "wagmi/chains";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function NetworkGuard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) return null;
  if (chainId === bsc.id || chainId === 97 || chainId === 31337) return null;

  return (
    <div className="mx-auto max-w-md px-4 pt-2">
      <div className="flex items-center gap-3 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
        <AlertTriangle className="size-5 text-destructive shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-destructive">Wrong Network</p>
          <p className="text-[10px] text-destructive/80 mt-0.5">
            Please switch to BNB Smart Chain to use Motshelo.
          </p>
        </div>
        <button
          onClick={() => switchChain({ chainId: bsc.id })}
          disabled={isPending}
          className="shrink-0 rounded-lg bg-destructive px-3 py-1.5 text-[10px] font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            "Switch"
          )}
        </button>
      </div>
    </div>
  );
}
