import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { ethers } from 'ethers';

import { xColors } from '../theme';
import type { CawItem, Session } from '../lib/api';
import { likeAction, recawAction } from '../lib/actions';
import { loadBookmarks, toggleBookmark, type Bookmark } from '../lib/bookmarks';
import type { NetworkPreset } from '../config';
import { STRINGS, type Lang } from '../i18n';
import PostCell, { type PostUserRef } from '../components/PostCell';
import { BackIcon } from '../components/icons';

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet | null;
  preset: NetworkPreset;
  session: Session | null;
  senderId: number | null;
  onClose: () => void;
  onOpenPost: (item: CawItem) => void;
  onOpenUser: (user: PostUserRef) => void;
}

export default function Bookmarks({ lang, wallet, preset, session, senderId, onClose, onOpenPost, onOpenUser }: Props) {
  const t = STRINGS[lang];
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    let live = true;
    loadBookmarks().then((b) => live && setBookmarks(b));
    return () => {
      live = false;
    };
  }, []);

  const toggleBm = async (it: CawItem) => {
    setBookmarks(await toggleBookmark(bookmarks, it));
  };

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
          <BackIcon size={21} color={xColors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: xColors.text }}>{t.bookmarksTitle}</Text>
      </View>
      <Text style={{ fontSize: 12, color: xColors.sub, paddingHorizontal: 16, paddingVertical: 8 }}>
        {t.bookmarksLocalNote}
      </Text>
      <FlatList
        data={bookmarks}
        keyExtractor={(b) => b.id}
        renderItem={({ item: b }) => (
          <PostCell
            item={b.item}
            lang={lang}
            bookmarked
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
        ListEmptyComponent={
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
            {t.bookmarksEmpty}
          </Text>
        }
      />
    </View>
  );
}
