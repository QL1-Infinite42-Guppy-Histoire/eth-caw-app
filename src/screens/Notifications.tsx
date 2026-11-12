import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { xColors } from '../theme';
import { getNotifications, type AppNotification, type Session } from '../lib/api';
import { STRINGS, fmt, type Lang } from '../i18n';
import { timeLabel } from '../components/PostCell';
import UserAvatar from '../components/UserAvatar';
import {
  BellIcon,
  CloseIcon,
  HeartIcon,
  PersonIcon,
  RecawIcon,
  ReplyIcon,
  ViewsIcon,
} from '../components/icons';

interface Props {
  lang: Lang;
  session: Session | null;
  senderId: number | null;
  /** When rendered as an overlay (legacy), a close button is shown. */
  onClose?: () => void;
}

function TypeBadge({ type }: { type: string }) {
  const spec = (() => {
    switch (type) {
      case 'LIKE':
        return { bg: '#fde7f1', icon: <HeartIcon size={16} color={xColors.like} filled /> };
      case 'REPOST':
        return { bg: '#e2f5ec', icon: <RecawIcon size={16} color={xColors.recaw} /> };
      case 'QUOTE':
        return { bg: '#e2f5ec', icon: <RecawIcon size={16} color={xColors.recaw} /> };
      case 'FOLLOW':
        return { bg: '#e1eefb', icon: <PersonIcon size={16} color={xColors.accent} /> };
      case 'MENTION':
        return { bg: '#e1eefb', icon: <ReplyIcon size={16} color={xColors.accent} /> };
      case 'REPLY':
        return { bg: '#e1eefb', icon: <ReplyIcon size={16} color={xColors.accent} /> };
      case 'VOTE':
        return { bg: '#eef3f4', icon: <ViewsIcon size={16} color={xColors.sub} /> };
      case 'ACTION_FAILED':
        return { bg: '#fdecec', icon: <BellIcon size={16} color={xColors.danger} /> };
      default:
        return { bg: '#eef3f4', icon: <BellIcon size={16} color={xColors.sub} /> };
    }
  })();
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: spec.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {spec.icon}
    </View>
  );
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
    const expanded = expandedId === item.id;
    const a = item.actor;
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
        <TypeBadge type={item.type} />
        <UserAvatar
          label={a?.displayName ?? a?.username ?? 'C'}
          seed={a ? `${a.username ?? ''}:${a.tokenId}` : 'caw'}
          size={40}
          avatarUrl={a?.avatarUrl}
        />
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
          paddingTop: 14,
          paddingBottom: 6,
        }}
      >
        {onClose && (
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <CloseIcon size={20} color={xColors.text} />
          </TouchableOpacity>
        )}
        <Text style={{ fontSize: 22, fontWeight: '800', color: xColors.text }}>{t.notifTitle}</Text>
      </View>

      {!session || senderId == null ? (
        <Text style={{ fontSize: 13, color: xColors.sub, lineHeight: 19, textAlign: 'center', marginTop: 40, paddingHorizontal: 32 }}>
          {t.notifNeedSession}
        </Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
            {(
              [
                ['all', t.notifAll],
                ['mentions', t.notifMentions],
              ] as ['all' | 'mentions', string][]
            ).map(([key, label]) => {
              const active = segment === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: active ? xColors.text : '#eef3f4',
                  }}
                  onPress={() => setSegment(key)}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: active ? '#ffffff' : xColors.sub,
                      fontWeight: active ? '800' : '600',
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
