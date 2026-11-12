import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  type NetworkPreset,
} from './src/config';
import { colors, styles, xColors } from './src/theme';
import { hasWallet, loadWallet } from './src/lib/wallet';
import {
  IndexingError,
  getNotifications,
  loadSession,
  saveSession,
  setNodeUrl,
  verifyWallet,
  type CawItem,
  type Session,
} from './src/lib/api';
import { fetchOwnedNames, type OwnedName } from './src/lib/mint';
import { pickRegistryNode } from './src/lib/nodes';
import { BellIcon, HomeIcon, PersonIcon, SearchIcon } from './src/components/icons';
import type { PostUserRef } from './src/components/PostCell';
import Onboarding from './src/screens/Onboarding';
import Mint from './src/screens/Mint';
import Swap from './src/screens/Swap';
import Home from './src/screens/Home';
import Compose from './src/screens/Compose';
import Notifications from './src/screens/Notifications';
import Bookmarks from './src/screens/Bookmarks';
import Settings from './src/screens/Settings';
import NodeScreen from './src/screens/Node';
import Send from './src/screens/Send';
import Thread from './src/screens/Thread';
import UserProfile from './src/screens/UserProfile';
import Search from './src/screens/Search';
import ProfileMenu from './src/screens/ProfileMenu';
import WalletBalances from './src/screens/WalletBalances';

type Phase = 'boot' | 'onboarding' | 'locked' | 'main';

// v0.3.0 navigation: four bottom tabs (Home / Search / Notifications /
// Profile). Everything else — Compose, Thread, user profiles, and the
// tool screens (Mint / Swap / Send / Server / Settings / Bookmarks /
// Wallet) — is an overlay pushed on a small stack above the tab content,
// so Back returns to where the user was.
type Tab = 'home' | 'search' | 'notifications' | 'profile';
type Overlay =
  | { kind: 'compose' }
  | { kind: 'thread'; item: CawItem }
  | { kind: 'user'; tokenId: number; username: string | null }
  | { kind: 'bookmarks' }
  | { kind: 'wallet' }
  | { kind: 'mint' }
  | { kind: 'swap' }
  | { kind: 'send' }
  | { kind: 'node' }
  | { kind: 'settings' };

function AppInner() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [lang, setLang] = useState<Lang>('ja');
  const insets = useSafeAreaInsets();
  const t = STRINGS[lang];
  const [tab, setTab] = useState<Tab>('home');
  const [stack, setStack] = useState<Overlay[]>([]);
  const [preset, setPreset] = useState<NetworkPreset>(MAINNET_PRESET);
  const [names, setNames] = useState<OwnedName[]>([]);
  const [nodeUrl, setNodeUrlState] = useState('');
  const [myNodeUrl, setMyNodeUrl] = useState('');
  const [wallet, setWallet] = useState<ethers.HDNodeWallet | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const senderId = session?.authorizedTokenIds[0] ?? null;
  const langRef = React.useRef(lang);
  langRef.current = lang;

  const push = useCallback((o: Overlay) => setStack((s) => [...s, o]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const goTab = useCallback((next: Tab) => {
    setStack([]);
    setTab(next);
  }, []);
  const openPost = useCallback((item: CawItem) => push({ kind: 'thread', item }), [push]);
  const openUser = useCallback(
    (user: PostUserRef) => push({ kind: 'user', tokenId: user.tokenId, username: user.username }),
    [push],
  );

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
  const senderObj = names.find((n) => n.tokenId === senderId) ?? null;

  // Unread-notification dot for the Notifications tab. Read once per
  // session / tab change from the notifications fetch (its response
  // carries unreadCount) — deliberately no polling.
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const refreshUnread = useCallback(async () => {
    if (!session || senderId == null) {
      setUnreadCount(null);
      return;
    }
    try {
      const page = await getNotifications(session, senderId, { limit: 1 });
      setUnreadCount(page.unreadCount);
    } catch {
      setUnreadCount(null);
    }
  }, [session, senderId]);
  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread, tab]);

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

  const onCompose = () => {
    if (!session || senderId == null) {
      Alert.alert(t.nameRequiredTitle, t.nameRequiredMsgPost);
      return;
    }
    push({ kind: 'compose' });
  };

  const topOverlay = stack[stack.length - 1] ?? null;

  const renderOverlay = (o: Overlay) => {
    switch (o.kind) {
      case 'compose':
        return session && senderId != null ? (
          <Compose
            lang={lang}
            wallet={wallet}
            preset={preset}
            session={session}
            senderId={senderId}
            senderName={senderObj?.name ?? null}
            senderImageSvg={senderObj?.imageSvg ?? null}
            onDone={pop}
          />
        ) : null;
      case 'thread':
        return (
          <Thread
            lang={lang}
            wallet={wallet}
            preset={preset}
            session={session}
            senderId={senderId}
            senderName={senderObj}
            item={o.item}
            onBack={pop}
            onOpenPost={openPost}
            onOpenUser={openUser}
          />
        );
      case 'user':
        return (
          <UserProfile
            lang={lang}
            wallet={wallet}
            preset={preset}
            session={session}
            senderId={senderId}
            tokenId={o.tokenId}
            username={o.username}
            onBack={pop}
            onOpenPost={openPost}
            onOpenUser={openUser}
          />
        );
      case 'bookmarks':
        return (
          <Bookmarks
            lang={lang}
            wallet={wallet}
            preset={preset}
            session={session}
            senderId={senderId}
            onClose={pop}
            onOpenPost={openPost}
            onOpenUser={openUser}
          />
        );
      case 'wallet':
        return (
          <WalletBalances lang={lang} wallet={wallet} preset={preset} names={names} onClose={pop} />
        );
      case 'mint':
        return (
          <Mint
            lang={lang}
            wallet={wallet}
            preset={preset}
            names={names}
            onMinted={() => void refreshNames(wallet, preset)}
          />
        );
      case 'swap':
        return <Swap lang={lang} wallet={wallet} preset={preset} />;
      case 'send':
        return <Send lang={lang} wallet={wallet} preset={preset} />;
      case 'node':
        return (
          <NodeScreen
            lang={lang}
            preset={preset}
            myNodeUrl={myNodeUrl}
            connectedUrl={nodeUrl}
            onUseNode={onUseNode}
            onReleaseNode={onReleaseNode}
          />
        );
      case 'settings':
        return (
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
            onOpenNode={() => push({ kind: 'node' })}
            onWalletDeleted={() => {
              setWallet(null);
              setSession(null);
              setStack([]);
              setPhase('onboarding');
            }}
          />
        );
    }
  };

  const showHeader = tab === 'home' || tab === 'search';

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: xColors.bg }}>
        {showHeader && (
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
                  paddingVertical: 2,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: session ? xColors.recaw : xColors.divider,
                  }}
                />
                <Text style={{ fontSize: 10, color: session ? xColors.accent : xColors.sub }}>
                  {session ? t.chipConnected : t.headerWaiting}
                </Text>
              </View>
            </View>
          </View>
        )}

        {tab === 'home' && (
          <Home
            lang={lang}
            wallet={wallet}
            preset={preset}
            session={session}
            senderId={senderId}
            onGoNode={() => push({ kind: 'node' })}
            onCompose={onCompose}
            onOpenPost={openPost}
            onOpenUser={openUser}
          />
        )}
        {tab === 'search' && (
          <Search
            lang={lang}
            wallet={wallet}
            preset={preset}
            session={session}
            senderId={senderId}
            onOpenPost={openPost}
            onOpenUser={openUser}
          />
        )}
        {tab === 'notifications' && (
          <Notifications lang={lang} session={session} senderId={senderId} />
        )}
        {tab === 'profile' && (
          <ProfileMenu
            lang={lang}
            wallet={wallet}
            preset={preset}
            session={session}
            names={names}
            onOpenWallet={() => push({ kind: 'wallet' })}
            onOpenNames={() => push({ kind: 'mint' })}
            onOpenSwap={() => push({ kind: 'swap' })}
            onOpenSend={() => push({ kind: 'send' })}
            onOpenBookmarks={() => push({ kind: 'bookmarks' })}
            onOpenServer={() => push({ kind: 'node' })}
            onOpenSettings={() => push({ kind: 'settings' })}
          />
        )}

        {topOverlay && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: xColors.bg, paddingTop: insets.top },
            ]}
          >
            {renderOverlay(topOverlay)}
          </View>
        )}
      </View>

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
            ['home', t.tabHome],
            ['search', t.tabSearch],
            ['notifications', t.tabNotif],
            ['profile', t.tabProfile],
          ] as [Tab, string][]
        ).map(([key, label]) => {
          const active = tab === key;
          const color = active ? xColors.text : xColors.sub;
          const icon =
            key === 'home' ? (
              <HomeIcon size={23} color={color} filled={active} />
            ) : key === 'search' ? (
              <SearchIcon size={23} color={color} />
            ) : key === 'notifications' ? (
              <BellIcon size={23} color={color} filled={active} />
            ) : (
              <PersonIcon size={23} color={color} filled={active} />
            );
          return (
            <TouchableOpacity
              key={key}
              style={{ flex: 1, alignItems: 'center', paddingTop: 2 }}
              onPress={() => goTab(key)}
            >
              {tab === key && (
                <View
                  style={{
                    position: 'absolute',
                    top: -8,
                    height: 3,
                    width: 48,
                    borderRadius: 2,
                    backgroundColor: xColors.accent,
                  }}
                />
              )}
              <View>
                {icon}
                {key === 'notifications' && unreadCount != null && unreadCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -1,
                      right: -2,
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                      backgroundColor: xColors.accent,
                      borderWidth: 1.5,
                      borderColor: xColors.bg,
                    }}
                  />
                )}
              </View>
              <Text
                style={{
                  fontSize: 10,
                  color,
                  fontWeight: active ? '700' : '400',
                  marginTop: 2,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
