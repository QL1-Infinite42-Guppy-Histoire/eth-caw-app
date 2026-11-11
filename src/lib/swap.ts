import { ethers } from 'ethers';

import type { NetworkPreset } from '../config';
import { l1Provider } from './mint';

// CAW <-> ETH swaps on Ethereum mainnet via the Uniswap V2 pair
// (verified live 2026-11-11: pair 0x48D20b3e529fB3DD7D91293f80638dF582AB2Daa,
// reserves ~43.6T CAW / ~309.7 ETH). Quotes always come from the router's
// getAmountsOut; approvals are exact-amount only.

export const UNISWAP_V2_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
export const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

const ROUTER_ABI = [
  'function getAmountsOut(uint256,address[]) view returns (uint256[])',
  'function swapExactETHForTokens(uint256,address[],address,uint256) payable returns (uint256[])',
  'function swapExactTokensForETH(uint256,uint256,address[],address,uint256) returns (uint256[])',
];

const ERC20_ABI = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];

export type SwapDirection = 'ethToCaw' | 'cawToEth';

function path(preset: NetworkPreset, dir: SwapDirection): string[] {
  return dir === 'ethToCaw' ? [WETH, preset.cawTokenL1] : [preset.cawTokenL1, WETH];
}

export async function quoteSwap(
  preset: NetworkPreset,
  dir: SwapDirection,
  amountIn: bigint,
): Promise<bigint> {
  const router = new ethers.Contract(UNISWAP_V2_ROUTER, ROUTER_ABI, l1Provider(preset));
  const amounts: bigint[] = await router.getAmountsOut(amountIn, path(preset, dir));
  return amounts[amounts.length - 1];
}

export function minOutWithSlippage(quoted: bigint, slippagePct: number): bigint {
  const bps = BigInt(Math.round(slippagePct * 100));
  return (quoted * (10000n - bps)) / 10000n;
}

export type SwapStep = 'approving' | 'swapping' | 'confirming';

export async function executeSwap(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
  dir: SwapDirection,
  amountIn: bigint,
  minOut: bigint,
  onStep?: (step: SwapStep) => void,
): Promise<{ txHash: string }> {
  const provider = l1Provider(preset);
  const signer = wallet.connect(provider);
  const router = new ethers.Contract(UNISWAP_V2_ROUTER, ROUTER_ABI, signer);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

  let tx;
  if (dir === 'ethToCaw') {
    onStep?.('swapping');
    tx = await router.swapExactETHForTokens(minOut, path(preset, dir), wallet.address, deadline, {
      value: amountIn,
    });
  } else {
    const token = new ethers.Contract(preset.cawTokenL1, ERC20_ABI, signer);
    const allowance: bigint = await token.allowance(wallet.address, UNISWAP_V2_ROUTER);
    if (allowance < amountIn) {
      onStep?.('approving');
      const atx = await token.approve(UNISWAP_V2_ROUTER, amountIn);
      await atx.wait();
    }
    onStep?.('swapping');
    tx = await router.swapExactTokensForETH(amountIn, minOut, path(preset, dir), wallet.address, deadline);
  }
  onStep?.('confirming');
  await tx.wait();
  return { txHash: tx.hash as string };
}
