import AsyncStorage from '@react-native-async-storage/async-storage';
import { ethers } from 'ethers';

import { STORAGE_KEYS, type NetworkPreset } from '../config';

// Thin client for a self-run CAW node API (the repo client's `client/` app).
// Auth is the personal_sign flow proven in staging:
//   message = "Verify wallet ownership for CAW\nHost: <host>\nChainId: <L2 id>\nTimestamp: <unix>"
//   POST /api/auth/verify {message, signature} -> session cookie + token ids.
// Ownership is judged from the node's index: a freshly minted name can
// answer 202 until the node's watcher has indexed the transfer.

export interface Session {
  cookie: string;
  sessionToken: string;
  authorizedTokenIds: number[];
  expiresAt: number;
  /** Wallet this session was verified for; a different wallet must not reuse it. */
  address?: string;
}

export class IndexingError extends Error {
  constructor() {
    super('ノードが名前を索引中です。少し待ってから再試行してください');
  }
}

let baseUrl = '';

export function setNodeUrl(url: string) {
  baseUrl = url.replace(/\/+$/, '');
}
export function getNodeUrl() {
  return baseUrl;
}

function hostOf(url: string): string {
  // "https://abc.trycloudflare.com" -> "abc.trycloudflare.com"
  // "http://127.0.0.1:4000" -> "127.0.0.1:4000"
  return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export async function loadSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.session);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (!s.expiresAt || s.expiresAt < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export async function saveSession(s: Session | null) {
  if (s) await AsyncStorage.setItem(STORAGE_KEYS.session, JSON.stringify(s));
  else await AsyncStorage.removeItem(STORAGE_KEYS.session);
}

export async function verifyWallet(
  wallet: ethers.HDNodeWallet,
  preset: NetworkPreset,
): Promise<Session> {
  if (!baseUrl) throw new Error('ノード URL が未設定です（設定タブで入力してください）');
  const ts = Math.floor(Date.now() / 1000);
  const message =
    `Verify wallet ownership for CAW\nHost: ${hostOf(baseUrl)}\n` +
    `ChainId: ${preset.l2ChainId}\nTimestamp: ${ts}`;
  const signature = await wallet.signMessage(message);
  const res = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  });
  if (res.status === 202) throw new IndexingError();
  if (res.status !== 200) {
    throw new Error(`認証に失敗しました (HTTP ${res.status})`);
  }
  const body = await res.json();
  const setCookie = (res.headers as Headers).get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0];
  const session: Session = {
    cookie,
    sessionToken: body.sessionToken,
    authorizedTokenIds: body.authorizedTokenIds ?? [],
    expiresAt: body.expiresAt ?? Date.now() + 24 * 3600 * 1000,
    address: wallet.address,
  };
  await saveSession(session);
  return session;
}

async function authedFetch(path: string, session: Session | null, init?: RequestInit) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.cookie) headers.Cookie = session.cookie;
  return fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
}

export interface CawItem {
  id: string;
  content: string;
  action: string;
  timestamp: string;
  cawonce: number;
  likeCount: number;
  recawCount: number;
  commentCount: number;
  hasLiked?: boolean;
  hasRecawed?: boolean;
  user: {
    tokenId: number;
    username: string | null;
    displayName: string | null;
    address: string;
  };
}

export async function getFeed(
  session: Session | null,
  cursor?: string,
): Promise<{ items: CawItem[]; nextCursor?: string }> {
  const q = new URLSearchParams({ limit: '30' });
  if (cursor) q.set('cursor', cursor);
  const res = await authedFetch(`/api/caws?${q.toString()}`, session);
  if (!res.ok) throw new Error(`タイムライン取得に失敗しました (HTTP ${res.status})`);
  const body = await res.json();
  return { items: body.items ?? [], nextCursor: body.nextCursor };
}

// The tip is proposed by the connected node, but the signature that pays it
// is the user's — so never sign more than this cap, whatever a node claims.
// (Protocol default is 1,000 CAW; the cap is 10x that.)
export const MAX_VALIDATOR_TIP = 10000n;

export async function getValidatorTip(): Promise<bigint> {
  const res = await fetch(`${baseUrl}/api/validator-analytics/tip-config`);
  if (!res.ok) throw new Error('tip 設定の取得に失敗しました');
  const body = await res.json();
  const tip = BigInt(body.baseTip ?? 1000);
  return tip > MAX_VALIDATOR_TIP ? MAX_VALIDATOR_TIP : tip;
}

export async function submitAction(
  session: Session,
  payload: unknown,
): Promise<{ txQueueId: number; cawId?: number }> {
  const res = await authedFetch('/api/actions', session, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(body?.error || body?.message || `送信に失敗しました (HTTP ${res.status})`);
  }
  return body;
}
