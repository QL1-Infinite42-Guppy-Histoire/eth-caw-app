import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { colors, styles } from '../theme';
import { STRINGS, type Lang } from '../i18n';
import { INSTALL_COMMAND, type NetworkPreset } from '../config';
import { fetchInstallScript, probeNodeInfo } from '../lib/nodes';

interface Props {
  lang: Lang;
  preset: NetworkPreset;
  /** The node URL the user registered as their own ('' when none). */
  myNodeUrl: string;
  /** The server the app is currently connected through ('' when none). */
  connectedUrl: string;
  /** Save this URL as my node and connect to it. */
  onUseNode: (url: string) => void;
  /** Forget my node; the app goes back to automatic discovery. */
  onReleaseNode: () => void;
}

type Status = 'idle' | 'checking' | 'ok' | 'bad' | 'wrongnet';

export default function Node({ lang, preset, myNodeUrl, connectedUrl, onUseNode, onReleaseNode }: Props) {
  const t = STRINGS[lang];
  const [urlText, setUrlText] = useState(myNodeUrl);
  const [status, setStatus] = useState<Status>('idle');
  const [busy, setBusy] = useState(false);

  useEffect(() => setUrlText(myNodeUrl), [myNodeUrl]);

  const check = useCallback(
    async (url: string): Promise<Status> => {
      const clean = url.trim().replace(/\/+$/, '');
      if (!clean) return 'bad';
      setStatus('checking');
      const info = await probeNodeInfo(clean);
      if (!info.ok) return 'bad';
      if (info.networkId != null && info.networkId !== preset.cawNetworkId) return 'wrongnet';
      return 'ok';
    },
    [preset.cawNetworkId],
  );

  // When a node of mine is already registered, show its live status.
  useEffect(() => {
    if (!myNodeUrl) return;
    let live = true;
    check(myNodeUrl).then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, [myNodeUrl, check]);

  const testAndUse = async () => {
    const clean = urlText.trim().replace(/\/+$/, '');
    if (!clean) return;
    setBusy(true);
    const s = await check(clean);
    setStatus(s);
    setBusy(false);
    if (s === 'ok') {
      onUseNode(clean);
      Alert.alert(t.nodeSavedOk, clean);
    }
  };

  const paste = async () => {
    const s = await Clipboard.getStringAsync();
    if (s) setUrlText(s.trim());
  };

  const copyScript = async () => {
    setBusy(true);
    const script = await fetchInstallScript();
    setBusy(false);
    if (!script) {
      Alert.alert(t.failedTitle, t.nodeScriptFail);
      return;
    }
    await Clipboard.setStringAsync(script);
    Alert.alert(t.nodeCopied);
  };

  const copyCommand = async () => {
    await Clipboard.setStringAsync(INSTALL_COMMAND);
    Alert.alert(t.nodeCopied);
  };

  const release = () => {
    Alert.alert(t.myNodeTitle, t.nodeReleaseBtn + '?', [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.nodeReleaseBtn,
        style: 'destructive',
        onPress: () => {
          onReleaseNode();
          setStatus('idle');
          setUrlText('');
        },
      },
    ]);
  };

  const statusText =
    status === 'ok'
      ? t.nodeStatusOk
      : status === 'bad'
        ? t.nodeStatusBad
        : status === 'wrongnet'
          ? t.nodeNetworkWrong
          : status === 'checking'
            ? t.nodeStatusChecking
            : null;
  const statusColor =
    status === 'ok' ? colors.accent : status === 'idle' || status === 'checking' ? colors.sub : '#c0392b';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>{t.nodeScreenTitle}</Text>
        <Text style={styles.sub}>{t.nodeIntro}</Text>
      </View>

      {connectedUrl ? (
        <View style={styles.card}>
          <Text style={[styles.body, { color: colors.accent, fontWeight: '700' }]}>
            ● {t.nodeNowConnected}
          </Text>
          <Text selectable style={styles.sub}>
            {connectedUrl}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.title}>{t.myNodeTitle}</Text>
        {myNodeUrl ? (
          <Text selectable style={styles.body}>
            {myNodeUrl}
          </Text>
        ) : (
          <Text style={styles.sub}>{t.myNodeNone}</Text>
        )}
        {statusText && <Text style={[styles.body, { color: statusColor }]}>{statusText}</Text>}
        <Text style={styles.sub}>{t.nodeUrlLabel2}</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://…trycloudflare.com"
          value={urlText}
          onChangeText={setUrlText}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.ghostButton} onPress={paste}>
            <Text style={styles.ghostText}>{t.nodePasteBtn}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { flex: 1 }]} onPress={testAndUse} disabled={busy}>
            <Text style={styles.buttonText}>{t.nodeUseBtn}</Text>
          </TouchableOpacity>
        </View>
        {myNodeUrl ? (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity
              onPress={async () => setStatus(await check(myNodeUrl))}
            >
              <Text style={{ color: colors.accent, fontSize: 14 }}>{t.nodeRecheckBtn}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={release}>
              <Text style={styles.dangerText}>{t.nodeReleaseBtn}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{t.nodeStep1Title}</Text>
        <Text style={styles.sub}>{t.nodeStep1Body}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => Linking.openURL('https://www.conoha.jp/vps/')}
        >
          <Text style={styles.buttonText}>{t.nodeOpenProviderBtn}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{t.nodeStep2Title}</Text>
        <Text style={styles.sub}>{t.nodeStep2Body}</Text>
        <TouchableOpacity style={styles.button} onPress={copyScript} disabled={busy}>
          <Text style={styles.buttonText}>{t.nodeCopyScriptBtn}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostButton} onPress={copyCommand}>
          <Text style={styles.ghostText}>{t.nodeCopyCmdBtn}</Text>
        </TouchableOpacity>
        <Text selectable style={[styles.sub, { fontSize: 11 }]}>
          {INSTALL_COMMAND}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{t.nodeStep3Title}</Text>
        <Text style={styles.sub}>{t.nodeStep3Body}</Text>
        <Text style={styles.sub}>{t.nodeReadonlyNote}</Text>
      </View>
    </ScrollView>
  );
}
