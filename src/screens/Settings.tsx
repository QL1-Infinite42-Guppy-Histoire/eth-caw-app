import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
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

import { deleteWallet, revealPhrase, storedAddress } from '../lib/wallet';
import { PRESETS, type NetworkPreset } from '../config';
import { LANGS, STRINGS, fmt, type Lang } from '../i18n';
import type { OwnedName } from '../lib/mint';
import NameCard from '../components/NameCard';
import WordConfirm from '../components/WordConfirm';

interface Props {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  preset: NetworkPreset;
  nodeUrl: string;
  senderName: string | null;
  senderId: number | null;
  names: OwnedName[];
  onPresetChange: (p: NetworkPreset) => void;
  onNodeUrlChange: (url: string) => void;
  onOpenNode: () => void;
  onWalletDeleted: () => void;
}

async function biometricGate(reason: string): Promise<boolean> {
  const res = await LocalAuthentication.authenticateAsync({ promptMessage: reason });
  return res.success;
}

export default function Settings({
  lang,
  onLangChange,
  preset,
  nodeUrl,
  senderName,
  senderId,
  names,
  onPresetChange,
  onNodeUrlChange,
  onOpenNode,
  onWalletDeleted,
}: Props) {
  const t = STRINGS[lang];
  const [urlText, setUrlText] = useState(nodeUrl);
  const [address, setAddress] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);

  React.useEffect(() => {
    storedAddress().then(setAddress);
  }, []);
  React.useEffect(() => setUrlText(nodeUrl), [nodeUrl]);

  const saveUrl = () => {
    onNodeUrlChange(urlText.trim());
    Alert.alert(t.savedTitle, t.savedMsg);
  };

  const showPhrase = async () => {
    if (!(await biometricGate(t.phrasePrompt))) return;
    setPhrase(await revealPhrase());
  };

  const wipe = async () => {
    if (!(await biometricGate(t.deletePrompt))) return;
    Alert.alert(t.deleteTitle, t.deleteMsg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.deleteBtn,
        style: 'destructive',
        onPress: async () => {
          await deleteWallet();
          onWalletDeleted();
        },
      },
    ]);
  };

  return (
    <ScrollView style={xs.root} contentContainerStyle={xs.content}>
      <View style={xs.card}>
        <Text style={xs.title}>{t.tabNode}</Text>
        <Text style={xs.sub}>
          {nodeUrl ? `${t.nodeConnectedTo}: ${nodeUrl}` : t.nodeNotConnected}
        </Text>
        <TouchableOpacity style={xs.button} onPress={onOpenNode}>
          <Text style={xs.buttonText}>{t.nodeOpenWizard}</Text>
        </TouchableOpacity>
      </View>

      <View style={xs.card}>
        <Text style={xs.title}>{t.connection}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={p.id === preset.id ? xs.button : xs.ghostButton}
              onPress={() => onPresetChange(p)}
            >
              <Text style={p.id === preset.id ? xs.buttonText : xs.ghostText}>
                {p.isTestnet ? t.testnet : t.mainnet}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={xs.sub}>{preset.label}</Text>
        <Text style={xs.sub}>{t.nodeUrlLabel}</Text>
        <TextInput
          style={xs.input}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://…"
          value={urlText}
          onChangeText={setUrlText}
        />
        <TouchableOpacity style={xs.button} onPress={saveUrl}>
          <Text style={xs.buttonText}>{t.saveBtn}</Text>
        </TouchableOpacity>
      </View>

      <View style={xs.card}>
        <Text style={xs.title}>{t.myName}</Text>
        {names.length > 0 ? (
          names.map((n) => <NameCard key={n.tokenId} name={n} lang={lang} />)
        ) : senderId != null ? (
          <Text style={xs.body}>
            {senderName ?? `#${senderId}`}（tokenId {senderId}）
          </Text>
        ) : (
          <Text style={xs.sub}>{t.noNameSettings}</Text>
        )}
        <Text style={xs.sub}>{t.walletAddress}</Text>
        <Text selectable style={xs.body}>
          {address ?? '…'}
        </Text>
        <TouchableOpacity
          onPress={async () => {
            if (address) await Clipboard.setStringAsync(address);
          }}
        >
          <Text style={{ color: xColors.accent, fontSize: 13 }}>{t.copyAddress}</Text>
        </TouchableOpacity>
      </View>

      <View style={xs.card}>
        <Text style={xs.title}>{t.phraseTitle}</Text>
        {phrase ? (
          <Text selectable style={xs.body}>
            {phrase}
          </Text>
        ) : (
          <TouchableOpacity onPress={showPhrase}>
            <Text style={{ color: xColors.accent, fontSize: 14 }}>{t.showPhrase}</Text>
          </TouchableOpacity>
        )}
        <Text style={xs.sub}>{t.phraseWarning}</Text>
        {confirmDone ? (
          <Text style={[xs.body, { color: xColors.accent }]}>{t.checkDone}</Text>
        ) : confirmOpen && phrase ? (
          <WordConfirm
            phrase={phrase}
            hint={t.checkHint}
            wrongText={t.checkWrong}
            doneText={t.checkDone}
            buttonLabel="OK"
            onDone={() => {
              setConfirmOpen(false);
              setConfirmDone(true);
            }}
          />
        ) : (
          <TouchableOpacity
            onPress={async () => {
              if (!phrase) await showPhrase();
              setConfirmOpen(true);
            }}
          >
            <Text style={{ color: xColors.accent, fontSize: 14 }}>{t.reBackupBtn}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={xs.card}>
        <Text style={xs.title}>{t.language}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LANGS.map((l) => (
            <TouchableOpacity
              key={l.id}
              style={l.id === lang ? xs.button : xs.ghostButton}
              onPress={() => onLangChange(l.id)}
            >
              <Text style={l.id === lang ? xs.buttonText : xs.ghostText}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity onPress={wipe} style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Text style={xs.dangerText}>{t.deleteWallet}</Text>
      </TouchableOpacity>
      <Text style={[xs.sub, { textAlign: 'center' }]}>
        {fmt(t.versionFooter, { v: 'v0.1.16' })}
      </Text>
    </ScrollView>
  );
}
