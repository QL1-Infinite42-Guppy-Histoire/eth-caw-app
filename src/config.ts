// Network presets for CAW — Ethereum Edition.
//
// The app talks to a self-run CAW node (API) and reads chain state for the
// selected network. The node URL is user-configurable in Settings (stored in
// AsyncStorage) because dev nodes are reached through tunnels whose URLs
// change, and the mainnet switch later is just a preset + URL change.

export interface NetworkPreset {
  id: string;
  label: string;
  /** CAW network id created on this deployment (Uruk = 1). */
  cawNetworkId: number;
  l1ChainId: number;
  l2ChainId: number;
  l1RpcUrl: string;
  l2RpcUrl: string;
  /** CawActions on the L2 — EIP-712 verifying contract for actions. */
  cawActionsL2: string;
  /** CawProfile (name NFT) on L1. */
  cawProfileL1: string;
  /** CawProfileLedger on the L2 (per-name deposited CAW balances). */
  cawProfileLedgerL2: string;
  /** CAW token on L1 ('' when minting is not wired for this preset). */
  cawTokenL1: string;
  /** CawProfileMinter on L1 (name minting). */
  cawProfileMinterL1: string;
  /** CawProfileQuoter on L1 (LayerZero fee quotes for mint/deposit). */
  cawProfileQuoterL1: string;
  /** LayerZero destination eid of the L2 (for mint/deposit sync). */
  lzDestEid: number;
  isTestnet: boolean;
}

export const TESTNET_PRESET: NetworkPreset = {
  id: 'testnet',
  label: 'Testnet (Sepolia / Base Sepolia)',
  cawNetworkId: 1,
  l1ChainId: 11155111,
  l2ChainId: 84532,
  l1RpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  l2RpcUrl: 'https://sepolia.base.org',
  cawActionsL2: '0x801d3df0C675058AC363af0b8DDb5B52147D90d4',
  cawProfileL1: '0xbbaA66afb60557e7f1D1517A0494F21C31c51EDE',
  cawProfileLedgerL2: '',
  cawTokenL1: '',
  cawProfileMinterL1: '',
  cawProfileQuoterL1: '',
  lzDestEid: 40245,
  isTestnet: true,
};

// Mainnet deployment completed 2026-11-11; addresses from the deploy state
// file (Caw/solidity/.deploy-state.json), wiring verified 43/43.
export const MAINNET_PRESET: NetworkPreset = {
  id: 'mainnet',
  label: 'Mainnet (Ethereum / Base)',
  cawNetworkId: 1,
  l1ChainId: 1,
  l2ChainId: 8453,
  l1RpcUrl: 'https://ethereum-rpc.publicnode.com',
  l2RpcUrl: 'https://mainnet.base.org',
  cawActionsL2: '0xf4dFCf0EF472E8aaD3783479051f61EC574C6A8E',
  cawProfileL1: '0xa3700808e1c62E989fbf5CE15312d79d1475bDb4',
  cawProfileLedgerL2: '0x206c99Ee5CFF8b5D761926ff224D867E1fBC7aaa',
  cawTokenL1: '0xf3b9569F82B18aEf890De263B84189bd33EBe452',
  cawProfileMinterL1: '0xf219DA7aF9249322D4E982dc49FcE6251bCE0d22',
  cawProfileQuoterL1: '0x4baBf4136707d6f4C096ea447Ec3285Cc2AF7235',
  lzDestEid: 30184,
  isTestnet: false,
};

export const PRESETS: NetworkPreset[] = [TESTNET_PRESET, MAINNET_PRESET];

/**
 * Public node registry. Community node operators are listed here (hosted on
 * the introduction site); the app fetches it and connects automatically, so
 * the timeline appears as soon as a node is online — no manual URL needed.
 */
export const NODE_LIST_URL =
  'https://ql1-infinite42-guppy-histoire.github.io/eth-caw/nodes.json';

/**
 * Dynamic node registry (Cloudflare Worker + KV). Nodes installed with the
 * one-touch installer announce their own URL here; the worker lists only
 * entries that answer right now with a real node API. Merged with the
 * static list above.
 */
export const REGISTRY_URL = 'https://eth-caw-registry.nepicobsv.workers.dev';

/** One-touch node installer, published with the node kit on the intro site. */
export const INSTALL_SCRIPT_URL =
  'https://ql1-infinite42-guppy-histoire.github.io/eth-caw/node-kit/install-node.sh';
export const INSTALL_COMMAND =
  'curl -fsSL https://ql1-infinite42-guppy-histoire.github.io/eth-caw/node-kit/install-node.sh | bash';

/** CAW deposited into a freshly minted name (enough for ~160 posts). */
export const MINT_DEPOSIT_CAW = '1000000';

export const STORAGE_KEYS = {
  nodeUrl: 'ethcaw.nodeUrl',
  myNodeUrl: 'ethcaw.myNodeUrl',
  presetId: 'ethcaw.presetId',
  session: 'ethcaw.session',
  lang: 'ethcaw.lang',
} as const;

/** EIP-712 domain for CAW actions (name/version fixed by the protocol). */
export function actionDomain(preset: NetworkPreset) {
  return {
    name: 'Caw Protocol',
    version: '1',
    chainId: preset.l2ChainId,
    verifyingContract: preset.cawActionsL2,
  } as const;
}

/** ActionData typed-data fields — exact shape proven by the staging E2E. */
export const ACTION_TYPES: Record<string, { name: string; type: string }[]> = {
  ActionData: [
    { name: 'actionType', type: 'uint8' },
    { name: 'senderId', type: 'uint32' },
    { name: 'receiverId', type: 'uint32' },
    { name: 'receiverCawonce', type: 'uint32' },
    { name: 'networkId', type: 'uint32' },
    { name: 'cawonce', type: 'uint32' },
    { name: 'recipients', type: 'uint32[]' },
    { name: 'amounts', type: 'uint64[]' },
    { name: 'text', type: 'bytes' },
  ],
};

export const ACTION_TYPE = {
  post: 0,
  like: 1,
  unlike: 2,
  recaw: 3,
  follow: 4,
  unfollow: 5,
} as const;
