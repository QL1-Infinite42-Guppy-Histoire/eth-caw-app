import { ethers } from 'ethers';

import type { NetworkPreset } from '../config';

// Name minting is a plain L1 transaction flow — no CAW node involved:
//   1. check the name (valid / free) and its burn cost on CawProfileMinter
//   2. quote the LayerZero sync fee on CawProfileQuoter
//   3. approve CAW (burn + deposit) if needed
//   4. CawProfileMinter.mintAndDeposit(...) payable with the quoted fee
// All values are read live from the contracts; nothing is hard-coded.

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];

const PROFILE_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'function nextId() view returns (uint256)',
  'function tokenURI(uint256) view returns (string)',
];

const MINTER_ABI = [
  'function isValidUsername(string) view returns (bool)',
  'function idByUsername(string) view returns (uint256)',
  'function costOfName(string) view returns (uint256)',
  'function mintAndDeposit(uint32 networkId,string username,uint256 depositAmount,uint32 lzDestId,uint256 lzTokenAmount) payable',
];

const QUOTER_ABI = [
  'function mintAndDepositQuote(uint32 networkId,uint256 depositAmount,uint32 lzDestId,bool payInLzToken) view returns (tuple(uint256 nativeFee, uint256 lzTokenFee))',
];

export interface OwnedName {
  tokenId: number;
  name: string;
  /** Decoded SVG artwork from the NFT metadata, when present. */
  imageSvg: string | null;
  /** CAW deposited under this name on the L2 ledger (null when unread). */
  depositCaw: bigint | null;
}

const LEDGER_ABI = ['function cawBalanceOf(uint32) view returns (uint256)'];

export interface NameCheck {
  valid: boolean;
  taken: boolean;
  tokenId: number | null;
  burn: bigint;
}

export function l1Provider(preset: NetworkPreset): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(preset.l1RpcUrl);
}

export function mintSupported(preset: NetworkPreset): boolean {
  return !!preset.cawTokenL1 && !!preset.cawProfileMinterL1 && !!preset.cawProfileQuoterL1;
}

export async function getBalances(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
): Promise<{ eth: bigint; caw: bigint | null }> {
  const provider = l1Provider(preset);
  const eth = await provider.getBalance(wallet.address);
  let caw: bigint | null = null;
  if (preset.cawTokenL1) {
    const token = new ethers.Contract(preset.cawTokenL1, ERC20_ABI, provider);
    caw = await token.balanceOf(wallet.address);
  }
  return { eth, caw };
}

// Pure-JS base64 decode (React Native has no global Buffer). The tokenURI
// JSON and the username itself are ASCII, so byte->char mapping is safe here.
function b64ToAscii(b64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const ch of b64.replace(/=+$/, '')) {
    const v = chars.indexOf(ch);
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
}

function metaFromTokenUri(uri: string): { name: string | null; imageSvg: string | null } {
  try {
    const b64 = uri.split(',')[1];
    if (!b64) return { name: null, imageSvg: null };
    const json = JSON.parse(b64ToAscii(b64));
    let imageSvg: string | null = null;
    if (typeof json.image === 'string' && json.image.startsWith('data:image/svg+xml;base64,')) {
      imageSvg = b64ToAscii(json.image.slice('data:image/svg+xml;base64,'.length));
    }
    return {
      name: typeof json.name === 'string' ? json.name : null,
      imageSvg,
    };
  } catch {
    return { name: null, imageSvg: null };
  }
}

/**
 * Names owned by this wallet on the preset's deployment. Scans token ids
 * from the newest downwards (the name count is small at launch); stops as
 * soon as every owned name has been found.
 */
export async function fetchOwnedNames(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
): Promise<OwnedName[]> {
  const provider = l1Provider(preset);
  const profile = new ethers.Contract(preset.cawProfileL1, PROFILE_ABI, provider);
  const balance: bigint = await profile.balanceOf(wallet.address);
  if (balance === 0n) return [];
  const next: bigint = await profile.nextId();
  const found: OwnedName[] = [];
  const maxScan = 1000;
  let scanned = 0;
  for (let id = next - 1n; id >= 1n && scanned < maxScan; id--, scanned++) {
    let owner: string;
    try {
      owner = await profile.ownerOf(id);
    } catch {
      continue;
    }
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) continue;
    let meta = { name: null as string | null, imageSvg: null as string | null };
    try {
      meta = metaFromTokenUri(await profile.tokenURI(id));
    } catch {
      /* keep nulls */
    }
    found.push({
      tokenId: Number(id),
      name: meta.name ?? `#${id.toString()}`,
      imageSvg: meta.imageSvg,
      depositCaw: null,
    });
    if (BigInt(found.length) >= balance) break;
  }
  const ordered = found.reverse();
  // Per-name deposited balances live on the L2 ledger (Base).
  if (preset.cawProfileLedgerL2 && ordered.length > 0) {
    try {
      const l2 = new ethers.JsonRpcProvider(preset.l2RpcUrl);
      const ledger = new ethers.Contract(preset.cawProfileLedgerL2, LEDGER_ABI, l2);
      await Promise.all(
        ordered.map(async (n) => {
          try {
            n.depositCaw = await ledger.cawBalanceOf(n.tokenId);
          } catch {
            n.depositCaw = null;
          }
        }),
      );
    } catch {
      /* deposits stay null */
    }
  }
  return ordered;
}

export async function checkName(preset: NetworkPreset, name: string): Promise<NameCheck> {
  const provider = l1Provider(preset);
  const minter = new ethers.Contract(preset.cawProfileMinterL1, MINTER_ABI, provider);
  const valid: boolean = await minter.isValidUsername(name);
  const id: bigint = await minter.idByUsername(name);
  const burn: bigint = await minter.costOfName(name);
  return {
    valid,
    taken: id !== 0n,
    tokenId: id === 0n ? null : Number(id),
    burn,
  };
}

/** LayerZero native fee (ETH) to sync a mint+deposit to the L2 ledger. */
export async function quoteMintFee(preset: NetworkPreset, deposit: bigint): Promise<bigint> {
  const provider = l1Provider(preset);
  const quoter = new ethers.Contract(preset.cawProfileQuoterL1, QUOTER_ABI, provider);
  const fee = await quoter.mintAndDepositQuote(
    preset.cawNetworkId,
    deposit,
    preset.lzDestEid,
    false,
  );
  return fee.nativeFee as bigint;
}

export type MintStep = 'approving' | 'minting' | 'confirming';

/**
 * Mint `name` for the wallet's own address. Pays burn + deposit in CAW and
 * the LayerZero fee in ETH (quoted live, +20% buffer; the contract refunds
 * the excess). Returns the new token id.
 */
export async function mintName(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
  name: string,
  deposit: bigint,
  onStep?: (step: MintStep) => void,
): Promise<{ tokenId: number; txHash: string }> {
  const provider = l1Provider(preset);
  const signer = wallet.connect(provider);
  const minter = new ethers.Contract(preset.cawProfileMinterL1, MINTER_ABI, signer);
  const token = new ethers.Contract(preset.cawTokenL1, ERC20_ABI, signer);

  const burn: bigint = await minter.costOfName(name);
  const total = burn + deposit;
  const cawBal: bigint = await token.balanceOf(wallet.address);
  if (cawBal < total) {
    throw new Error(
      `CAW が足りません（必要 ${ethers.formatUnits(total, 18)} CAW / 保有 ${ethers.formatUnits(cawBal, 18)} CAW）`,
    );
  }
  const fee = await quoteMintFee(preset, deposit);
  const value = (fee * 120n) / 100n;
  const ethBal = await provider.getBalance(wallet.address);
  if (ethBal < value) {
    throw new Error(
      `ETH が足りません（同期手数料に約 ${ethers.formatEther(value)} ETH 必要です）`,
    );
  }

  const allowance: bigint = await token.allowance(wallet.address, preset.cawProfileMinterL1);
  if (allowance < total) {
    onStep?.('approving');
    const atx = await token.approve(preset.cawProfileMinterL1, total);
    await atx.wait();
  }

  onStep?.('minting');
  const tx = await minter.mintAndDeposit(
    preset.cawNetworkId,
    name,
    deposit,
    preset.lzDestEid,
    0,
    { value },
  );
  onStep?.('confirming');
  await tx.wait();

  const id: bigint = await minter.idByUsername(name);
  return { tokenId: Number(id), txHash: tx.hash as string };
}
