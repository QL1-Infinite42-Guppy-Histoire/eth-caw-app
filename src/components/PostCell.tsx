import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { xColors } from '../theme';
import type { CawItem } from '../lib/api';
import { STRINGS, fmt, type Lang } from '../i18n';
import UserAvatar from './UserAvatar';
import { BookmarkIcon, HeartIcon, RecawIcon, ReplyIcon, ViewsIcon } from './icons';

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
export function FeedAvatar({ item, size = 48 }: { item: CawItem; size?: number }) {
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
 * Thread reply lists. Layout per the finished design: 48px avatar, bold
 * display name on its own line, "@name · time" in gray below it, body,
 * then the SVG action row: reply · recaw · like · views · bookmark.
 *
 * A plain recaw (RECAW action, no own text) is displayed the way X shows
 * a repost: a "{name} recawed" context line over the ORIGINAL post, and
 * actions target the original. Counts render only when the payload
 * actually carries them as numbers — nothing is ever estimated locally.
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
    typeof n === 'number' ? <Text style={{ fontSize: 13 }}>{n}</Text> : null;

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 30, marginBottom: 4 }}>
          <RecawIcon size={14} color={xColors.sub} />
          <Text style={{ fontSize: 13, color: xColors.sub, fontWeight: '600' }}>
            {fmt(t.recawedBy, { name: recawerName })}
          </Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity
          onPress={onUserPress ? () => onUserPress(shown.user) : undefined}
          disabled={!onUserPress}
          activeOpacity={0.7}
        >
          <FeedAvatar item={shown} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={onUserPress ? () => onUserPress(shown.user) : undefined}
            disabled={!onUserPress}
            activeOpacity={0.7}
          >
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: xColors.text }}>
              {name}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 14, color: xColors.sub, marginTop: 1 }}>
              {shown.user.username ? `@${shown.user.username}` : `#${shown.user.tokenId}`} ·{' '}
              {timeLabel(shown.timestamp, lang)}
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 15, color: xColors.text, lineHeight: 21, marginTop: 3 }}>
            {shown.content}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 10,
              paddingRight: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <ReplyIcon size={17} color={xColors.sub} />
              <Text style={{ color: xColors.sub }}>{count(shown.commentCount)}</Text>
            </View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              onPress={onRecaw ? () => onRecaw(shown) : undefined}
              disabled={!onRecaw}
              hitSlop={6}
            >
              <RecawIcon size={18} color={shown.hasRecawed ? xColors.recaw : xColors.sub} />
              <Text style={{ color: shown.hasRecawed ? xColors.recaw : xColors.sub }}>
                {count(shown.recawCount)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              onPress={onLike ? () => onLike(shown) : undefined}
              disabled={!onLike}
              hitSlop={6}
            >
              <HeartIcon
                size={17}
                color={shown.hasLiked ? xColors.like : xColors.sub}
                filled={!!shown.hasLiked}
              />
              <Text style={{ color: shown.hasLiked ? xColors.like : xColors.sub }}>
                {count(shown.likeCount)}
              </Text>
            </TouchableOpacity>
            {typeof shown.viewCount === 'number' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <ViewsIcon size={17} color={xColors.sub} />
                <Text style={{ color: xColors.sub, fontSize: 13 }}>{compactCount(shown.viewCount)}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => onToggleBookmark(shown)} hitSlop={8} style={{ padding: 2 }}>
              <BookmarkIcon
                size={17}
                color={bookmarked ? xColors.accent : xColors.sub}
                filled={bookmarked}
              />
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
