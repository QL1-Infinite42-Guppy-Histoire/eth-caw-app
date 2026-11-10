import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { colors, styles } from '../theme';
import { createWallet, importWallet } from '../lib/wallet';

export default function Onboarding({ onReady }: { onReady: () => void }) {
  const [mode, setMode] = useState<'choose' | 'created' | 'import'>('choose');
  const [phrase, setPhrase] = useState('');
  const [importText, setImportText] = useState('');
  const [busy, setBusy] = useState(false);

  const doCreate = async () => {
    setBusy(true);
    try {
      const { phrase: p } = await createWallet();
      setPhrase(p);
      setMode('created');
    } catch (e) {
      Alert.alert('作成に失敗しました', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      await importWallet(importText);
      onReady();
    } catch (e) {
      Alert.alert('インポートに失敗しました', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>CAW — Ethereum Edition</Text>
      <Text style={styles.sub}>
        独立デプロイ版 CAW の専用アプリです。公式 CAW とは関係ありません。
        ウォレットはこの端末の中だけにあり、鍵がサーバーへ送られることはありません。
      </Text>

      {mode === 'choose' && (
        <View style={{ gap: 10 }}>
          <TouchableOpacity style={styles.button} onPress={doCreate} disabled={busy}>
            <Text style={styles.buttonText}>新しいウォレットを作る</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => setMode('import')}>
            <Text style={styles.ghostText}>リカバリーフレーズで復元する</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'created' && (
        <View style={styles.card}>
          <Text style={styles.title}>リカバリーフレーズ（必ず控えてください）</Text>
          <Text style={[styles.body, { color: colors.danger }]}>
            この言葉を失うと資産と名前を二度と取り戻せません。紙などに書いて、他人に見せないでください。
          </Text>
          <Text selectable style={[styles.body, { fontWeight: '600' }]}>
            {phrase}
          </Text>
          <TouchableOpacity style={styles.button} onPress={onReady}>
            <Text style={styles.buttonText}>控えたので進む</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'import' && (
        <View style={{ gap: 10 }}>
          <TextInput
            style={[styles.input, { minHeight: 88, textAlignVertical: 'top' }]}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="12個（または24個）の単語をスペース区切りで"
            value={importText}
            onChangeText={setImportText}
          />
          <TouchableOpacity style={styles.button} onPress={doImport} disabled={busy}>
            <Text style={styles.buttonText}>復元する</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('choose')}>
            <Text style={styles.sub}>← もどる</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
