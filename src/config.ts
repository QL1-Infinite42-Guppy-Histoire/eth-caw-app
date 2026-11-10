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
  isTestnet: true,
};

// Filled in after the mainnet deployment lands; addresses are read from the
// deploy state file at that time. Kept disabled until then.
export const MAINNET_PRESET: NetworkPreset = {
  id: 'mainnet',
  label: 'Mainnet (Ethereum / Base)',
  cawNetworkId: 1,
  l1ChainId: 1,
  l2ChainId: 8453,
  l1RpcUrl: 'https://ethereum-rpc.publicnode.com',
  l2RpcUrl: 'https://mainnet.base.org',
  cawActionsL2: '',
  cawProfileL1: '',
  isTestnet: false,
};

export const PRESETS: NetworkPreset[] = [TESTNET_PRESET, MAINNET_PRESET];

export const STORAGE_KEYS = {
  nodeUrl: 'ethcaw.nodeUrl',
  presetId: 'ethcaw.presetId',
  session: 'ethcaw.session',
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
