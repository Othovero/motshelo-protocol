import motsheloCircleJson from "./abis/MotsheloCircle.json";
import motsheloFactoryJson from "./abis/MotsheloFactory.json";
import feeCollectorJson from "./abis/FeeCollector.json";
import motsheloRegistryJson from "./abis/MotsheloRegistry.json";
import motsheloNftJson from "./abis/MotsheloNFT.json";

export const motsheloCircleAbi = motsheloCircleJson as typeof motsheloCircleJson;
export const motsheloFactoryAbi = motsheloFactoryJson as typeof motsheloFactoryJson;
export const feeCollectorAbi = feeCollectorJson as typeof feeCollectorJson;
export const motsheloRegistryAbi = motsheloRegistryJson as typeof motsheloRegistryJson;
export const motsheloNftAbi = motsheloNftJson as typeof motsheloNftJson;

export const erc20Abi = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
