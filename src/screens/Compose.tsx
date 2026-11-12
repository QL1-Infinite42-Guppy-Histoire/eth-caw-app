import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ethers } from 'ethers';

import { xColors } from '../theme';
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
  /** Display-only: the @handle of the name this post will be sent as. */
  senderName?: string | null;
  onDone: () => void;
}

export default function Compose({ lang, wallet, preset, session, senderId, senderName, onDone }: Props) {
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
    <View style={{ flex: 1, backgroundColor: xColors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: xColors.border,
        }}
      >
        <TouchableOpacity onPress={onDone} hitSlop={8}>
          <Text style={{ fontSize: 20, color: xColors.text }}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            backgroundColor: xColors.accent,
            borderRadius: 999,
            paddingHorizontal: 20,
            paddingVertical: 8,
            opacity: busy || !text.trim() ? 0.45 : 1,
          }}
          onPress={submit}
          disabled={busy || !text.trim()}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
            {busy ? t.sending : t.postBtn}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: xColors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {wallet.address.slice(2, 3).toUpperCase()}
          </Text>
        </View>
        <TextInput
          style={{
            flex: 1,
            minHeight: 120,
            textAlignVertical: 'top',
            fontSize: 17,
            color: xColors.text,
            paddingTop: 8,
          }}
          multiline
          autoFocus
          maxLength={2000}
          placeholder={t.postPlaceholder}
          placeholderTextColor={xColors.sub}
          value={text}
          onChangeText={setText}
        />
      </View>
      <View style={{ paddingLeft: 66, paddingRight: 16, gap: 4 }}>
        {senderName && (
          <View
            style={{
              alignSelf: 'flex-start',
              borderWidth: 1,
              borderColor: xColors.border,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 5,
              marginBottom: 2,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: xColors.text }}>@{senderName}</Text>
          </View>
        )}
        <Text style={{ fontSize: 12, color: xColors.sub, lineHeight: 17 }}>{t.postNote}</Text>
        {tip != null && (
          <Text style={{ fontSize: 12, color: xColors.sub, lineHeight: 17 }}>
            {fmt(t.validatorTip, { n: tip.toLocaleString('ja-JP') })}
          </Text>
        )}
      </View>
    </View>
  );
}
