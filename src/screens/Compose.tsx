import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ethers } from 'ethers';

import { styles } from '../theme';
import { postAction } from '../lib/actions';
import type { Session } from '../lib/api';
import type { NetworkPreset } from '../config';

interface Props {
  wallet: ethers.HDNodeWallet;
  preset: NetworkPreset;
  session: Session;
  senderId: number;
  onDone: () => void;
}

export default function Compose({ wallet, preset, session, senderId, onDone }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await postAction(wallet, preset, session, senderId, body);
      Alert.alert('投稿しました', 'バリデータの確定後、タイムラインに表示されます');
      onDone();
    } catch (e) {
      Alert.alert('投稿に失敗しました', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, styles.content]}>
      <Text style={styles.title}>投稿する</Text>
      <Text style={styles.sub}>
        署名だけを送ります（ガス代はかかりません）。投稿コスト 5,000 CAW＋バリデータ tip が、
        このネットワークへの預け分から引かれます。
      </Text>
      <TextInput
        style={[styles.input, { minHeight: 140, textAlignVertical: 'top' }]}
        multiline
        autoFocus
        maxLength={2000}
        placeholder="いまどうしてる？"
        value={text}
        onChangeText={setText}
      />
      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy || !text.trim()}>
        <Text style={styles.buttonText}>{busy ? '送信中…' : '投稿する'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDone}>
        <Text style={styles.sub}>← タイムラインへもどる</Text>
      </TouchableOpacity>
    </View>
  );
}
