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
  /**
   * Node-aggregated view count (Caw.viewCount on the node). Counted by the
   * node from client view reports, deduplicated per viewer over a rolling
   * 24h window — never recorded on-chain. Absent on nodes whose feed
   * payload predates the field; render only when a real number is present.
   */
  viewCount?: number;
  hasLiked?: boolean;
  hasRecawed?: boolean;
  /** True when this item is a quote (a recaw carrying its own text). */
  isQuote?: boolean;
  /**
   * For recaws/quotes: the original post this item points at, as shaped by
   * the node (same CawItem shape). Absent on plain posts and on nodes whose
   * payload predates the field.
   */
  originalCaw?: CawItem;
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

export interface NotificationActor {
  tokenId: number;
  username: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
}

export interface AppNotification {
  id: number;
  /** Upstream NotificationType: FOLLOW / LIKE / REPLY / REPOST / QUOTE / MENTION / TIP / … */
  type: string;
  actor: NotificationActor | null;
  additionalActors?: NotificationActor[];
  /** The related post, when the notification carries one (snippet source). */
  caw: { id: number; content: string; createdAt: string } | null;
  isRead: boolean;
  createdAt: string;
  /** Rollup size: how many raw notifications this row represents. */
  count: number;
}

export interface NotificationsPage {
  notifications: AppNotification[];
  unreadCount: number;
  hasMore: boolean;
}

/**
 * Read-only: GET /api/notifications for one of the session's names.
 * The route sits behind the node's requireAuth with ownership verification
 * (the query userId must be one of the session's authorized token ids) —
 * the same cookie session every other authed call uses. On failure the
 * thrown error carries `.status` so callers can tell "this node has no
 * notifications route" (404) apart from other load failures.
 */
export async function getNotifications(
  session: Session,
  userId: number,
  opts?: { limit?: number; offset?: number },
): Promise<NotificationsPage> {
  const q = new URLSearchParams({
    userId: String(userId),
    limit: String(opts?.limit ?? 50),
    offset: String(opts?.offset ?? 0),
  });
  const res = await authedFetch(`/api/notifications?${q.toString()}`, session);
  if (!res.ok) {
    const err = new Error(`通知の取得に失敗しました (HTTP ${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  return {
    notifications: body.notifications ?? [],
    unreadCount: body.unreadCount ?? 0,
    hasMore: !!body.hasMore,
  };
}

// ---------------------------------------------------------------------------
// v0.3.0 additive read-only endpoints (thread / profiles / search).
// Nothing above this line was changed; these are new exports only, built on
// the same authedFetch + node base URL as the existing reads.
// ---------------------------------------------------------------------------

export interface CawThread {
  caw: CawItem;
  /** Replies and quotes on the post (plain recaws are excluded upstream). */
  comments: CawItem[];
  hasMoreComments: boolean;
  nextCommentCursor?: number;
}

/**
 * Read-only: GET /api/caws/:id — one post plus its replies.
 * Throws an error carrying `.status` (404 = no such post on this node).
 */
export async function getCawThread(
  session: Session | null,
  id: string,
  commentCursor?: number,
): Promise<CawThread> {
  const q = new URLSearchParams({ commentLimit: '30' });
  if (commentCursor != null) q.set('commentCursor', String(commentCursor));
  const res = await authedFetch(`/api/caws/${encodeURIComponent(id)}?${q.toString()}`, session);
  if (!res.ok) {
    const err = new Error(`投稿の取得に失敗しました (HTTP ${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  return {
    caw: body.caw,
    comments: body.comments ?? [],
    hasMoreComments: !!body.hasMoreComments,
    nextCommentCursor: body.nextCommentCursor,
  };
}

export interface UserProfileData {
  tokenId: number;
  username: string;
  displayName: string | null;
  bio: string | null;
  address: string;
  avatarUrl?: string | null;
  coverPhotoUrl?: string | null;
  followerCount: number;
  followingCount: number;
  cawCount: number;
  isFollowing?: boolean;
}

/** Read-only: GET /api/users/:username — profile header data + counts. */
export async function getUserProfile(
  session: Session | null,
  username: string,
): Promise<UserProfileData> {
  const res = await authedFetch(`/api/users/${encodeURIComponent(username)}`, session);
  if (!res.ok) {
    const err = new Error(`プロフィールの取得に失敗しました (HTTP ${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as UserProfileData;
}

export interface UserByToken {
  tokenId: number;
  username: string | null;
  displayName: string | null;
  address: string;
  /**
   * The node's cached copy of the name's on-chain deposited CAW (wei
   * string). Null when the node's stake index has not seen a deposit —
   * callers must treat null as "unknown", never as zero.
   */
  onChainStakeWei?: string | null;
}

/** Read-only: GET /api/users/by-token/:tokenId. */
export async function getUserByToken(
  session: Session | null,
  tokenId: number,
): Promise<UserByToken> {
  const res = await authedFetch(`/api/users/by-token/${tokenId}`, session);
  if (!res.ok) {
    const err = new Error(`ユーザー取得に失敗しました (HTTP ${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as UserByToken;
}

export type UserCawsFilter = 'posts' | 'replies' | 'liked';

/**
 * Read-only: one user's posts via GET /api/caws?user=<name>, using the
 * node's own profile modes (posts excludes replies; replies = the user's
 * replies; liked = posts the user has liked).
 */
export async function getUserCaws(
  session: Session | null,
  username: string,
  filter: UserCawsFilter,
  cursor?: string,
): Promise<{ items: CawItem[]; nextCursor?: string }> {
  const q = new URLSearchParams({ user: username, limit: '30' });
  if (filter !== 'posts') q.set('filter', filter);
  if (cursor) q.set('cursor', cursor);
  const res = await authedFetch(`/api/caws?${q.toString()}`, session);
  if (!res.ok) throw new Error(`投稿の取得に失敗しました (HTTP ${res.status})`);
  const body = await res.json();
  return { items: body.items ?? [], nextCursor: body.nextCursor };
}

export interface SearchUser {
  tokenId: number;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  address?: string;
  followerCount?: number;
}

export interface SearchResults {
  users: SearchUser[];
  /** Ids of matching posts (reduced upstream shape) — hydrate via getCawsByIds. */
  cawIds: string[];
}

/**
 * Read-only: GET /api/search?q=&type=all — the node's own search over
 * names and post text (query must be at least 2 characters upstream).
 */
export async function searchAll(
  session: Session | null,
  query: string,
): Promise<SearchResults> {
  const q = new URLSearchParams({ q: query, type: 'all' });
  const res = await authedFetch(`/api/search?${q.toString()}`, session);
  if (!res.ok) throw new Error(`検索に失敗しました (HTTP ${res.status})`);
  const body = await res.json();
  return {
    users: (body.users ?? []) as SearchUser[],
    cawIds: ((body.caws ?? []) as { id: string }[]).map((c) => String(c.id)),
  };
}

/**
 * Read-only: POST /api/caws/by-ids — full post items for a set of ids,
 * in the order requested. Used to hydrate search results so every count
 * shown comes from the node's full payload, never from a partial one.
 */
export async function getCawsByIds(
  session: Session | null,
  ids: string[],
): Promise<CawItem[]> {
  if (ids.length === 0) return [];
  const res = await authedFetch('/api/caws/by-ids', session, {
    method: 'POST',
    body: JSON.stringify({ ids: ids.map((id) => Number(id)).filter((n) => Number.isFinite(n)) }),
  });
  if (!res.ok) throw new Error(`投稿の取得に失敗しました (HTTP ${res.status})`);
  const body = await res.json();
  return (body.items ?? []) as CawItem[];
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
