import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { xColors } from '../theme';
// X-style local styles for the v0.2.2 reskin of the tool screens: same
// tokens and shapes as the social surfaces (Home / Compose /
// Notifications) — white background, #EFF3F4-bordered cards, accent
// pill buttons, #CFD9DE-outlined secondary pills and inputs.
const xs = StyleSheet.create({
  root: { flex: 1, backgroundColor: xColors.bg },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: xColors.border,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  h1: { fontSize: 22, fontWeight: '800', color: xColors.text },
  title: { fontSize: 16, fontWeight: '700', color: xColors.text },
  body: { fontSize: 14, color: xColors.text, lineHeight: 20 },
  sub: { fontSize: 13, color: xColors.sub, lineHeight: 18 },
  input: {
    backgroundColor: '#ffffff',
    borderColor: xColors.divider,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: xColors.text,
  },
  button: {
    backgroundColor: xColors.accent,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  ghostButton: {
    borderColor: xColors.divider,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  ghostText: { color: xColors.text, fontSize: 15, fontWeight: '600' },
  dangerText: { color: xColors.danger, fontSize: 14, fontWeight: '600' },
});

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
    status === 'ok' ? xColors.accent : status === 'idle' || status === 'checking' ? xColors.sub : xColors.danger;

  return (
    <ScrollView style={xs.root} contentContainerStyle={xs.content}>
      <View style={xs.card}>
        <Text style={xs.title}>{t.nodeScreenTitle}</Text>
        <Text style={xs.sub}>{t.nodeIntro}</Text>
      </View>

      <View style={xs.card}>
        <Text style={xs.title}>{t.nodeBenefitTitle}</Text>
        <Text style={xs.body}>{t.nodeBenefitBody}</Text>
      </View>

      {connectedUrl ? (
        <View style={xs.card}>
          <Text style={[xs.body, { color: xColors.accent, fontWeight: '700' }]}>
            ● {t.nodeNowConnected}
          </Text>
          <Text selectable style={xs.sub}>
            {connectedUrl}
          </Text>
        </View>
      ) : null}

      <View style={xs.card}>
        <Text style={xs.title}>{t.myNodeTitle}</Text>
        {myNodeUrl ? (
          <Text selectable style={xs.body}>
            {myNodeUrl}
          </Text>
        ) : (
          <Text style={xs.sub}>{t.myNodeNone}</Text>
        )}
        {statusText && <Text style={[xs.body, { color: statusColor }]}>{statusText}</Text>}
        <Text style={xs.sub}>{t.nodeUrlLabel2}</Text>
        <TextInput
          style={xs.input}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://…trycloudflare.com"
          value={urlText}
          onChangeText={setUrlText}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={xs.ghostButton} onPress={paste}>
            <Text style={xs.ghostText}>{t.nodePasteBtn}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[xs.button, { flex: 1 }]} onPress={testAndUse} disabled={busy}>
            <Text style={xs.buttonText}>{t.nodeUseBtn}</Text>
          </TouchableOpacity>
        </View>
        {myNodeUrl ? (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity
              onPress={async () => setStatus(await check(myNodeUrl))}
            >
              <Text style={{ color: xColors.accent, fontSize: 14 }}>{t.nodeRecheckBtn}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={release}>
              <Text style={xs.dangerText}>{t.nodeReleaseBtn}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={xs.card}>
        <Text style={xs.title}>{t.nodeStep1Title}</Text>
        <Text style={xs.sub}>{t.nodeStep1Body}</Text>
        <Text style={[xs.sub, { fontWeight: '700' }]}>{t.nodeOpenProviderBtn}</Text>
        {(
          [
            [t.provConoha, 'https://www.conoha.jp/vps/'],
            [t.provXserver, 'https://vps.xserver.ne.jp/'],
            [t.provSakura, 'https://vps.sakura.ad.jp/'],
          ] as [string, string][]
        ).map(([label, url]) => (
          <TouchableOpacity key={url} style={xs.ghostButton} onPress={() => Linking.openURL(url)}>
            <Text style={xs.ghostText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={xs.card}>
        <Text style={xs.title}>{t.nodeStep2Title}</Text>
        <Text style={xs.sub}>{t.nodeStep2Body}</Text>
        <TouchableOpacity style={xs.button} onPress={copyScript} disabled={busy}>
          <Text style={xs.buttonText}>{t.nodeCopyScriptBtn}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={xs.ghostButton} onPress={copyCommand}>
          <Text style={xs.ghostText}>{t.nodeCopyCmdBtn}</Text>
        </TouchableOpacity>
        <Text selectable style={[xs.sub, { fontSize: 11 }]}>
          {INSTALL_COMMAND}
        </Text>
      </View>

      <View style={xs.card}>
        <Text style={xs.title}>{t.nodeStep3Title}</Text>
        <Text style={xs.sub}>{t.nodeStep3Body}</Text>
        <Text style={xs.sub}>{t.nodeReadonlyNote}</Text>
      </View>
    </ScrollView>
  );
}
