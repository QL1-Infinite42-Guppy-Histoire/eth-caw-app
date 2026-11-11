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

import { colors, styles } from '../theme';
import { getFeed, type CawItem, type Session } from '../lib/api';
import { likeAction, recawAction } from '../lib/actions';
import { getBalances, type OwnedName } from '../lib/mint';
import type { NetworkPreset } from '../config';

interface Props {
  wallet: ethers.HDNodeWallet | null;
  preset: NetworkPreset;
  session: Session | null;
  senderId: number | null;
  names: OwnedName[];
  onGoMint: () => void;
  onCompose: () => void;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}時間前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Home({ wallet, preset, session, senderId, names, onGoMint, onCompose }: Props) {
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
      Alert.alert('名前が必要です', '投稿やいいねには、この接続先で取得した CAW ネームが必要です');
      return;
    }
    try {
      await fn();
      Alert.alert('送信しました', okMsg);
      load(undefined, true);
    } catch (e) {
      Alert.alert('失敗しました', e instanceof Error ? e.message : String(e));
    }
  };

  const renderItem = ({ item }: { item: CawItem }) => (
    <View style={styles.card}>
      <Text style={[styles.body, { fontWeight: '700' }]}>
        {item.user.username ?? item.user.address.slice(0, 10) + '…'}
        <Text style={{ color: colors.faint, fontWeight: '400' }}> ・ {timeLabel(item.timestamp)}</Text>
      </Text>
      <Text style={styles.body}>{item.content}</Text>
      <View style={{ flexDirection: 'row', gap: 22, marginTop: 4 }}>
        <TouchableOpacity
          onPress={() =>
            act(
              () => likeAction(wallet!, preset, session!, senderId!, item, !!item.hasLiked),
              item.hasLiked ? 'いいねを取り消しました' : 'いいねしました',
            )
          }
        >
          <Text style={{ color: item.hasLiked ? colors.accent : colors.sub, fontSize: 13 }}>
            ♥ {item.likeCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => act(() => recawAction(wallet!, preset, session!, senderId!, item), 'リコーしました')}
        >
          <Text style={{ color: item.hasRecawed ? colors.accent : colors.sub, fontSize: 13 }}>
            ↻ {item.recawCount}
          </Text>
        </TouchableOpacity>
        <Text style={{ color: colors.sub, fontSize: 13 }}>💬 {item.commentCount}</Text>
      </View>
    </View>
  );

  if (!session) {
    return (
      <View style={styles.root}>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>自分の名前</Text>
            {names.length === 0 ? (
              <Text style={styles.sub}>まだ名前を持っていません。</Text>
            ) : (
              names.map((n) => (
                <Text key={n.tokenId} style={styles.body}>
                  @{n.name}
                  <Text style={{ color: colors.faint }}> （tokenId {n.tokenId}）</Text>
                </Text>
              ))
            )}
            <Text style={styles.sub}>
              残高：
              {balances
                ? `${Number(ethers.formatEther(balances.eth)).toFixed(5)} ETH${balances.caw != null ? ` / ${Number(ethers.formatUnits(balances.caw, 18)).toLocaleString('ja-JP', { maximumFractionDigits: 0 })} CAW` : ''}`
                : '…'}
            </Text>
            <TouchableOpacity style={styles.button} onPress={onGoMint}>
              <Text style={styles.buttonText}>名前を取る</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.card}>
            <Text style={styles.title}>タイムライン</Text>
            <Text style={styles.sub}>
              ノードを探しています。コミュニティのノードが立ち上がると、自動で接続してここにタイムラインが表示されます（操作は不要です）。
            </Text>
            <Text style={styles.sub}>
              名前の取得はノードなしで今すぐできます。
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : error ? (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>タイムラインを読めませんでした</Text>
            <Text style={styles.sub}>{error}</Text>
            <Text style={styles.sub}>ノード URL の設定と、ノードの起動状態を確認してください。</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 10 }}
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
            <Text style={[styles.sub, { textAlign: 'center', marginTop: 32 }]}>
              まだ投稿がありません
            </Text>
          }
        />
      )}
      <TouchableOpacity
        style={{
          position: 'absolute',
          right: 18,
          bottom: 22,
          backgroundColor: colors.accent,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onPress={onCompose}
      >
        <Text style={{ color: '#fff', fontSize: 26, lineHeight: 30 }}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}
