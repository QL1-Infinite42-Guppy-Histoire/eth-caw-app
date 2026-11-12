import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ethers } from 'ethers';
import { SvgXml } from 'react-native-svg';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { STRINGS, detectLang, type Lang } from './src/i18n';

import {
  MAINNET_PRESET,
  PRESETS,
  STORAGE_KEYS,
  TESTNET_PRESET,
  type NetworkPreset,
} from './src/config';
import { colors, styles, xColors } from './src/theme';
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
import Swap from './src/screens/Swap';
import Home from './src/screens/Home';
import Compose from './src/screens/Compose';
import Settings from './src/screens/Settings';
import NodeScreen from './src/screens/Node';
import Send from './src/screens/Send';

type Phase = 'boot' | 'onboarding' | 'locked' | 'main';
type Tab = 'home' | 'mint' | 'swap' | 'send' | 'compose' | 'node' | 'settings';

function AppInner() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [lang, setLang] = useState<Lang>('ja');
  const insets = useSafeAreaInsets();
  const t = STRINGS[lang];
  const [tab, setTab] = useState<Tab>('home');
  const [preset, setPreset] = useState<NetworkPreset>(MAINNET_PRESET);
  const [names, setNames] = useState<OwnedName[]>([]);
  const [nodeUrl, setNodeUrlState] = useState('');
  const [myNodeUrl, setMyNodeUrl] = useState('');
  const [wallet, setWallet] = useState<ethers.HDNodeWallet | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const senderId = session?.authorizedTokenIds[0] ?? null;
  const langRef = React.useRef(lang);
  langRef.current = lang;

  const connect = useCallback(
    async (w: ethers.HDNodeWallet, url: string, p: NetworkPreset) => {
      if (!url) {
        setSession(null);
        return;
      }
      setNodeUrl(url);
      try {
        const existing = await loadSession();
        if (existing && existing.address === w.address) {
          setSession(existing);
          return;
        }
        if (existing) await saveSession(null); // another wallet's session: drop it
        const s = await verifyWallet(w, p);
        setSession(s);
      } catch (e) {
        setSession(null);
        if (e instanceof IndexingError) {
          Alert.alert(STRINGS[langRef.current].indexingTitle, e.message);
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
      const [savedPresetId, savedUrl, savedLang, savedMine] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.presetId),
        AsyncStorage.getItem(STORAGE_KEYS.nodeUrl),
        AsyncStorage.getItem(STORAGE_KEYS.lang),
        AsyncStorage.getItem(STORAGE_KEYS.myNodeUrl),
      ]);
      setMyNodeUrl(savedMine ?? '');
      setLang(
        savedLang === 'ja' || savedLang === 'en' || savedLang === 'zh' || savedLang === 'ko' || savedLang === 'es'
          ? savedLang
          : detectLang(),
      );
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
      promptMessage: t.lockPrompt,
    });
    if (!auth.success) return;
    try {
      const w = await loadWallet();
      setWallet(w);
      setPhase('main');
      void refreshNames(w, preset);
      await resolveAndConnect(w, preset);
    } catch (e) {
      Alert.alert(t.walletOpenFailed, e instanceof Error ? e.message : String(e));
    }
  }, [resolveAndConnect, refreshNames, preset, t]);

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

  const onLangChange = useCallback(async (l: Lang) => {
    setLang(l);
    await AsyncStorage.setItem(STORAGE_KEYS.lang, l);
  }, []);

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

  const onUseNode = useCallback(
    async (url: string) => {
      setMyNodeUrl(url);
      await AsyncStorage.setItem(STORAGE_KEYS.myNodeUrl, url);
      await onNodeUrlChange(url);
    },
    [onNodeUrlChange],
  );

  const onReleaseNode = useCallback(async () => {
    setMyNodeUrl('');
    await AsyncStorage.removeItem(STORAGE_KEYS.myNodeUrl);
    setNodeUrlState('');
    await AsyncStorage.setItem(STORAGE_KEYS.nodeUrl, '');
    await saveSession(null);
    setSession(null);
    if (wallet) await resolveAndConnect(wallet, preset);
  }, [resolveAndConnect, preset, wallet]);

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
        <Onboarding lang={lang} onReady={onOnboardingReady} />
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
          <Text style={styles.buttonText}>{t.unlockBtn}</Text>
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
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
          paddingBottom: 8,
          backgroundColor: xColors.bg,
          borderBottomWidth: 1,
          borderBottomColor: xColors.border,
        }}
      >
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          {primaryName?.imageSvg ? (
            <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden' }}>
              <SvgXml xml={primaryName.imageSvg} width={32} height={32} />
            </View>
          ) : primaryName ? (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: xColors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                {primaryName.name.replace(/^#/, '').charAt(0).toUpperCase() || 'C'}
              </Text>
            </View>
          ) : (
            <Image
              source={require('./assets/icon.png')}
              style={{ width: 32, height: 32, borderRadius: 16 }}
            />
          )}
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: xColors.text }}>CAW</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 11, fontWeight: primaryName ? '700' : '400', color: primaryName ? xColors.text : xColors.sub }}>
            {primaryName ? `@${primaryName.name}` : session ? t.headerNoName : t.headerWaiting}
          </Text>
          <View
            style={{
              marginTop: 2,
              borderWidth: 1,
              borderColor: xColors.border,
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 1,
            }}
          >
            <Text style={{ fontSize: 10, color: session ? xColors.accent : xColors.sub }}>
              {session ? `● ${t.chipConnected}` : `○ ${t.headerWaiting}`}
            </Text>
          </View>
        </View>
      </View>

      {tab === 'home' && (
        <Home
          lang={lang}
          wallet={wallet}
          preset={preset}
          session={session}
          senderId={senderId}
          names={names}
          onGoMint={() => setTab('mint')}
          onGoNode={() => setTab('node')}
          onCompose={() => {
            if (!session || senderId == null) {
              Alert.alert(t.nameRequiredTitle, t.nameRequiredMsgPost);
              return;
            }
            setTab('compose');
          }}
        />
      )}
      {tab === 'compose' && session && senderId != null && (
        <Compose
          lang={lang}
          wallet={wallet}
          preset={preset}
          session={session}
          senderId={senderId}
          onDone={() => setTab('home')}
        />
      )}
      {tab === 'mint' && (
        <Mint
          lang={lang}
          wallet={wallet}
          preset={preset}
          names={names}
          onMinted={() => void refreshNames(wallet, preset)}
        />
      )}
      {tab === 'swap' && <Swap lang={lang} wallet={wallet} preset={preset} />}
      {tab === 'send' && <Send lang={lang} wallet={wallet} preset={preset} />}
      {tab === 'node' && (
        <NodeScreen
          lang={lang}
          preset={preset}
          myNodeUrl={myNodeUrl}
          connectedUrl={nodeUrl}
          onUseNode={onUseNode}
          onReleaseNode={onReleaseNode}
        />
      )}
      {tab === 'settings' && (
        <Settings
          lang={lang}
          onLangChange={onLangChange}
          preset={preset}
          nodeUrl={nodeUrl}
          senderName={primaryName?.name ?? null}
          senderId={primaryName?.tokenId ?? senderId}
          names={names}
          onPresetChange={onPresetChange}
          onNodeUrlChange={onNodeUrlChange}
          onOpenNode={() => setTab('node')}
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
          borderTopColor: xColors.border,
          backgroundColor: xColors.bg,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8) + 4,
        }}
      >
        {(
          [
            ['home', '⌂', t.tabHome],
            ['mint', '＠', t.tabMint],
            ['swap', '⇄', t.tabSwap],
            ['send', '➤', t.tabSend],
            ['node', '▦', t.tabNode],
            ['settings', '⚙', t.tabSettings],
          ] as [Tab, string, string][]
        ).map(([key, glyph, label]) => (
          <TouchableOpacity key={key} style={{ flex: 1, alignItems: 'center' }} onPress={() => setTab(key)}>
            <Text
              style={{
                fontSize: 19,
                lineHeight: 23,
                color: tab === key ? xColors.text : xColors.sub,
                fontWeight: tab === key ? '700' : '400',
              }}
            >
              {glyph}
            </Text>
            <Text
              style={{
                fontSize: 10,
                color: tab === key ? xColors.text : xColors.sub,
                fontWeight: tab === key ? '700' : '400',
              }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}
