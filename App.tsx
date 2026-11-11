import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ethers } from 'ethers';

import {
  MAINNET_PRESET,
  PRESETS,
  STORAGE_KEYS,
  TESTNET_PRESET,
  type NetworkPreset,
} from './src/config';
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
import { fetchOwnedNames, type OwnedName } from './src/lib/mint';
import { pickRegistryNode } from './src/lib/nodes';
import Onboarding from './src/screens/Onboarding';
import Mint from './src/screens/Mint';
import Home from './src/screens/Home';
import Compose from './src/screens/Compose';
import Settings from './src/screens/Settings';

type Phase = 'boot' | 'onboarding' | 'locked' | 'main';
type Tab = 'home' | 'mint' | 'compose' | 'settings';

export default function App() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [tab, setTab] = useState<Tab>('home');
  const [preset, setPreset] = useState<NetworkPreset>(MAINNET_PRESET);
  const [names, setNames] = useState<OwnedName[]>([]);
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

  const refreshNames = useCallback(async (w: ethers.HDNodeWallet, p: NetworkPreset) => {
    try {
      setNames(await fetchOwnedNames(w, p));
    } catch {
      setNames([]);
    }
  }, []);

  const connectingRef = React.useRef(false);
  const resolveAndConnect = useCallback(
    async (w: ethers.HDNodeWallet, p: NetworkPreset) => {
      if (connectingRef.current) return;
      connectingRef.current = true;
      try {
        const manual = (await AsyncStorage.getItem(STORAGE_KEYS.nodeUrl)) ?? '';
        if (manual) {
          setNodeUrlState(manual);
          await connect(w, manual, p);
          return;
        }
        // No manual URL: discover a community node from the public registry.
        // As soon as one is online, the app connects by itself and the
        // timeline appears — nothing for the user to type.
        const auto = await pickRegistryNode(p);
        if (auto) {
          setNodeUrlState(auto);
          await connect(w, auto, p);
        } else {
          setSession(null);
        }
      } finally {
        connectingRef.current = false;
      }
    },
    [connect],
  );

  useEffect(() => {
    (async () => {
      const [savedPresetId, savedUrl] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.presetId),
        AsyncStorage.getItem(STORAGE_KEYS.nodeUrl),
      ]);
      const p = PRESETS.find((x) => x.id === savedPresetId) ?? MAINNET_PRESET;
      setPreset(p);
      const url = savedUrl ?? '';
      setNodeUrlState(url);
      setNodeUrl(url);
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
      void refreshNames(w, preset);
      await resolveAndConnect(w, preset);
    } catch (e) {
      Alert.alert('ウォレットを開けませんでした', e instanceof Error ? e.message : String(e));
    }
  }, [resolveAndConnect, refreshNames, preset]);

  useEffect(() => {
    if (phase === 'locked') unlock();
  }, [phase, unlock]);

  const onOnboardingReady = useCallback(async () => {
    const w = await loadWallet();
    setWallet(w);
    setPhase('main');
    void refreshNames(w, preset);
    await resolveAndConnect(w, preset);
  }, [resolveAndConnect, refreshNames, preset]);

  // While no node session exists, keep looking: when a community node comes
  // online, connection and timeline follow automatically.
  useEffect(() => {
    if (phase !== 'main' || !wallet || session) return;
    const t = setInterval(() => {
      void resolveAndConnect(wallet, preset);
    }, 25000);
    return () => clearInterval(t);
  }, [phase, wallet, session, preset, resolveAndConnect]);

  const onPresetChange = useCallback(
    async (p: NetworkPreset) => {
      setPreset(p);
      await AsyncStorage.setItem(STORAGE_KEYS.presetId, p.id);
      await saveSession(null);
      setSession(null);
      if (wallet) {
        void refreshNames(wallet, p);
        await resolveAndConnect(wallet, p);
      }
    },
    [wallet, refreshNames, resolveAndConnect],
  );

  const primaryName = names[0] ?? null;

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
        <Text style={{ fontSize: 12, fontWeight: primaryName ? '700' : '400', color: primaryName ? colors.accentDark : colors.faint }}>
          {primaryName ? `@${primaryName.name}` : session ? '名前なし（閲覧のみ）' : 'ノード待機中'}
        </Text>
      </View>

      {tab === 'home' && (
        <Home
          wallet={wallet}
          preset={preset}
          session={session}
          senderId={senderId}
          names={names}
          onGoMint={() => setTab('mint')}
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
      {tab === 'mint' && (
        <Mint
          wallet={wallet}
          preset={preset}
          names={names}
          onMinted={() => void refreshNames(wallet, preset)}
        />
      )}
      {tab === 'settings' && (
        <Settings
          preset={preset}
          nodeUrl={nodeUrl}
          senderName={primaryName?.name ?? null}
          senderId={primaryName?.tokenId ?? senderId}
          onPresetChange={onPresetChange}
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
            ['mint', '名前を取る'],
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
