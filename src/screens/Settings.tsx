import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';

import { colors, styles } from '../theme';
import { deleteWallet, revealPhrase, storedAddress } from '../lib/wallet';
import { PRESETS, type NetworkPreset } from '../config';

interface Props {
  preset: NetworkPreset;
  nodeUrl: string;
  senderName: string | null;
  senderId: number | null;
  onPresetChange: (p: NetworkPreset) => void;
  onNodeUrlChange: (url: string) => void;
  onWalletDeleted: () => void;
}

async function biometricGate(reason: string): Promise<boolean> {
  const res = await LocalAuthentication.authenticateAsync({ promptMessage: reason });
  return res.success;
}

export default function Settings({
  preset,
  nodeUrl,
  senderName,
  senderId,
  onPresetChange,
  onNodeUrlChange,
  onWalletDeleted,
}: Props) {
  const [urlText, setUrlText] = useState(nodeUrl);
  const [address, setAddress] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);

  React.useEffect(() => {
    storedAddress().then(setAddress);
  }, []);
  React.useEffect(() => setUrlText(nodeUrl), [nodeUrl]);

  const saveUrl = () => {
    onNodeUrlChange(urlText.trim());
    Alert.alert('保存しました', 'ノード URL を更新しました。再度ひらくと新しい接続先で認証します');
  };

  const showPhrase = async () => {
    if (!(await biometricGate('リカバリーフレーズを表示'))) return;
    setPhrase(await revealPhrase());
  };

  const wipe = async () => {
    if (!(await biometricGate('ウォレットを削除'))) return;
    Alert.alert('本当に削除しますか？', 'フレーズを控えていない場合、二度と復元できません', [
      { text: 'やめる', style: 'cancel' },
      {
        text: '削除する',
        style: 'destructive',
        onPress: async () => {
          await deleteWallet();
          onWalletDeleted();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>接続先</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={p.id === preset.id ? styles.button : styles.ghostButton}
              onPress={() => onPresetChange(p)}
            >
              <Text style={p.id === preset.id ? styles.buttonText : styles.ghostText}>
                {p.isTestnet ? 'テストネット' : 'メインネット'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.sub}>{preset.label}</Text>
        <Text style={styles.sub}>
          ノード URL（自前ノードの公開 URL。開発中はトンネル URL が入ります）
        </Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://…"
          value={urlText}
          onChangeText={setUrlText}
        />
        <TouchableOpacity style={styles.button} onPress={saveUrl}>
          <Text style={styles.buttonText}>保存する</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>自分の名前</Text>
        {senderId != null ? (
          <Text style={styles.body}>
            {senderName ?? `#${senderId}`}（tokenId {senderId}）
          </Text>
        ) : (
          <Text style={styles.sub}>
            この接続先では、まだ名前を持っていません。「名前を取る」タブから取得できます
            （ノードは不要です）。
          </Text>
        )}
        <Text style={styles.sub}>ウォレットアドレス</Text>
        <Text selectable style={styles.body}>
          {address ?? '…'}
        </Text>
        <TouchableOpacity
          onPress={async () => {
            if (address) await Clipboard.setStringAsync(address);
          }}
        >
          <Text style={{ color: colors.accent, fontSize: 13 }}>アドレスをコピー</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>リカバリーフレーズ</Text>
        {phrase ? (
          <Text selectable style={styles.body}>
            {phrase}
          </Text>
        ) : (
          <TouchableOpacity onPress={showPhrase}>
            <Text style={{ color: colors.accent, fontSize: 14 }}>生体認証して表示する</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.sub}>他人に見せないでください。運営がフレーズを聞くことはありません。</Text>
      </View>

      <TouchableOpacity onPress={wipe} style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Text style={styles.dangerText}>この端末のウォレットを削除</Text>
      </TouchableOpacity>
      <Text style={[styles.sub, { textAlign: 'center' }]}>
        CAW — Ethereum Edition v0.1.4 / 独立デプロイ版（公式 CAW とは無関係です）
      </Text>
    </ScrollView>
  );
}
