import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import Drawer from './src/components/Drawer';
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
import WalletBalances from './src/screens/WalletBalances';

type Phase = 'boot' | 'onboarding' | 'locked' | 'main';

// v0.4.0 navigation (QL1 v0.6.2 form): four bottom tabs (Home / Search /
// Bell(Notifications) / Profile), icon-only like X. The Profile tab
// opens the user's OWN profile page directly. The header avatar opens
// an X-style drawer (components/Drawer.tsx) that is the menu home —
// wallet, names, swap, bookmarks, server and settings are reached
// from its rows. Everything else — Compose, Thread, other users'
// profiles, and the tool screens — is an overlay pushed on a small
// stack above the tab content, so Back returns to where the user was.
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The acting-name pick (QL1's actingId slot): the compose name chip
  // switches among the ids the node session authorizes. Default is
  // the session's first authorized id — exactly the pre-v0.4.0
  // derivation — and a pick is honored only while it stays inside
  // session.authorizedTokenIds, so the signing path never sees an
  // unauthorized sender.
  const [senderPick, setSenderPick] = useState<number | null>(null);
  const authorizedIds = session?.authorizedTokenIds ?? [];
  const senderId =
    senderPick != null && authorizedIds.includes(senderPick)
      ? senderPick
      : (authorizedIds[0] ?? null);
  const sessionAddress = session?.address ?? null;
  useEffect(() => {
    setSenderPick(null);
  }, [sessionAddress]);
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
  // The names the compose chip may switch among: owned AND authorized.
  const senderOptions = names.filter((n) => authorizedIds.includes(n.tokenId));
  // The Profile tab's page: the acting name when there is one.
  const ownProfileName = senderObj ?? primaryName;

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

  // Android back (QL1's order): the drawer closes first, then the
  // top overlay pops; at the tab root the system default applies.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (stack.length > 0) {
        pop();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [drawerOpen, stack.length, pop]);

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
            senderOptions={senderOptions}
            onPickSender={setSenderPick}
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
          <WalletBalances
            lang={lang}
            wallet={wallet}
            preset={preset}
            names={names}
            onClose={pop}
            onOpenProfile={() => {
              setStack([]);
              setTab('profile');
            }}
            onOpenSend={() => push({ kind: 'send' })}
            onOpenMint={() => push({ kind: 'mint' })}
          />
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

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: xColors.bg }}>
        {/* Header (QL1 v0.6.1 form, on every tab): as spare as X's
            own — the acting name's avatar at the start (tapping it
            opens the drawer, the menu home), a small centered CAW
            mark, and at the end the node connection status chip.
            The status display is functionally necessary on this
            side (posting depends on the node session), so it keeps
            its place here and on the drawer's Server row. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: insets.top + 10,
            paddingBottom: 10,
            backgroundColor: xColors.bg,
            borderBottomWidth: 1,
            borderBottomColor: xColors.border,
          }}
        >
          <Pressable
            onPress={() => setDrawerOpen(true)}
            hitSlop={6}
            style={({ pressed }) => [
              { width: 44, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t.tabProfile}
          >
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
          </Pressable>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: insets.top,
              bottom: 0,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Image
              source={require('./assets/icon.png')}
              style={{ width: 20, height: 20, borderRadius: 5 }}
            />
            <Text style={{ fontSize: 17, fontWeight: '800', color: xColors.text, letterSpacing: 0.5 }}>
              CAW
            </Text>
          </View>
          <View
            style={{
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
        {tab === 'profile' &&
          (ownProfileName ? (
            <UserProfile
              key={ownProfileName.tokenId}
              lang={lang}
              wallet={wallet}
              preset={preset}
              session={session}
              senderId={senderId}
              tokenId={ownProfileName.tokenId}
              username={ownProfileName.name}
              onOpenPost={openPost}
              onOpenUser={openUser}
            />
          ) : (
            <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
              <Text style={{ fontSize: 15, color: xColors.text, lineHeight: 22 }}>
                {t.noNamesYet}
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: xColors.accent,
                  borderRadius: 999,
                  paddingVertical: 13,
                  paddingHorizontal: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 48,
                  alignSelf: 'flex-start',
                  marginTop: 12,
                }}
                onPress={() => push({ kind: 'mint' })}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t.tabMint}</Text>
              </TouchableOpacity>
            </View>
          ))}

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

      {/* Bottom tab bar (QL1 v0.6.0 form): FOUR entries, icon-only
          (labels survive as accessibility labels). The bell is this
          app's Notifications tab — its unread badge is the count
          badge in QL1's metrics, fed by the same getNotifications
          read as before. */}
      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          backgroundColor: xColors.bg,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: -2 },
          zIndex: 10,
          paddingBottom: insets.bottom,
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
          const color = active ? xColors.accent : xColors.sub;
          const icon =
            key === 'home' ? (
              <HomeIcon size={22} color={color} filled={active} />
            ) : key === 'search' ? (
              <SearchIcon size={22} color={color} />
            ) : key === 'notifications' ? (
              <BellIcon size={22} color={color} filled={active} />
            ) : (
              <PersonIcon size={22} color={color} filled={active} />
            );
          return (
            <TouchableOpacity
              key={key}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }}
              onPress={() => goTab(key)}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                {icon}
                {key === 'notifications' && unreadCount != null && unreadCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -5,
                      right: -5,
                      minWidth: 19,
                      height: 19,
                      borderRadius: 10,
                      paddingHorizontal: 5,
                      backgroundColor: xColors.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: xColors.bg,
                    }}
                  >
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#fff' }}>
                      {unreadCount > 99 ? '99+' : String(unreadCount)}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lang={lang}
        name={ownProfileName}
        session={session}
        onOpenProfile={() => goTab('profile')}
        onOpenWallet={() => push({ kind: 'wallet' })}
        onOpenNames={() => push({ kind: 'mint' })}
        onOpenSwap={() => push({ kind: 'swap' })}
        onOpenBookmarks={() => push({ kind: 'bookmarks' })}
        onOpenNotifications={() => goTab('notifications')}
        onOpenServer={() => push({ kind: 'node' })}
        onOpenSettings={() => push({ kind: 'settings' })}
      />
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
