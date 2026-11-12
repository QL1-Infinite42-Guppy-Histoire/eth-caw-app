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
import { loadBookmarks, toggleBookmark, type Bookmark } from '../lib/bookmarks';
import { getBalances, type OwnedName } from '../lib/mint';
import type { NetworkPreset } from '../config';
import { STRINGS, type Lang } from '../i18n';
import NameCard from '../components/NameCard';
import PostCell from '../components/PostCell';
import { BookmarkIcon } from '../components/icons';

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
  onGoBookmarks: () => void;
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

export default function Home({ lang, wallet, preset, session, senderId, names, onGoMint, onGoNode, onCompose, onGoBookmarks }: Props) {
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

  // On-device bookmarks (local only; reloaded on mount so changes made on
  // the Bookmarks screen are reflected when the user comes back here).
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  useEffect(() => {
    let live = true;
    loadBookmarks().then((b) => live && setBookmarks(b));
    return () => {
      live = false;
    };
  }, []);
  const bookmarkedIds = new Set(bookmarks.map((b) => b.id));
  const toggleBm = async (it: CawItem) => {
    setBookmarks(await toggleBookmark(bookmarks, it));
  };

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

  const renderItem = ({ item }: { item: CawItem }) => (
    <PostCell
      item={item}
      lang={lang}
      bookmarked={bookmarkedIds.has(item.id)}
      onToggleBookmark={(it) => void toggleBm(it)}
      onRecaw={(it) => act(() => recawAction(wallet!, preset, session!, senderId!, it), t.recawed)}
      onLike={(it) =>
        act(
          () => likeAction(wallet!, preset, session!, senderId!, it, !!it.hasLiked),
          it.hasLiked ? t.unliked : t.liked,
        )
      }
    />
  );

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
          <TouchableOpacity
            style={[xCard, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
            onPress={onGoBookmarks}
          >
            <BookmarkIcon size={19} color={xColors.text} />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: xColors.text }}>
              {t.bookmarksTitle}
            </Text>
            <Text style={{ fontSize: 18, color: xColors.sub }}>›</Text>
          </TouchableOpacity>
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
