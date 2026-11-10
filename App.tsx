import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ethers } from 'ethers';

import { PRESETS, STORAGE_KEYS, TESTNET_PRESET, type NetworkPreset } from './src/config';
import { colors, styles } from './src/theme';
import { hasWallet, loadWallet } from './src/lib/wallet';
import {
  IndexingError,
  loadSession,
  saveSession,
  setNodeUrl,
  verifyWallet,
  type Session,
} from './src/lib/api';
import Onboarding from './src/screens/Onboarding';
import Home from './src/screens/Home';
import Compose from './src/screens/Compose';
import Settings from './src/screens/Settings';

type Phase = 'boot' | 'onboarding' | 'locked' | 'main';
type Tab = 'home' | 'compose' | 'settings';

export default function App() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [tab, setTab] = useState<Tab>('home');
  const [preset] = useState<NetworkPreset>(TESTNET_PRESET);
  const [nodeUrl, setNodeUrlState] = useState('');
  const [wallet, setWallet] = useState<ethers.HDNodeWallet | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const senderId = session?.authorizedTokenIds[0] ?? null;

  const connect = useCallback(
    async (w: ethers.HDNodeWallet, url: string, p: NetworkPreset) => {
      if (!url) {
        setSession(null);
        return;
      }
      setNodeUrl(url);
      try {
        const existing = await loadSession();
        if (existing) {
          setSession(existing);
          return;
        }
        const s = await verifyWallet(w, p);
        setSession(s);
      } catch (e) {
        setSession(null);
        if (e instanceof IndexingError) {
          Alert.alert('ノードが索引中です', e.message);
        }
        // No name on this deployment, or node unreachable: the app still
        // opens read-only; posting prompts for a name.
      }
    },
    [],
  );

  useEffect(() => {
    (async () => {
      const [savedPresetId, savedUrl] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.presetId),
        AsyncStorage.getItem(STORAGE_KEYS.nodeUrl),
      ]);
      const p = PRESETS.find((x) => x.id === savedPresetId) ?? TESTNET_PRESET;
      const url = savedUrl ?? '';
      setNodeUrlState(url);
      setNodeUrl(url);
      void p;
      setPhase((await hasWallet()) ? 'locked' : 'onboarding');
    })();
  }, []);

  const unlock = useCallback(async () => {
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'CAW をひらく',
    });
    if (!auth.success) return;
    try {
      const w = await loadWallet();
      setWallet(w);
      setPhase('main');
      const url = (await AsyncStorage.getItem(STORAGE_KEYS.nodeUrl)) ?? '';
      await connect(w, url, preset);
    } catch (e) {
      Alert.alert('ウォレットを開けませんでした', e instanceof Error ? e.message : String(e));
    }
  }, [connect, preset]);

  useEffect(() => {
    if (phase === 'locked') unlock();
  }, [phase, unlock]);

  const onOnboardingReady = useCallback(async () => {
    const w = await loadWallet();
    setWallet(w);
    setPhase('main');
    await connect(w, nodeUrl, preset);
  }, [connect, nodeUrl, preset]);

  const onNodeUrlChange = useCallback(
    async (url: string) => {
      setNodeUrlState(url);
      await AsyncStorage.setItem(STORAGE_KEYS.nodeUrl, url);
      await saveSession(null);
      setSession(null);
      if (wallet) await connect(wallet, url, preset);
    },
    [connect, preset, wallet],
  );

  if (phase === 'boot') {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (phase === 'onboarding') {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <Onboarding onReady={onOnboardingReady} />
      </View>
    );
  }

  if (phase === 'locked' || !wallet) {
    return (
      <View style={[styles.root, styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar style="dark" />
        <Text style={styles.h1}>CAW</Text>
        <Text style={styles.sub}>— Ethereum Edition</Text>
        <TouchableOpacity style={[styles.button, { paddingHorizontal: 32 }]} onPress={unlock}>
          <Text style={styles.buttonText}>生体認証でひらく</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 6,
        }}
      >
        <Image
          source={require('./assets/icon.png')}
          style={{ width: 30, height: 30, borderRadius: 8, marginRight: 8 }}
        />
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.accentDark }}>CAW</Text>
        <Text style={{ fontSize: 11, color: colors.sub, marginLeft: 6 }}>Ethereum Edition</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 11, color: senderId != null ? colors.accent : colors.faint }}>
          {senderId != null ? `tokenId ${senderId} で接続中` : '名前なし（閲覧のみ）'}
        </Text>
      </View>

      {tab === 'home' && (
        <Home
          wallet={wallet}
          preset={preset}
          session={session}
          senderId={senderId}
          onCompose={() => {
            if (!session || senderId == null) {
              Alert.alert(
                '名前が必要です',
                '投稿には、この接続先で取得した CAW ネームが必要です',
              );
              return;
            }
            setTab('compose');
          }}
        />
      )}
      {tab === 'compose' && session && senderId != null && (
        <Compose
          wallet={wallet}
          preset={preset}
          session={session}
          senderId={senderId}
          onDone={() => setTab('home')}
        />
      )}
      {tab === 'settings' && (
        <Settings
          preset={preset}
          nodeUrl={nodeUrl}
          senderName={null}
          senderId={senderId}
          onNodeUrlChange={onNodeUrlChange}
          onWalletDeleted={() => {
            setWallet(null);
            setSession(null);
            setPhase('onboarding');
          }}
        />
      )}

      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: colors.line,
          backgroundColor: colors.card,
          paddingVertical: 8,
        }}
      >
        {(
          [
            ['home', 'ホーム'],
            ['settings', '設定'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <TouchableOpacity key={t} style={{ flex: 1, alignItems: 'center' }} onPress={() => setTab(t)}>
            <Text style={{ color: tab === t ? colors.accent : colors.sub, fontWeight: tab === t ? '700' : '400' }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
