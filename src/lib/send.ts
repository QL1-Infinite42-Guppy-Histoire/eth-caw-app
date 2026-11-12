import { ethers } from 'ethers';

import type { NetworkPreset } from '../config';

// Plain L1 transfers from the app wallet: native ETH and the CAW token.
// Everything happens on Ethereum L1 (that is where the wallet's spendable
// ETH and CAW live); no node is involved.

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
];

const PROFILE_ABI = ['function safeTransferFrom(address from, address to, uint256 tokenId)'];

export type SendAsset = 'ETH' | 'CAW' | 'NAME';

function l1(wallet: ethers.HDNodeWallet, preset: NetworkPreset) {
  const provider = new ethers.JsonRpcProvider(preset.l1RpcUrl);
  return { w: wallet.connect(provider), provider };
}

/** Estimated network fee (wei) for this send, for the confirm screen. */
export async function estimateSendFee(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
  asset: SendAsset,
  to: string,
  amount: bigint,
): Promise<bigint> {
  const { w, provider } = l1(wallet, preset);
  const feeData = await provider.getFeeData();
  const price = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  let gas: bigint;
  if (asset === 'ETH') {
    gas = await provider.estimateGas({ from: wallet.address, to, value: amount });
  } else {
    const token = new ethers.Contract(preset.cawTokenL1, ERC20_ABI, w);
    gas = await token.transfer.estimateGas(to, amount);
  }
  return gas * price;
}

/** Broadcast the transfer; resolves with the transaction hash. */
export async function sendAsset(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
  asset: SendAsset,
  to: string,
  amount: bigint,
): Promise<string> {
  const { w } = l1(wallet, preset);
  if (asset === 'ETH') {
    const tx = await w.sendTransaction({ to, value: amount });
    return tx.hash;
  }
  const token = new ethers.Contract(preset.cawTokenL1, ERC20_ABI, w);
  const tx = await token.transfer(to, amount);
  return tx.hash as string;
}

/** Estimated network fee (wei) for sending a name NFT, for the confirm screen. */
export async function estimateNameFee(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
  to: string,
  tokenId: bigint,
): Promise<bigint> {
  const { w, provider } = l1(wallet, preset);
  const feeData = await provider.getFeeData();
  const price = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
  const profile = new ethers.Contract(preset.cawProfileL1, PROFILE_ABI, w);
  const gas: bigint = await profile.safeTransferFrom.estimateGas(wallet.address, to, tokenId);
  return gas * price;
}

/**
 * Send a name NFT (CawProfile ERC-721 on L1) to another address.
 * The name's deposited CAW balance is keyed to the name itself, so it
 * moves together with the NFT.
 */
export async function sendName(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
  to: string,
  tokenId: bigint,
): Promise<string> {
  const { w } = l1(wallet, preset);
  const profile = new ethers.Contract(preset.cawProfileL1, PROFILE_ABI, w);
  const tx = await profile.safeTransferFrom(wallet.address, to, tokenId);
  return tx.hash as string;
}

export function explorerTxUrl(preset: NetworkPreset, hash: string): string {
  return preset.isTestnet
    ? `https://sepolia.etherscan.io/tx/${hash}`
    : `https://etherscan.io/tx/${hash}`;
}
