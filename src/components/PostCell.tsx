import React from 'react';
import { Share, Text, TouchableOpacity, View } from 'react-native';

import { xColors } from '../theme';
import type { CawItem } from '../lib/api';
import { STRINGS, fmt, type Lang } from '../i18n';
import UserAvatar from './UserAvatar';
import { BookmarkIcon, HeartIcon, RecawIcon, ReplyIcon, ShareIcon, ViewsIcon } from './icons';

export function timeLabel(iso: string, lang: Lang): string {
  const t = STRINGS[lang];
  const d = new Date(iso);
  const diffMin = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (diffMin < 60) return fmt(t.minAgo, { n: diffMin });
  if (diffMin < 60 * 24) return fmt(t.hourAgo, { n: Math.floor(diffMin / 60) });
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 999 → "999", 1234 → "1.2K", 2_500_000 → "2.5M" (used for view counts). */
export function compactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n < 1000) return String(Math.floor(n));
  const trim = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  if (n < 1_000_000) return `${trim(Math.round((n / 1000) * 10) / 10)}K`;
  return `${trim(Math.round((n / 1_000_000) * 10) / 10)}M`;
}

/** Kept for compatibility: the feed avatar is the shared generated avatar. */
export function FeedAvatar({ item, size = 44 }: { item: CawItem; size?: number }) {
  const label = item.user.displayName ?? item.user.username ?? item.user.address.slice(2);
  return (
    <UserAvatar
      label={label}
      seed={item.user.address || item.user.username || String(item.user.tokenId)}
      size={size}
    />
  );
}

export interface PostUserRef {
  tokenId: number;
  username: string | null;
  displayName: string | null;
  address: string;
}

interface Props {
  item: CawItem;
  lang: Lang;
  bookmarked: boolean;
  onToggleBookmark: (item: CawItem) => void;
  /** When omitted, like/recaw render as display-only counts. */
  onLike?: (item: CawItem) => void;
  onRecaw?: (item: CawItem) => void;
  /** Open the thread view for the (displayed) post. */
  onPress?: (item: CawItem) => void;
  /** Open the profile of the (displayed) post's author. */
  onUserPress?: (user: PostUserRef) => void;
}

/**
 * The X-style post cell shared by Home, Bookmarks, Search, Profile and
 * Thread reply lists. v0.4.0: metrics ported from the QL1 CAW app's
 * finished row (v0.6.4) — 44px avatar, bold display name on its own
 * line, "@name · time" in gray below it, body at 15/22, then ONE
 * action line (16px icons + compact counts, space-between, never
 * wraps): reply · recaw · like · views · bookmark · share. The share
 * button is last (X's position) and opens the OS share sheet with the
 * post's own words and author — plain text only; no per-post URL
 * exists, so none is attached.
 *
 * A plain recaw (RECAW action, no own text) is displayed the way X shows
 * a repost: a "{name} recawed" context line over the ORIGINAL post, and
 * actions (share included) target the original. Counts render only when
 * the payload actually carries them as numbers — nothing is ever
 * estimated locally.
 */
export default function PostCell({
  item,
  lang,
  bookmarked,
  onToggleBookmark,
  onLike,
  onRecaw,
  onPress,
  onUserPress,
}: Props) {
  const t = STRINGS[lang];
  const isPlainRecaw = item.action === 'RECAW' && !item.content && !!item.originalCaw;
  const shown = isPlainRecaw ? item.originalCaw! : item;
  const name = shown.user.displayName ?? shown.user.username ?? shown.user.address.slice(0, 10) + '…';
  const recawerName =
    item.user.displayName ?? (item.user.username ? `@${item.user.username}` : `#${item.user.tokenId}`);

  const count = (n: number | undefined) =>
    typeof n === 'number' ? <Text style={{ fontSize: 12 }}>{compactCount(n)}</Text> : null;

  /* Share (QL1 v0.6.4 rule): the OS share sheet carrying the post's
   * own words and its author — plain text only. No per-post URL
   * exists, so none is attached. Read-only: no signing, no chain. On
   * a recaw row this targets the ORIGINAL post, like every other
   * action on the row. */
  const onSharePost = () => {
    const who = shown.user.username ? `@${shown.user.username}` : `#${shown.user.tokenId}`;
    const message = shown.content ? `${shown.content}\n— ${who} · CAW` : `— ${who} · CAW`;
    Share.share({ message }).catch(() => {});
  };

  const actionBtn = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 5,
    marginStart: -5,
    borderRadius: 999,
  } as const;

  const body = (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: xColors.border,
        backgroundColor: xColors.bg,
      }}
    >
      {isPlainRecaw && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 36, marginBottom: 4 }}>
          <RecawIcon size={14} color={xColors.sub} />
          <Text style={{ fontSize: 12, color: xColors.sub, fontWeight: '600' }}>
            {fmt(t.recawedBy, { name: recawerName })}
          </Text>
        </View>
      )}
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity
          onPress={onUserPress ? () => onUserPress(shown.user) : undefined}
          disabled={!onUserPress}
          activeOpacity={0.7}
        >
          <FeedAvatar item={shown} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginStart: 10 }}>
          <TouchableOpacity
            onPress={onUserPress ? () => onUserPress(shown.user) : undefined}
            disabled={!onUserPress}
            activeOpacity={0.7}
          >
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: xColors.text }}>
              {name}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: xColors.sub }}>
              {shown.user.username ? `@${shown.user.username}` : `#${shown.user.tokenId}`} ·{' '}
              {timeLabel(shown.timestamp, lang)}
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 15, color: xColors.text, lineHeight: 22, marginTop: 2 }}>
            {shown.content}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <View style={actionBtn}>
              <ReplyIcon size={16} color={xColors.sub} />
              <Text style={{ color: xColors.sub }}>{count(shown.commentCount)}</Text>
            </View>
            <TouchableOpacity
              style={actionBtn}
              onPress={onRecaw ? () => onRecaw(shown) : undefined}
              disabled={!onRecaw}
              hitSlop={6}
            >
              <RecawIcon size={16} color={shown.hasRecawed ? xColors.recaw : xColors.sub} />
              <Text
                style={{
                  color: shown.hasRecawed ? xColors.recaw : xColors.sub,
                  fontWeight: shown.hasRecawed ? '700' : '400',
                }}
              >
                {count(shown.recawCount)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={actionBtn}
              onPress={onLike ? () => onLike(shown) : undefined}
              disabled={!onLike}
              hitSlop={6}
            >
              <HeartIcon
                size={16}
                color={shown.hasLiked ? xColors.like : xColors.sub}
                filled={!!shown.hasLiked}
              />
              <Text
                style={{
                  color: shown.hasLiked ? xColors.like : xColors.sub,
                  fontWeight: shown.hasLiked ? '700' : '400',
                }}
              >
                {count(shown.likeCount)}
              </Text>
            </TouchableOpacity>
            {typeof shown.viewCount === 'number' && (
              <View style={actionBtn}>
                <ViewsIcon size={16} color={xColors.sub} />
                <Text style={{ color: xColors.sub, fontSize: 12 }}>{compactCount(shown.viewCount)}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => onToggleBookmark(shown)} hitSlop={8} style={actionBtn}>
              <BookmarkIcon
                size={16}
                color={bookmarked ? xColors.accent : xColors.sub}
                filled={bookmarked}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSharePost}
              hitSlop={8}
              style={actionBtn}
              accessibilityLabel={t.shareLabel}
            >
              <ShareIcon size={16} color={xColors.sub} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => onPress(shown)}>
      {body}
    </TouchableOpacity>
  );
}
