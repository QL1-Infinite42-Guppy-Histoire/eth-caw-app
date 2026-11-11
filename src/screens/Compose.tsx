import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ethers } from 'ethers';

import { styles } from '../theme';
import { postAction } from '../lib/actions';
import { getValidatorTip } from '../lib/api';
import type { Session } from '../lib/api';
import type { NetworkPreset } from '../config';
import { STRINGS, fmt, type Lang } from '../i18n';

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet;
  preset: NetworkPreset;
  session: Session;
  senderId: number;
  onDone: () => void;
}

export default function Compose({ lang, wallet, preset, session, senderId, onDone }: Props) {
  const t = STRINGS[lang];
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState<bigint | null>(null);

  React.useEffect(() => {
    getValidatorTip()
      .then(setTip)
      .catch(() => setTip(null));
  }, []);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await postAction(wallet, preset, session, senderId, body);
      Alert.alert(t.postedTitle, t.postedMsg);
      onDone();
    } catch (e) {
      Alert.alert(t.postFailedTitle, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, styles.content]}>
      <Text style={styles.title}>{t.postTitle}</Text>
      <Text style={styles.sub}>{t.postNote}</Text>
      {tip != null && (
        <Text style={styles.sub}>{fmt(t.validatorTip, { n: tip.toLocaleString('ja-JP') })}</Text>
      )}
      <TextInput
        style={[styles.input, { minHeight: 140, textAlignVertical: 'top' }]}
        multiline
        autoFocus
        maxLength={2000}
        placeholder={t.postPlaceholder}
        value={text}
        onChangeText={setText}
      />
      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy || !text.trim()}>
        <Text style={styles.buttonText}>{busy ? t.sending : t.postBtn}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDone}>
        <Text style={styles.sub}>{t.backToTimeline}</Text>
      </TouchableOpacity>
    </View>
  );
}
