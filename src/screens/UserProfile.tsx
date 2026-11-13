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

import { xColors } from '../theme';
import {
  getUserByToken,
  getUserCaws,
  getUserProfile,
  type CawItem,
  type Session,
  type UserCawsFilter,
  type UserProfileData,
} from '../lib/api';
import { likeAction, recawAction } from '../lib/actions';
import { loadBookmarks, toggleBookmark, type Bookmark } from '../lib/bookmarks';
import type { NetworkPreset } from '../config';
import { STRINGS, type Lang } from '../i18n';
import PostCell, { type PostUserRef } from '../components/PostCell';
import UserAvatar from '../components/UserAvatar';
import { BackIcon } from '../components/icons';

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet | null;
  preset: NetworkPreset;
  session: Session | null;
  senderId: number | null;
  tokenId: number;
  username: string | null;
  /** Absent when this page IS the Profile tab (the user's own profile
   *  page, QL1 v0.6.2 form): then no back bar is rendered. */
  onBack?: () => void;
  onOpenPost: (item: CawItem) => void;
  onOpenUser: (user: PostUserRef) => void;
}

type SubTab = UserCawsFilter;

/* QL1 chip: gray pill under the handle (#id / deposit figure). */
const chipStyle = {
  backgroundColor: '#f0f3f4',
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 4,
} as const;
const chipTextStyle = { fontSize: 12.5, color: xColors.text } as const;

/**
 * A user's profile page (overlay for other users; the Profile tab
 * itself for the user's own page — QL1 v0.6.2 arrangement). Layout
 * metrics are the QL1 profile page's: 110px banner, 96px avatar in a
 * 104px white ring overlapping by 48, name at 20/800, a chip row
 * (#id, plus the deposit figure when the node has one), counts as
 * bordered cells, and tabs with the accent underline bar.
 * Everything shown comes from the node's own profile reads:
 * counts/bio from GET /api/users/:username, the deposit figure from
 * the node's cached on-chain stake (GET /api/users/by-token —
 * rendered only when the node actually has a value), and the
 * Posts / Replies / Likes lists from the node's profile feed modes.
 * There is deliberately no Follow button: follow is not implemented
 * anywhere in this app today.
 */
export default function UserProfile({
  lang,
  wallet,
  preset,
  session,
  senderId,
  tokenId,
  username,
  onBack,
  onOpenPost,
  onOpenUser,
}: Props) {
  const t = STRINGS[lang];
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [stakeWei, setStakeWei] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<number | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('posts');
  const [items, setItems] = useState<CawItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  // Resolve the profile: by username when known; via by-token first when
  // only the token id is known (feed items can carry a null username).
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        let name = username;
        if (!name) {
          const byToken = await getUserByToken(session, tokenId);
          if (!live) return;
          setStakeWei(byToken.onChainStakeWei ?? null);
          name = byToken.username;
        }
        if (!name) {
          setProfileError(404);
          return;
        }
        const p = await getUserProfile(session, name);
        if (!live) return;
        setProfile(p);
      } catch (e) {
        if (live) setProfileError((e as { status?: number })?.status ?? -1);
      }
    })();
    return () => {
      live = false;
    };
  }, [session, tokenId, username]);

  // Deposit (node-cached on-chain stake) — a separate best-effort read;
  // when it returns null the card simply does not render.
  useEffect(() => {
    if (!profile) return;
    let live = true;
    getUserByToken(session, profile.tokenId)
      .then((b) => live && setStakeWei(b.onChainStakeWei ?? null))
      .catch(() => live && setStakeWei(null));
    return () => {
      live = false;
    };
  }, [session, profile]);

  const loadList = useCallback(
    async (next?: string, replace = false) => {
      if (!profile) return;
      try {
        const page = await getUserCaws(session, profile.username, subTab, next);
        setItems((prev) => (replace ? page.items : [...prev, ...page.items]));
        setCursor(page.nextCursor);
      } catch {
        if (replace) setItems([]);
      } finally {
        setListLoading(false);
        setRefreshing(false);
      }
    },
    [session, profile, subTab],
  );

  useEffect(() => {
    if (!profile) return;
    setListLoading(true);
    void loadList(undefined, true);
  }, [loadList]);

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    if (!wallet || !session || senderId == null) {
      Alert.alert(t.nameRequiredTitle, t.nameRequiredMsgAct);
      return;
    }
    try {
      await fn();
      Alert.alert(t.sentTitle, okMsg);
      void loadList(undefined, true);
    } catch (e) {
      Alert.alert(t.failedTitle, e instanceof Error ? e.message : String(e));
    }
  };
  const canAct = !!(wallet && session && senderId != null);

  const displayName = profile?.displayName ?? profile?.username ?? (username ? `@${username}` : `#${tokenId}`);
  let stakeCaw: string | null = null;
  if (stakeWei != null) {
    try {
      stakeCaw = Number(ethers.formatUnits(BigInt(stakeWei), 18)).toLocaleString('ja-JP', {
        maximumFractionDigits: 2,
      });
    } catch {
      stakeCaw = null;
    }
  }

  const header = profile ? (
    <View>
      <LinearGradient
        colors={['#1d9bf0', '#14b8a6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: 110 }}
      />
      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: 52,
              backgroundColor: xColors.bg,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: -48,
            }}
          >
            <UserAvatar
              label={displayName}
              seed={profile.address || profile.username}
              size={96}
              avatarUrl={profile.avatarUrl}
            />
          </View>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: xColors.text, marginTop: 8 }}>
          {displayName}
        </Text>
        <Text style={{ fontSize: 14, color: xColors.sub, marginTop: 1 }}>@{profile.username}</Text>
        {profile.bio ? (
          <Text style={{ fontSize: 14, color: xColors.text, lineHeight: 20, marginTop: 8 }}>
            {profile.bio}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <View style={chipStyle}>
            <Text style={chipTextStyle}>#{profile.tokenId}</Text>
          </View>
          {stakeCaw != null && (
            <View style={chipStyle}>
              <Text style={chipTextStyle}>
                {t.depositShort}: {stakeCaw} CAW
              </Text>
            </View>
          )}
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'stretch',
            marginTop: 14,
            borderWidth: 1,
            borderColor: xColors.border,
            borderRadius: 14,
            backgroundColor: xColors.bg,
            overflow: 'hidden',
          }}
        >
          {(
            [
              [profile.followingCount, t.followingLabel],
              [profile.followerCount, t.followersLabel],
              [profile.cawCount, t.profilePosts],
            ] as [number, string][]
          ).map(([n, label], i) => (
            <React.Fragment key={label}>
              {i > 0 && <View style={{ width: 1, backgroundColor: xColors.border }} />}
              <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10, gap: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: xColors.text }}>
                  {n.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 12, color: xColors.sub }}>{label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderBottomColor: xColors.border,
          marginTop: 14,
        }}
      >
        {(
          [
            ['posts', t.profilePosts],
            ['replies', t.profileReplies],
            ['liked', t.profileLikes],
          ] as [SubTab, string][]
        ).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={{ flex: 1, alignItems: 'center', paddingTop: 12 }}
            onPress={() => setSubTab(key)}
          >
            <Text
              style={{
                fontSize: 14.5,
                color: subTab === key ? xColors.text : xColors.sub,
                fontWeight: subTab === key ? '800' : '600',
                paddingBottom: 10,
              }}
            >
              {label}
            </Text>
            {subTab === key && (
              <View
                style={{
                  height: 3,
                  width: '70%',
                  borderRadius: 2,
                  backgroundColor: xColors.accent,
                  marginBottom: -1,
                }}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
      {listLoading && (
        <ActivityIndicator style={{ marginTop: 28 }} color={xColors.accent} />
      )}
    </View>
  ) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: xColors.bg }}>
      {onBack ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: xColors.border,
          }}
        >
          <TouchableOpacity onPress={onBack} hitSlop={8}>
            <BackIcon size={20} color={xColors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '800', color: xColors.text }} numberOfLines={1}>
            {profile ? displayName : username ? `@${username}` : `#${tokenId}`}
          </Text>
        </View>
      ) : null}

      {!profile && profileError === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={xColors.accent} />
      ) : profileError !== null ? (
        <Text
          style={{
            fontSize: 13,
            color: xColors.sub,
            lineHeight: 19,
            textAlign: 'center',
            marginTop: 40,
            paddingHorizontal: 32,
          }}
        >
          {profileError === 404 ? t.profileNotFound : t.profileLoadFailed}
        </Text>
      ) : (
        <FlatList
          data={listLoading ? [] : items}
          keyExtractor={(it) => it.id}
          ListHeaderComponent={header}
          renderItem={({ item: c }) => (
            <PostCell
              item={c}
              lang={lang}
              bookmarked={bookmarkedIds.has(c.id) || (c.originalCaw ? bookmarkedIds.has(c.originalCaw.id) : false)}
              onToggleBookmark={(it) => void toggleBm(it)}
              onPress={onOpenPost}
              onUserPress={onOpenUser}
              onRecaw={
                canAct
                  ? (it) => act(() => recawAction(wallet!, preset, session!, senderId!, it), t.recawed)
                  : undefined
              }
              onLike={
                canAct
                  ? (it) =>
                      act(
                        () => likeAction(wallet!, preset, session!, senderId!, it, !!it.hasLiked),
                        it.hasLiked ? t.unliked : t.liked,
                      )
                  : undefined
              }
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadList(undefined, true);
              }}
            />
          }
          onEndReached={() => cursor && loadList(cursor)}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            !listLoading ? (
              <Text style={{ fontSize: 13, color: xColors.sub, textAlign: 'center', marginTop: 28 }}>
                {t.feedEmpty}
              </Text>
            ) : undefined
          }
        />
      )}
    </View>
  );
}
