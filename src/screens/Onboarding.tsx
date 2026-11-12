import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

import { createWallet, importWallet } from '../lib/wallet';
import { STRINGS, type Lang } from '../i18n';
import WordConfirm from '../components/WordConfirm';

export default function Onboarding({ lang, onReady }: { lang: Lang; onReady: () => void }) {
  const t = STRINGS[lang];
  const [mode, setMode] = useState<'choose' | 'created' | 'import'>('choose');
  const [phrase, setPhrase] = useState('');
  const [importText, setImportText] = useState('');
  const [busy, setBusy] = useState(false);

  const doCreate = async () => {
    setBusy(true);
    try {
      const { phrase: p } = await createWallet();
      setPhrase(p);
      setMode('created');
    } catch (e) {
      Alert.alert(t.createFailed, String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      await importWallet(importText);
      onReady();
    } catch (e) {
      Alert.alert(t.importFailed, String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={xs.root} contentContainerStyle={xs.content}>
      <Text style={xs.h1}>CAW — Ethereum Edition</Text>
      <Text style={xs.sub}>{t.intro}</Text>

      {mode === 'choose' && (
        <View style={{ gap: 10 }}>
          <TouchableOpacity style={xs.button} onPress={doCreate} disabled={busy}>
            <Text style={xs.buttonText}>{t.createBtn}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={xs.ghostButton} onPress={() => setMode('import')}>
            <Text style={xs.ghostText}>{t.importBtn}</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'created' && (
        <View style={xs.card}>
          <Text style={xs.title}>{t.phraseTitleCreate}</Text>
          <Text style={[xs.body, { color: xColors.danger }]}>{t.phraseWarningCreate}</Text>
          <Text selectable style={[xs.body, { fontWeight: '600' }]}>
            {phrase}
          </Text>
          <WordConfirm
            phrase={phrase}
            hint={t.checkHint}
            wrongText={t.checkWrong}
            doneText={t.checkDone}
            buttonLabel={t.proceedBtn}
            onDone={onReady}
          />
        </View>
      )}

      {mode === 'import' && (
        <View style={{ gap: 10 }}>
          <TextInput
            style={[xs.input, { minHeight: 88, textAlignVertical: 'top' }]}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t.importPlaceholder}
            value={importText}
            onChangeText={setImportText}
          />
          <TouchableOpacity style={xs.button} onPress={doImport} disabled={busy}>
            <Text style={xs.buttonText}>{t.restoreBtn}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('choose')}>
            <Text style={xs.sub}>{t.back}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
