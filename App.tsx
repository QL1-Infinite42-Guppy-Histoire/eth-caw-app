import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PRESETS, STORAGE_KEYS, TESTNET_PRESET, type NetworkPreset } from './src/config';

// M1 shell: confirms the project builds and shows the active preset.
// Wallet creation, node auth, timeline and posting land in the v1 build.
export default function App() {
  const [preset, setPreset] = useState<NetworkPreset>(TESTNET_PRESET);
  const [nodeUrl, setNodeUrl] = useState<string>('');

  useEffect(() => {
    (async () => {
      const [savedPresetId, savedNodeUrl] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.presetId),
        AsyncStorage.getItem(STORAGE_KEYS.nodeUrl),
      ]);
      const found = PRESETS.find((p) => p.id === savedPresetId);
      if (found) setPreset(found);
      if (savedNodeUrl) setNodeUrl(savedNodeUrl);
    })();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.logo}>CAW</Text>
        <Text style={styles.edition}>— Ethereum Edition</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>接続先プリセット</Text>
        <Text style={styles.cardBody}>{preset.label}</Text>
        <Text style={styles.cardTitle}>ノード URL</Text>
        <Text style={styles.cardBody}>{nodeUrl || '（未設定 — 設定画面で入力）'}</Text>
        <Text style={styles.note}>
          独立デプロイ版 CAW の専用アプリです。公式 CAW とは関係ありません。
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7f9fb', paddingHorizontal: 16, paddingTop: 24 },
  header: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 16 },
  logo: { fontSize: 28, fontWeight: '800', color: '#164e63' },
  edition: { fontSize: 13, color: '#64748b', marginLeft: 6 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, gap: 4 },
  cardTitle: { fontSize: 12, color: '#0e7490', fontWeight: '700', marginTop: 8 },
  cardBody: { fontSize: 15, color: '#0f172a' },
  note: { fontSize: 12, color: '#94a3b8', marginTop: 12 },
});
