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

import { xColors } from '../theme';
import { getFeed, type CawItem, type Session } from '../lib/api';
import { likeAction, recawAction } from '../lib/actions';
import { loadBookmarks, toggleBookmark, type Bookmark } from '../lib/bookmarks';
import type { NetworkPreset } from '../config';
import { STRINGS, type Lang } from '../i18n';
import PostCell, { type PostUserRef } from '../components/PostCell';

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet | null;
  preset: NetworkPreset;
  session: Session | null;
  senderId: number | null;
  onGoNode: () => void;
  onCompose: () => void;
  onOpenPost: (item: CawItem) => void;
  onOpenUser: (user: PostUserRef) => void;
}

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

export default function Home({
  lang,
  wallet,
  preset,
  session,
  senderId,
  onGoNode,
  onCompose,
  onOpenPost,
  onOpenUser,
}: Props) {
  const t = STRINGS[lang];
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
      bookmarked={bookmarkedIds.has(item.id) || (item.originalCaw ? bookmarkedIds.has(item.originalCaw.id) : false)}
      onToggleBookmark={(it) => void toggleBm(it)}
      onPress={onOpenPost}
      onUserPress={onOpenUser}
      onRecaw={(it) => act(() => recawAction(wallet!, preset, session!, senderId!, it), t.recawed)}
      onLike={(it) =>
        act(
          () => likeAction(wallet!, preset, session!, senderId!, it, !!it.hasLiked),
          it.hasLiked ? t.unliked : t.liked,
        )
      }
    />
  );

  // No node session yet: the timeline cannot load. The names / balances
  // that used to live here moved to the Profile tab (v0.3.0); this state
  // only explains the wait and points at the Server screen.
  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: xColors.bg, padding: 16 }}>
        <View style={xCard}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: xColors.text }}>{t.timeline}</Text>
          <Text style={xSub}>{t.nodeSearching}</Text>
          <Text style={xSub}>{t.mintNoNodeNote}</Text>
          <TouchableOpacity style={xButton} onPress={onGoNode}>
            <Text style={xButtonText}>{t.nodeHomeCta}</Text>
          </TouchableOpacity>
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
            <Text style={[xSub, { textAlign: 'center', marginTop: 32 }]}>{t.feedEmpty}</Text>
          }
        />
      )}
      <TouchableOpacity
        style={{
          position: 'absolute',
          right: 18,
          bottom: 18,
          backgroundColor: xColors.accent,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
        onPress={onCompose}
        accessibilityLabel={t.postBtn}
      >
        <Text style={{ color: '#fff', fontSize: 24, lineHeight: 26 }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
