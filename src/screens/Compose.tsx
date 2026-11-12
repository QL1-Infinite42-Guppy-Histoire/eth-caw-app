import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ethers } from 'ethers';
import Svg, { Circle } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';

import { xColors } from '../theme';
import { postAction } from '../lib/actions';
import { getValidatorTip } from '../lib/api';
import type { Session } from '../lib/api';
import type { NetworkPreset } from '../config';
import { STRINGS, fmt, type Lang } from '../i18n';
import { ChevronDownIcon, CloseIcon } from '../components/icons';

/** Protocol maximum post length (manifesto): longer posts are rejected. */
export const MAX_POST_CHARS = 420;

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet;
  preset: NetworkPreset;
  session: Session;
  senderId: number;
  /** Display-only: the @handle of the name this post will be sent as. */
  senderName?: string | null;
  /** NFT artwork of the sender name, when the app has it. */
  senderImageSvg?: string | null;
  onDone: () => void;
}

/** X-style character ring: fills toward the 420 max, red once over. */
function CharRing({ count }: { count: number }) {
  const size = 26;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const frac = Math.min(1, count / MAX_POST_CHARS);
  const over = count > MAX_POST_CHARS;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={xColors.border} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={over ? xColors.danger : xColors.accent}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${circ * frac} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function Compose({
  lang,
  wallet,
  preset,
  session,
  senderId,
  senderName,
  senderImageSvg,
  onDone,
}: Props) {
  const t = STRINGS[lang];
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState<bigint | null>(null);

  React.useEffect(() => {
    getValidatorTip()
      .then(setTip)
      .catch(() => setTip(null));
  }, []);

  const count = text.length;
  const remaining = MAX_POST_CHARS - count;
  const tooLong = count > MAX_POST_CHARS;
  const canPost = !busy && !!text.trim() && !tooLong;

  const submit = async () => {
    const body = text.trim();
    if (!body || tooLong) return;
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
          <CloseIcon size={21} color={xColors.text} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <CharRing count={count} />
            <Text
              style={{
                fontSize: 12,
                color: tooLong ? xColors.danger : xColors.sub,
                fontWeight: tooLong ? '700' : '400',
              }}
            >
              {remaining < 0 ? remaining : count}/{MAX_POST_CHARS}
            </Text>
          </View>
          <TouchableOpacity
            style={{
              backgroundColor: xColors.accent,
              borderRadius: 999,
              paddingHorizontal: 20,
              paddingVertical: 8,
              opacity: canPost ? 1 : 0.45,
            }}
            onPress={submit}
            disabled={!canPost}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
              {busy ? t.sending : t.postBtn}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 14 }}>
        {senderImageSvg ? (
          <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden' }}>
            <SvgXml xml={senderImageSvg} width={40} height={40} />
          </View>
        ) : (
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
              {(senderName?.replace(/^#/, '').charAt(0) || wallet.address.slice(2, 3)).toUpperCase()}
            </Text>
          </View>
        )}
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          paddingLeft: 68,
          paddingRight: 16,
          marginTop: 4,
        }}
      >
        {senderName && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              borderWidth: 1,
              borderColor: xColors.divider,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: xColors.text }}>@{senderName}</Text>
            <ChevronDownIcon size={15} color={xColors.sub} />
          </View>
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 12, color: xColors.sub, lineHeight: 17 }}>{t.postNote}</Text>
          {tip != null && (
            <Text style={{ fontSize: 12, color: xColors.sub, lineHeight: 17 }}>
              {fmt(t.validatorTip, { n: tip.toLocaleString('ja-JP') })}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
