import { ethers } from 'ethers';

import { ACTION_TYPES, actionDomain, type NetworkPreset } from '../config';
import { getValidatorTip, submitAction, type CawItem, type Session } from './api';
import SmlTxt from './smltxt';

// Building + signing CAW actions (EIP-712), mirroring the node's FrontEnd
// conventions exactly (proven end-to-end in staging):
//  - text is smltxt-compressed UTF-8 bytes
//  - amounts = [] + trailing validator tip (whole CAW); the protocol action
//    cost (post 5000 / like 2000 / recaw 4000) is metered by the contract
//    from the sender's deposited balance, NOT carried in amounts
//  - cawonce comes from the CHAIN's nextCawonce(uint32). The node's
//    check-cawonces endpoint is DB-based and under-reports on a fresh node
//    DB; a reused cawonce never finalizes.

const CAW_ACTIONS_ABI = ['function nextCawonce(uint32) view returns (uint256)'];

let sml: SmlTxt | null = null;
function compressor(): SmlTxt {
  if (!sml) sml = SmlTxt.fromPkg();
  return sml;
}

export function compressText(text: string): string {
  return ethers.hexlify(compressor().compress(text));
}

export async function nextCawonceOnChain(preset: NetworkPreset, senderId: number): Promise<number> {
  const provider = new ethers.JsonRpcProvider(preset.l2RpcUrl);
  const contract = new ethers.Contract(preset.cawActionsL2, CAW_ACTIONS_ABI, provider);
  const next = await contract.nextCawonce(senderId);
  return Number(next);
}

export interface ActionDraft {
  actionType: number;
  receiverId?: number;
  receiverCawonce?: number;
  text?: string;
}

export async function signAndSubmit(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
  session: Session,
  senderId: number,
  draft: ActionDraft,
): Promise<{ txQueueId: number; cawId?: number }> {
  const [tip, cawonce] = await Promise.all([
    getValidatorTip(),
    nextCawonceOnChain(preset, senderId),
  ]);
  const domain = actionDomain(preset);
  const data = {
    actionType: draft.actionType,
    senderId,
    receiverId: draft.receiverId ?? 0,
    receiverCawonce: draft.receiverCawonce ?? 0,
    networkId: preset.cawNetworkId,
    cawonce,
    recipients: [] as number[],
    amounts: [tip.toString()],
    text: draft.text ? compressText(draft.text) : '0x',
  };
  const signature = await wallet.signTypedData(domain, ACTION_TYPES, data);
  return submitAction(session, { data, domain, types: ACTION_TYPES, signature });
}

export function postAction(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
  session: Session,
  senderId: number,
  text: string,
) {
  return signAndSubmit(wallet, preset, session, senderId, { actionType: 0, text });
}

export function likeAction(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
  session: Session,
  senderId: number,
  item: CawItem,
  unlike: boolean,
) {
  return signAndSubmit(wallet, preset, session, senderId, {
    actionType: unlike ? 2 : 1,
    receiverId: item.user.tokenId,
    receiverCawonce: item.cawonce,
  });
}

export function recawAction(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
  session: Session,
  senderId: number,
  item: CawItem,
) {
  return signAndSubmit(wallet, preset, session, senderId, {
    actionType: 3,
    receiverId: item.user.tokenId,
    receiverCawonce: item.cawonce,
  });
}
