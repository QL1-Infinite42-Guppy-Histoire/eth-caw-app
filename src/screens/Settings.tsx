import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';

import { colors, styles } from '../theme';
import { deleteWallet, revealPhrase, storedAddress } from '../lib/wallet';
import { PRESETS, type NetworkPreset } from '../config';
import { LANGS, STRINGS, fmt, type Lang } from '../i18n';

interface Props {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  preset: NetworkPreset;
  nodeUrl: string;
  senderName: string | null;
  senderId: number | null;
  onPresetChange: (p: NetworkPreset) => void;
  onNodeUrlChange: (url: string) => void;
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
  onPresetChange,
  onNodeUrlChange,
  onWalletDeleted,
}: Props) {
  const t = STRINGS[lang];
  const [urlText, setUrlText] = useState(nodeUrl);
  const [address, setAddress] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);

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
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>{t.connection}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={p.id === preset.id ? styles.button : styles.ghostButton}
              onPress={() => onPresetChange(p)}
            >
              <Text style={p.id === preset.id ? styles.buttonText : styles.ghostText}>
                {p.isTestnet ? t.testnet : t.mainnet}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.sub}>{preset.label}</Text>
        <Text style={styles.sub}>{t.nodeUrlLabel}</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://…"
          value={urlText}
          onChangeText={setUrlText}
        />
        <TouchableOpacity style={styles.button} onPress={saveUrl}>
          <Text style={styles.buttonText}>{t.saveBtn}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{t.myName}</Text>
        {senderId != null ? (
          <Text style={styles.body}>
            {senderName ?? `#${senderId}`}（tokenId {senderId}）
          </Text>
        ) : (
          <Text style={styles.sub}>{t.noNameSettings}</Text>
        )}
        <Text style={styles.sub}>{t.walletAddress}</Text>
        <Text selectable style={styles.body}>
          {address ?? '…'}
        </Text>
        <TouchableOpacity
          onPress={async () => {
            if (address) await Clipboard.setStringAsync(address);
          }}
        >
          <Text style={{ color: colors.accent, fontSize: 13 }}>{t.copyAddress}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{t.phraseTitle}</Text>
        {phrase ? (
          <Text selectable style={styles.body}>
            {phrase}
          </Text>
        ) : (
          <TouchableOpacity onPress={showPhrase}>
            <Text style={{ color: colors.accent, fontSize: 14 }}>{t.showPhrase}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.sub}>{t.phraseWarning}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{t.language}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {LANGS.map((l) => (
            <TouchableOpacity
              key={l.id}
              style={l.id === lang ? styles.button : styles.ghostButton}
              onPress={() => onLangChange(l.id)}
            >
              <Text style={l.id === lang ? styles.buttonText : styles.ghostText}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity onPress={wipe} style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Text style={styles.dangerText}>{t.deleteWallet}</Text>
      </TouchableOpacity>
      <Text style={[styles.sub, { textAlign: 'center' }]}>
        {fmt(t.versionFooter, { v: 'v0.1.6' })}
      </Text>
    </ScrollView>
  );
}
