import React, { useCallback, useEffect, useState } from 'react';
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
import { SvgXml } from 'react-native-svg';

import { xColors } from '../theme';
import { getCawThread, type CawItem, type Session } from '../lib/api';
import { likeAction, recawAction, replyAction } from '../lib/actions';
import { loadBookmarks, toggleBookmark, type Bookmark } from '../lib/bookmarks';
import type { OwnedName } from '../lib/mint';
import type { NetworkPreset } from '../config';
import { STRINGS, fmt, type Lang } from '../i18n';
import PostCell, { compactCount, type PostUserRef } from '../components/PostCell';
import UserAvatar from '../components/UserAvatar';
import {
  BackIcon,
  BookmarkIcon,
  HeartIcon,
  RecawIcon,
  ReplyIcon,
  SendIcon,
  ViewsIcon,
} from '../components/icons';

const LOCALES: Record<Lang, string> = {
  ja: 'ja-JP',
  en: 'en-US',
  zh: 'zh-CN',
  ko: 'ko-KR',
  es: 'es-ES',
};

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet | null;
  preset: NetworkPreset;
  session: Session | null;
  senderId: number | null;
  /** The signed-in name (for the reply box avatar), when known. */
  senderName: OwnedName | null;
  item: CawItem;
  onBack: () => void;
  onOpenPost: (item: CawItem) => void;
  onOpenUser: (user: PostUserRef) => void;
}

export default function Thread({
  lang,
  wallet,
  preset,
  session,
  senderId,
  senderName,
  item,
  onBack,
  onOpenPost,
  onOpenUser,
}: Props) {
  const t = STRINGS[lang];
  // A plain recaw opens the ORIGINAL post's thread, with the recaw
  // context line on top — the way X opens a repost.
  const isPlainRecaw = item.action === 'RECAW' && !item.content && !!item.originalCaw;
  const target = isPlainRecaw ? item.originalCaw! : item;
  const recawerName =
    item.user.displayName ?? (item.user.username ? `@${item.user.username}` : `#${item.user.tokenId}`);

  const [caw, setCaw] = useState<CawItem>(target);
  const [comments, setComments] = useState<CawItem[]>([]);
  const [commentCursor, setCommentCursor] = useState<number | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);

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
    async (cursor?: number, replace = false) => {
      try {
        const page = await getCawThread(session, target.id, cursor);
        setCaw(page.caw);
        setComments((prev) => (replace ? page.comments : [...prev, ...page.comments]));
        setHasMore(page.hasMoreComments);
        setCommentCursor(page.nextCommentCursor);
        setErrorStatus(null);
      } catch (e) {
        if (replace) setErrorStatus((e as { status?: number })?.status ?? -1);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [session, target.id],
  );

  useEffect(() => {
    setLoading(true);
    void load(undefined, true);
  }, [load]);

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    if (!wallet || !session || senderId == null) {
      Alert.alert(t.nameRequiredTitle, t.nameRequiredMsgAct);
      return;
    }
    try {
      await fn();
      Alert.alert(t.sentTitle, okMsg);
      void load(undefined, true);
    } catch (e) {
      Alert.alert(t.failedTitle, e instanceof Error ? e.message : String(e));
    }
  };

  const canAct = !!(wallet && session && senderId != null);

  const submitReply = async () => {
    const body = replyText.trim();
    if (!body || !canAct) return;
    setReplyBusy(true);
    try {
      await replyAction(wallet!, preset, session!, senderId!, caw, body);
      Alert.alert(t.sentTitle, t.repliedMsg);
      setReplyText('');
      void load(undefined, true);
    } catch (e) {
      Alert.alert(t.failedTitle, e instanceof Error ? e.message : String(e));
    } finally {
      setReplyBusy(false);
    }
  };

  const d = new Date(caw.timestamp);
  const metaParts = [
    d.toLocaleTimeString(LOCALES[lang], { hour: 'numeric', minute: '2-digit' }),
    d.toLocaleDateString(LOCALES[lang], { year: 'numeric', month: 'long', day: 'numeric' }),
  ];
  if (typeof caw.viewCount === 'number') {
    metaParts.push(`${caw.viewCount.toLocaleString()} ${t.viewsLabel}`);
  }

  const header = (
    <View>
      {isPlainRecaw && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 10 }}>
          <RecawIcon size={14} color={xColors.sub} />
          <Text style={{ fontSize: 13, color: xColors.sub, fontWeight: '600' }}>
            {fmt(t.recawedBy, { name: recawerName })}
          </Text>
        </View>
      )}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          onPress={() => onOpenUser(caw.user)}
          activeOpacity={0.7}
        >
          <UserAvatar
            label={caw.user.displayName ?? caw.user.username ?? caw.user.address.slice(2)}
            seed={caw.user.address || caw.user.username || String(caw.user.tokenId)}
            size={48}
          />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: xColors.text }}>
              {caw.user.displayName ?? caw.user.username ?? caw.user.address.slice(0, 10) + '…'}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 14, color: xColors.sub, marginTop: 1 }}>
              {caw.user.username ? `@${caw.user.username}` : `#${caw.user.tokenId}`}
            </Text>
          </View>
        </TouchableOpacity>
        <Text style={{ fontSize: 17, color: xColors.text, lineHeight: 24, marginTop: 12 }}>
          {caw.content}
        </Text>
        <Text style={{ fontSize: 13, color: xColors.sub, marginTop: 12 }}>{metaParts.join(' · ')}</Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginHorizontal: 16,
          marginTop: 12,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: xColors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <ReplyIcon size={19} color={xColors.sub} />
          <Text style={{ color: xColors.sub, fontSize: 13 }}>{caw.commentCount}</Text>
        </View>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
          onPress={
            canAct
              ? () => act(() => recawAction(wallet!, preset, session!, senderId!, caw), t.recawed)
              : undefined
          }
          disabled={!canAct}
          hitSlop={6}
        >
          <RecawIcon size={20} color={caw.hasRecawed ? xColors.recaw : xColors.sub} />
          <Text style={{ color: caw.hasRecawed ? xColors.recaw : xColors.sub, fontSize: 13 }}>
            {caw.recawCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
          onPress={
            canAct
              ? () =>
                  act(
                    () => likeAction(wallet!, preset, session!, senderId!, caw, !!caw.hasLiked),
                    caw.hasLiked ? t.unliked : t.liked,
                  )
              : undefined
          }
          disabled={!canAct}
          hitSlop={6}
        >
          <HeartIcon size={19} color={caw.hasLiked ? xColors.like : xColors.sub} filled={!!caw.hasLiked} />
          <Text style={{ color: caw.hasLiked ? xColors.like : xColors.sub, fontSize: 13 }}>
            {caw.likeCount}
          </Text>
        </TouchableOpacity>
        {typeof caw.viewCount === 'number' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <ViewsIcon size={19} color={xColors.sub} />
            <Text style={{ color: xColors.sub, fontSize: 13 }}>{compactCount(caw.viewCount)}</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => void toggleBm(caw)} hitSlop={8} style={{ padding: 2 }}>
          <BookmarkIcon
            size={19}
            color={bookmarkedIds.has(caw.id) ? xColors.accent : xColors.sub}
            filled={bookmarkedIds.has(caw.id)}
          />
        </TouchableOpacity>
      </View>
      {canAct && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: xColors.border,
          }}
        >
          {senderName?.imageSvg ? (
            <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden' }}>
              <SvgXml xml={senderName.imageSvg} width={36} height={36} />
            </View>
          ) : (
            <UserAvatar
              label={senderName?.name ?? wallet?.address.slice(2) ?? 'C'}
              seed={wallet?.address ?? 'caw'}
              size={36}
            />
          )}
          <TextInput
            style={{
              flex: 1,
              backgroundColor: '#eef3f4',
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 9,
              fontSize: 15,
              color: xColors.text,
            }}
            placeholder={t.replyPlaceholder}
            placeholderTextColor={xColors.sub}
            value={replyText}
            onChangeText={setReplyText}
            maxLength={420}
          />
          <TouchableOpacity
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: xColors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: replyBusy || !replyText.trim() ? 0.4 : 1,
            }}
            onPress={submitReply}
            disabled={replyBusy || !replyText.trim()}
          >
            <SendIcon size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

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
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <BackIcon size={21} color={xColors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '800', color: xColors.text }}>{t.threadTitle}</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={xColors.accent} />
      ) : errorStatus !== null ? (
        <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 32, gap: 12 }}>
          <Text style={{ fontSize: 13, color: xColors.sub, lineHeight: 19, textAlign: 'center' }}>
            {errorStatus === 404 ? t.postNotFound : t.threadLoadFailed}
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
              void load(undefined, true);
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: xColors.text }}>{t.retryBtn}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={comments}
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
          onEndReached={() => {
            if (hasMore && commentCursor != null && !loadingMore) {
              setLoadingMore(true);
              void load(commentCursor, false);
            }
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <Text style={{ fontSize: 13, color: xColors.sub, textAlign: 'center', marginTop: 28 }}>
              {t.noRepliesYet}
            </Text>
          }
        />
      )}
    </View>
  );
}
