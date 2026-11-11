import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { colors, styles } from '../theme';
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
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>CAW — Ethereum Edition</Text>
      <Text style={styles.sub}>{t.intro}</Text>

      {mode === 'choose' && (
        <View style={{ gap: 10 }}>
          <TouchableOpacity style={styles.button} onPress={doCreate} disabled={busy}>
            <Text style={styles.buttonText}>{t.createBtn}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => setMode('import')}>
            <Text style={styles.ghostText}>{t.importBtn}</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'created' && (
        <View style={styles.card}>
          <Text style={styles.title}>{t.phraseTitleCreate}</Text>
          <Text style={[styles.body, { color: colors.danger }]}>{t.phraseWarningCreate}</Text>
          <Text selectable style={[styles.body, { fontWeight: '600' }]}>
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
            style={[styles.input, { minHeight: 88, textAlignVertical: 'top' }]}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t.importPlaceholder}
            value={importText}
            onChangeText={setImportText}
          />
          <TouchableOpacity style={styles.button} onPress={doImport} disabled={busy}>
            <Text style={styles.buttonText}>{t.restoreBtn}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('choose')}>
            <Text style={styles.sub}>{t.back}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
