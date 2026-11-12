import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ethers } from 'ethers';

import { xColors } from '../theme';
import {
  getCawsByIds,
  searchAll,
  type CawItem,
  type SearchUser,
  type Session,
} from '../lib/api';
import { likeAction, recawAction } from '../lib/actions';
import { loadBookmarks, toggleBookmark, type Bookmark } from '../lib/bookmarks';
import type { NetworkPreset } from '../config';
import { STRINGS, type Lang } from '../i18n';
import PostCell, { type PostUserRef } from '../components/PostCell';
import UserAvatar from '../components/UserAvatar';
import { SearchIcon } from '../components/icons';

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet | null;
  preset: NetworkPreset;
  session: Session | null;
  senderId: number | null;
  onOpenPost: (item: CawItem) => void;
  onOpenUser: (user: PostUserRef) => void;
}

/**
 * Search tab. Both sections are the node's own search (GET /api/search):
 * names match username/display name, posts match post text. Matching
 * posts arrive in a reduced shape, so they are hydrated through
 * POST /api/caws/by-ids and rendered as full post cells — every count
 * shown is the node's real count. (No Follow buttons: follow is not
 * implemented anywhere in this app today.)
 */
export default function Search({ lang, wallet, preset, session, senderId, onOpenPost, onOpenUser }: Props) {
  const t = STRINGS[lang];
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<CawItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [searched, setSearched] = useState(false);
  const runRef = useRef(0);

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

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setUsers([]);
      setPosts([]);
      setSearched(false);
      setFailed(false);
      setLoading(false);
      return;
    }
    const run = ++runRef.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await searchAll(session, q);
        if (runRef.current !== run) return;
        setUsers(r.users);
        let full: CawItem[] = [];
        if (r.cawIds.length > 0) {
          try {
            full = await getCawsByIds(session, r.cawIds);
          } catch {
            full = [];
          }
        }
        if (runRef.current !== run) return;
        setPosts(full);
        setFailed(false);
        setSearched(true);
      } catch {
        if (runRef.current !== run) return;
        setFailed(true);
        setSearched(true);
      } finally {
        if (runRef.current === run) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, session]);

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    if (!wallet || !session || senderId == null) {
      Alert.alert(t.nameRequiredTitle, t.nameRequiredMsgAct);
      return;
    }
    try {
      await fn();
      Alert.alert(t.sentTitle, okMsg);
    } catch (e) {
      Alert.alert(t.failedTitle, e instanceof Error ? e.message : String(e));
    }
  };
  const canAct = !!(wallet && session && senderId != null);

  const q = query.trim();
  const showResults = searched && !loading && !failed && q.length >= 2;

  return (
    <View style={{ flex: 1, backgroundColor: xColors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#eef3f4',
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 9,
          }}
        >
          <SearchIcon size={18} color={xColors.sub} />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: xColors.text, padding: 0 }}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={xColors.sub}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
      </View>

      {q.length < 2 ? (
        <Text style={{ fontSize: 13, color: xColors.sub, textAlign: 'center', marginTop: 36, paddingHorizontal: 32 }}>
          {t.searchHint}
        </Text>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={xColors.accent} />
      ) : failed ? (
        <Text style={{ fontSize: 13, color: xColors.sub, textAlign: 'center', marginTop: 36, paddingHorizontal: 32 }}>
          {t.searchFailed}
        </Text>
      ) : showResults && users.length === 0 && posts.length === 0 ? (
        <Text style={{ fontSize: 13, color: xColors.sub, textAlign: 'center', marginTop: 36 }}>
          {t.searchNoResults}
        </Text>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(it) => it.id}
          ListHeaderComponent={
            users.length > 0 ? (
              <View>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '800',
                    color: xColors.text,
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    paddingBottom: 4,
                  }}
                >
                  {t.searchNames}
                </Text>
                {users.map((u) => (
                  <TouchableOpacity
                    key={u.tokenId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                    }}
                    onPress={() =>
                      onOpenUser({
                        tokenId: u.tokenId,
                        username: u.username,
                        displayName: u.displayName,
                        address: u.address ?? '',
                      })
                    }
                  >
                    <UserAvatar
                      label={u.displayName ?? u.username}
                      seed={u.address || u.username}
                      size={48}
                      avatarUrl={u.avatarUrl}
                    />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: xColors.text }}>
                        {u.displayName ?? u.username}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 14, color: xColors.sub, marginTop: 1 }}>
                        @{u.username}
                        {typeof u.followerCount === 'number'
                          ? ` · ${u.followerCount.toLocaleString()} ${t.followersLabel}`
                          : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {posts.length > 0 && (
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '800',
                      color: xColors.text,
                      paddingHorizontal: 16,
                      paddingTop: 14,
                      paddingBottom: 4,
                    }}
                  >
                    {t.searchPosts}
                  </Text>
                )}
              </View>
            ) : undefined
          }
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
        />
      )}
    </View>
  );
}
