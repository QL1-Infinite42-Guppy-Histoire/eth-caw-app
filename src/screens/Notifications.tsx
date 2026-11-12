import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { xColors } from '../theme';
import { getNotifications, type AppNotification, type Session } from '../lib/api';
import { STRINGS, fmt, type Lang } from '../i18n';
import { timeLabel } from '../components/PostCell';

interface Props {
  lang: Lang;
  session: Session | null;
  senderId: number | null;
  onClose: () => void;
}

const AVATAR_COLORS = ['#1d9bf0', '#794bc4', '#f91880', '#00ba7c', '#ff7a00', '#0f7b6c'];

function actorAvatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function ActorAvatar({ n }: { n: AppNotification }) {
  const a = n.actor;
  if (a?.avatarUrl) {
    return <Image source={{ uri: a.avatarUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />;
  }
  const label = a?.displayName ?? a?.username ?? 'C';
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: actorAvatarColor(a ? `${a.username ?? ''}:${a.tokenId}` : 'caw'),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
        {(label.charAt(0) || 'C').toUpperCase()}
      </Text>
    </View>
  );
}

function typeGlyph(type: string): { glyph: string; color: string } {
  switch (type) {
    case 'LIKE':
      return { glyph: '♥', color: xColors.like };
    case 'REPOST':
      return { glyph: '↻', color: xColors.recaw };
    case 'FOLLOW':
      return { glyph: '👤', color: xColors.accent };
    case 'MENTION':
      return { glyph: '@', color: xColors.accent };
    case 'REPLY':
      return { glyph: '💬', color: xColors.accent };
    case 'QUOTE':
      return { glyph: '❝', color: xColors.accent };
    case 'TIP':
      return { glyph: '🪙', color: xColors.sub };
    case 'VOTE':
      return { glyph: '📊', color: xColors.sub };
    case 'ACTION_FAILED':
      return { glyph: '⚠', color: xColors.danger };
    default:
      return { glyph: '🔔', color: xColors.sub };
  }
}

export default function Notifications({ lang, session, senderId, onClose }: Props) {
  const t = STRINGS[lang];
  const [items, setItems] = useState<AppNotification[]>([]);
  const [segment, setSegment] = useState<'all' | 'mentions'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(
    async (offset: number, replace: boolean) => {
      if (!session || senderId == null) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      try {
        const page = await getNotifications(session, senderId, { limit: 50, offset });
        setItems((prev) => (replace ? page.notifications : [...prev, ...page.notifications]));
        setHasMore(page.hasMore);
        setErrorStatus(null);
      } catch (e) {
        setErrorStatus((e as { status?: number })?.status ?? -1);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [session, senderId],
  );

  useEffect(() => {
    setLoading(true);
    void load(0, true);
  }, [load]);

  const textFor = (n: AppNotification): string => {
    const a = n.actor;
    const name = a?.displayName ?? (a?.username ? `@${a.username}` : a ? `#${a.tokenId}` : 'CAW');
    const tpl =
      n.type === 'LIKE'
        ? t.notifLiked
        : n.type === 'REPOST'
          ? t.notifRecawed
          : n.type === 'FOLLOW'
            ? t.notifFollowed
            : n.type === 'MENTION'
              ? t.notifMentioned
              : n.type === 'REPLY'
                ? t.notifReplied
                : n.type === 'QUOTE'
                  ? t.notifQuoted
                  : n.type === 'TIP'
                    ? t.notifTipped
                    : t.notifGeneric;
    const base = fmt(tpl, { name });
    return n.count > 1 ? `${base} ${fmt(t.notifOthers, { n: n.count - 1 })}` : base;
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const { glyph, color } = typeGlyph(item.type);
    const expanded = expandedId === item.id;
    return (
      <TouchableOpacity
        onPress={() => setExpandedId(expanded ? null : item.id)}
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
        <View style={{ width: 28, alignItems: 'center', paddingTop: 2 }}>
          <Text style={{ fontSize: 17, color, fontWeight: '700' }}>{glyph}</Text>
        </View>
        <ActorAvatar n={item} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: xColors.text, lineHeight: 19 }}>{textFor(item)}</Text>
          {item.caw?.content ? (
            <Text numberOfLines={2} style={{ fontSize: 14, color: xColors.sub, lineHeight: 19, marginTop: 2 }}>
              {item.caw.content}
            </Text>
          ) : null}
          {expanded && (
            <Text style={{ fontSize: 12, color: xColors.sub, marginTop: 4 }}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ fontSize: 12, color: xColors.sub }}>{timeLabel(item.createdAt, lang)}</Text>
          {!item.isRead && (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: xColors.accent }} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const visible = segment === 'mentions' ? items.filter((n) => n.type === 'MENTION') : items;

  return (
    <View style={{ flex: 1, backgroundColor: xColors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: xColors.border,
        }}
      >
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Text style={{ fontSize: 20, color: xColors.text }}>✕</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '800', color: xColors.text }}>{t.notifTitle}</Text>
      </View>

      {!session || senderId == null ? (
        <Text style={{ fontSize: 13, color: xColors.sub, lineHeight: 19, textAlign: 'center', marginTop: 40, paddingHorizontal: 32 }}>
          {t.notifNeedSession}
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: xColors.border }}>
            {(
              [
                ['all', t.notifAll],
                ['mentions', t.notifMentions],
              ] as ['all' | 'mentions', string][]
            ).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}
                onPress={() => setSegment(key)}
              >
                <Text
                  style={{
                    fontSize: 15,
                    color: segment === key ? xColors.text : xColors.sub,
                    fontWeight: segment === key ? '800' : '400',
                  }}
                >
                  {label}
                </Text>
                {segment === key && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      height: 3,
                      width: 56,
                      borderRadius: 2,
                      backgroundColor: xColors.accent,
                    }}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={xColors.accent} />
          ) : errorStatus !== null ? (
            <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 32, gap: 12 }}>
              <Text style={{ fontSize: 13, color: xColors.sub, lineHeight: 19, textAlign: 'center' }}>
                {errorStatus === 404 ? t.notifNotProvided : t.notifLoadFailed}
              </Text>
              <TouchableOpacity
                style={{
                  borderWidth: 1,
                  borderColor: xColors.border,
                  borderRadius: 999,
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                }}
                onPress={() => {
                  setLoading(true);
                  void load(0, true);
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: xColors.text }}>{t.retryBtn}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={visible}
              keyExtractor={(n) => String(n.id)}
              renderItem={renderItem}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    void load(0, true);
                  }}
                />
              }
              onEndReached={() => {
                if (hasMore && !loadingMore) {
                  setLoadingMore(true);
                  void load(items.length, false);
                }
              }}
              onEndReachedThreshold={0.4}
              ListEmptyComponent={
                <Text style={{ fontSize: 13, color: xColors.sub, textAlign: 'center', marginTop: 40 }}>
                  {t.notifEmpty}
                </Text>
              }
            />
          )}
        </>
      )}
    </View>
  );
}
