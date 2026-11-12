import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { xColors } from '../theme';
import type { CawItem } from '../lib/api';
import { STRINGS, fmt, type Lang } from '../i18n';
import { BookmarkIcon } from './icons';

const AVATAR_COLORS = ['#1d9bf0', '#794bc4', '#f91880', '#00ba7c', '#ff7a00', '#0f7b6c'];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// Generated initial avatar, mirroring the fallback rendering in NameCard
// (the feed API carries no avatar images).
export function FeedAvatar({ item }: { item: CawItem }) {
  const label = item.user.displayName ?? item.user.username ?? item.user.address.slice(2);
  const initial = (label.charAt(0) || 'C').toUpperCase();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: avatarColor(item.user.address),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{initial}</Text>
    </View>
  );
}

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

interface Props {
  item: CawItem;
  lang: Lang;
  bookmarked: boolean;
  onToggleBookmark: (item: CawItem) => void;
  /** When omitted, like/recaw render as display-only counts. */
  onLike?: (item: CawItem) => void;
  onRecaw?: (item: CawItem) => void;
}

/**
 * The X-style post cell shared by Home and the Bookmarks screen.
 * Action row: reply count · recaw · like · views · bookmark.
 * The views segment renders ONLY when the node payload carried a real
 * numeric viewCount (node-aggregated; never estimated locally), in the
 * X position — right of like, before the bookmark.
 */
export default function PostCell({ item, lang, bookmarked, onToggleBookmark, onLike, onRecaw }: Props) {
  const name = item.user.displayName ?? item.user.username ?? item.user.address.slice(0, 10) + '…';
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: xColors.border,
        backgroundColor: xColors.bg,
      }}
    >
      <FeedAvatar item={item} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, color: xColors.text }}>
          <Text style={{ fontWeight: '700' }}>{name}</Text>
          <Text style={{ color: xColors.sub, fontWeight: '400' }}>
            {item.user.username ? ` @${item.user.username}` : ''} · {timeLabel(item.timestamp, lang)}
          </Text>
        </Text>
        <Text style={{ fontSize: 15, color: xColors.text, lineHeight: 20, marginTop: 2 }}>
          {item.content}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 10,
            paddingRight: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontSize: 14 }}>💬</Text>
            <Text style={{ color: xColors.sub, fontSize: 13 }}>{item.commentCount}</Text>
          </View>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            onPress={onRecaw ? () => onRecaw(item) : undefined}
            disabled={!onRecaw}
          >
            <Text style={{ color: item.hasRecawed ? xColors.recaw : xColors.sub, fontSize: 16 }}>↻</Text>
            <Text style={{ color: item.hasRecawed ? xColors.recaw : xColors.sub, fontSize: 13 }}>
              {item.recawCount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            onPress={onLike ? () => onLike(item) : undefined}
            disabled={!onLike}
          >
            <Text style={{ color: item.hasLiked ? xColors.like : xColors.sub, fontSize: 15 }}>♥</Text>
            <Text style={{ color: item.hasLiked ? xColors.like : xColors.sub, fontSize: 13 }}>
              {item.likeCount}
            </Text>
          </TouchableOpacity>
          {typeof item.viewCount === 'number' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 13 }}>📊</Text>
              <Text style={{ color: xColors.sub, fontSize: 13 }}>{compactCount(item.viewCount)}</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => onToggleBookmark(item)}
            hitSlop={8}
            style={{ padding: 2 }}
          >
            <BookmarkIcon
              size={17}
              color={bookmarked ? xColors.accent : xColors.sub}
              filled={bookmarked}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
