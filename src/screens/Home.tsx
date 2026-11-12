import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ethers } from 'ethers';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';

import { xColors } from '../theme';
import { getFeed, type CawItem, type Session } from '../lib/api';
import { likeAction, recawAction } from '../lib/actions';
import { getBalances, type OwnedName } from '../lib/mint';
import type { NetworkPreset } from '../config';
import { STRINGS, fmt, type Lang } from '../i18n';
import NameCard from '../components/NameCard';

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet | null;
  preset: NetworkPreset;
  session: Session | null;
  senderId: number | null;
  names: OwnedName[];
  onGoMint: () => void;
  onGoNode: () => void;
  onCompose: () => void;
}

// X-style building blocks (presentation only).
const xCard = {
  backgroundColor: xColors.bg,
  borderWidth: 1,
  borderColor: xColors.border,
  borderRadius: 16,
  padding: 16,
  gap: 6,
} as const;
const xSub = { fontSize: 12, color: xColors.sub, lineHeight: 17 } as const;
const xButton = {
  backgroundColor: xColors.accent,
  borderRadius: 999,
  paddingVertical: 10,
  alignItems: 'center',
  marginTop: 6,
} as const;
const xButtonText = { color: '#ffffff', fontSize: 15, fontWeight: '700' } as const;

const AVATAR_COLORS = ['#1d9bf0', '#794bc4', '#f91880', '#00ba7c', '#ff7a00', '#0f7b6c'];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// Generated initial avatar, mirroring the fallback rendering in NameCard
// (the feed API carries no avatar images).
function FeedAvatar({ item }: { item: CawItem }) {
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

function timeLabel(iso: string, lang: Lang): string {
  const t = STRINGS[lang];
  const d = new Date(iso);
  const diffMin = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (diffMin < 60) return fmt(t.minAgo, { n: diffMin });
  if (diffMin < 60 * 24) return fmt(t.hourAgo, { n: Math.floor(diffMin / 60) });
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Home({ lang, wallet, preset, session, senderId, names, onGoMint, onGoNode, onCompose }: Props) {
  const t = STRINGS[lang];
  const [balances, setBalances] = useState<{ eth: bigint; caw: bigint | null } | null>(null);

  useEffect(() => {
    if (!wallet) return;
    let live = true;
    getBalances(wallet, preset)
      .then((b) => live && setBalances(b))
      .catch(() => live && setBalances(null));
    return () => {
      live = false;
    };
  }, [wallet, preset, names]);
  const [items, setItems] = useState<CawItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (next?: string, replace = false) => {
      try {
        const page = await getFeed(session, next);
        setItems((prev) => (replace ? page.items : [...prev, ...page.items]));
        setCursor(page.nextCursor);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [session],
  );

  useEffect(() => {
    setLoading(true);
    load(undefined, true);
  }, [load]);

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    if (!wallet || !session || senderId == null) {
      Alert.alert(t.nameRequiredTitle, t.nameRequiredMsgAct);
      return;
    }
    try {
      await fn();
      Alert.alert(t.sentTitle, okMsg);
      load(undefined, true);
    } catch (e) {
      Alert.alert(t.failedTitle, e instanceof Error ? e.message : String(e));
    }
  };

  const renderItem = ({ item }: { item: CawItem }) => {
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
              marginTop: 10,
              paddingRight: 36,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 14 }}>💬</Text>
              <Text style={{ color: xColors.sub, fontSize: 13 }}>{item.commentCount}</Text>
            </View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              onPress={() => act(() => recawAction(wallet!, preset, session!, senderId!, item), t.recawed)}
            >
              <Text style={{ color: item.hasRecawed ? xColors.recaw : xColors.sub, fontSize: 16 }}>↻</Text>
              <Text style={{ color: item.hasRecawed ? xColors.recaw : xColors.sub, fontSize: 13 }}>
                {item.recawCount}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
              onPress={() =>
                act(
                  () => likeAction(wallet!, preset, session!, senderId!, item, !!item.hasLiked),
                  item.hasLiked ? t.unliked : t.liked,
                )
              }
            >
              <Text style={{ color: item.hasLiked ? xColors.like : xColors.sub, fontSize: 15 }}>♥</Text>
              <Text style={{ color: item.hasLiked ? xColors.like : xColors.sub, fontSize: 13 }}>
                {item.likeCount}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (!session) {
    const primary = names[0] ?? null;
    return (
      <View style={{ flex: 1, backgroundColor: xColors.bg }}>
        <LinearGradient
          colors={['#1d9bf0', '#14b8a6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: 76 }}
        />
        <View style={{ paddingHorizontal: 16 }}>
          <View
            style={{
              marginTop: -28,
              marginBottom: 8,
              width: 56,
              height: 56,
              borderRadius: 28,
              borderWidth: 3,
              borderColor: xColors.bg,
              backgroundColor: xColors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {primary?.imageSvg ? (
              <SvgXml xml={primary.imageSvg} width={56} height={56} />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 22 }}>
                {primary ? primary.name.replace(/^#/, '').charAt(0).toUpperCase() || 'C' : 'C'}
              </Text>
            )}
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: xColors.text }}>
            {primary ? `@${primary.name}` : t.myNames}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
          <View style={xCard}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: xColors.text }}>{t.myNames}</Text>
            {names.length === 0 ? (
              <Text style={xSub}>{t.noNamesYet}</Text>
            ) : (
              names.map((n) => <NameCard key={n.tokenId} name={n} lang={lang} />)
            )}
            <TouchableOpacity style={xButton} onPress={onGoMint}>
              <Text style={xButtonText}>{t.goMint}</Text>
            </TouchableOpacity>
          </View>
          <View style={xCard}>
            <Text style={xSub}>{t.balanceLabel}</Text>
            <Text style={{ fontSize: 19, fontWeight: '700', color: xColors.text }}>
              {balances
                ? balances.caw != null
                  ? `${Number(ethers.formatUnits(balances.caw, 18)).toLocaleString('ja-JP', { maximumFractionDigits: 0 })} CAW`
                  : `${Number(ethers.formatEther(balances.eth)).toFixed(5)} ETH`
                : '…'}
            </Text>
            {balances && balances.caw != null && (
              <Text style={xSub}>{Number(ethers.formatEther(balances.eth)).toFixed(5)} ETH</Text>
            )}
          </View>
          <View style={xCard}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: xColors.text }}>{t.timeline}</Text>
            <Text style={xSub}>{t.nodeSearching}</Text>
            <Text style={xSub}>{t.mintNoNodeNote}</Text>
            <TouchableOpacity style={xButton} onPress={onGoNode}>
              <Text style={xButtonText}>{t.nodeHomeCta}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: xColors.bg }}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={xColors.accent} />
      ) : error ? (
        <View style={{ padding: 16 }}>
          <View style={xCard}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: xColors.text }}>{t.feedErrorTitle}</Text>
            <Text style={xSub}>{error}</Text>
            <Text style={xSub}>{t.feedErrorHint}</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 0 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(undefined, true);
              }}
            />
          }
          onEndReached={() => cursor && load(cursor)}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <Text style={[xSub, { textAlign: 'center', marginTop: 32 }]}>
              {t.feedEmpty}
            </Text>
          }
        />
      )}
      <TouchableOpacity
        style={{
          position: 'absolute',
          right: 18,
          bottom: 22,
          backgroundColor: xColors.accent,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 3,
        }}
        onPress={onCompose}
      >
        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '600', lineHeight: 30 }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
