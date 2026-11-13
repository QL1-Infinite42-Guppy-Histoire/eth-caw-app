import React, { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ethers } from 'ethers';
import Svg, { Circle } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';

import { xColors } from '../theme';
import { postAction } from '../lib/actions';
import { getValidatorTip } from '../lib/api';
import type { Session } from '../lib/api';
import type { OwnedName } from '../lib/mint';
import type { NetworkPreset } from '../config';
import { STRINGS, fmt, type Lang } from '../i18n';
import { ChevronDownIcon, CloseIcon } from '../components/icons';
import UserAvatar from '../components/UserAvatar';

/** Protocol maximum post length (manifesto): longer posts are rejected. */
export const MAX_POST_CHARS = 420;

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet;
  preset: NetworkPreset;
  session: Session;
  senderId: number;
  /** Display: the @handle of the name this post will be sent as. */
  senderName?: string | null;
  /** NFT artwork of the sender name, when the app has it. */
  senderImageSvg?: string | null;
  /** The names the node session authorizes — the switch chip's list. */
  senderOptions: OwnedName[];
  /** Switch the acting name (QL1's chooseActing slot). Only ids the
   *  session authorizes are ever offered, so the signing path is
   *  unchanged: signAndSubmit receives the picked senderId. */
  onPickSender: (tokenId: number) => void;
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

function SenderAvatar({
  name,
  imageSvg,
  address,
  size = 40,
}: {
  name: OwnedName | null;
  imageSvg?: string | null;
  address: string;
  size?: number;
}) {
  if (imageSvg) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        <SvgXml xml={imageSvg} width={size} height={size} />
      </View>
    );
  }
  return (
    <UserAvatar
      label={name?.name ?? address.slice(2)}
      seed={name?.name ?? address}
      size={size}
    />
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
  senderOptions,
  onPickSender,
  onDone,
}: Props) {
  const t = STRINGS[lang];
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState<bigint | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  React.useEffect(() => {
    getValidatorTip()
      .then(setTip)
      .catch(() => setTip(null));
  }, []);

  const count = text.length;
  const remaining = MAX_POST_CHARS - count;
  const tooLong = count > MAX_POST_CHARS;
  const canPost = !busy && !!text.trim() && !tooLong;
  const senderObj = senderOptions.find((n) => n.tokenId === senderId) ?? null;
  const switchable = senderOptions.length > 1;

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

  const chip = (
    <>
      <Text style={{ fontSize: 14, fontWeight: '700', color: xColors.text }}>
        {senderName ? `@${senderName}` : `#${senderId}`}
      </Text>
      {switchable && <ChevronDownIcon size={15} color={xColors.sub} />}
    </>
  );
  const chipStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: xColors.divider,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  } as const;

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

      {/* Name-switch row (QL1 v0.6.0 form): "Post as:" + ONE chip
          showing the acting name. With more than one authorized
          name the chip opens the picker; with one it is static —
          no dead buttons. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          marginTop: 12,
        }}
      >
        <Text style={{ fontSize: 13, color: xColors.sub }}>{t.postAs}:</Text>
        {switchable ? (
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [chipStyle, pressed && { backgroundColor: '#e8f5fe' }]}
            accessibilityRole="button"
          >
            {chip}
          </Pressable>
        ) : (
          <View style={chipStyle}>{chip}</View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 14 }}>
        <SenderAvatar name={senderObj} imageSvg={senderImageSvg} address={wallet.address} />
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

      {/* Cost lines: what this post costs — the two numbers a poster
          needs at the moment of posting, and nothing else (QL1's
          cost-line rule; the figures are this network's real ones). */}
      <View style={{ paddingHorizontal: 16, marginTop: 8, gap: 3 }}>
        <Text style={{ fontSize: 12, color: xColors.sub, lineHeight: 17 }}>{t.postNote}</Text>
        {tip != null && (
          <Text style={{ fontSize: 12, color: xColors.sub, lineHeight: 17 }}>
            {fmt(t.validatorTip, { n: tip.toLocaleString('ja-JP') })}
          </Text>
        )}
        {senderObj?.depositCaw != null && (
          <Text style={{ fontSize: 12, color: xColors.sub, lineHeight: 17 }}>
            {fmt(t.depositLabel, {
              n: Number(ethers.formatUnits(senderObj.depositCaw, 18)).toLocaleString('ja-JP', {
                maximumFractionDigits: 2,
              }),
            })}
          </Text>
        )}
      </View>

      {/* Name picker (only reachable with 2+ authorized names). */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(15, 20, 25, 0.45)' }}
          onPress={() => setPickerOpen(false)}
        >
          <View
            style={{
              marginTop: 'auto',
              backgroundColor: xColors.bg,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              paddingVertical: 10,
              paddingBottom: 26,
            }}
          >
            {senderOptions.map((n) => (
              <Pressable
                key={n.tokenId}
                onPress={() => {
                  onPickSender(n.tokenId);
                  setPickerOpen(false);
                }}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                  },
                  pressed && { backgroundColor: '#f7f9f9' },
                ]}
                accessibilityRole="button"
              >
                <SenderAvatar name={n} imageSvg={n.imageSvg} address={wallet.address} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: xColors.text }} numberOfLines={1}>
                    {n.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: xColors.sub }} numberOfLines={1}>
                    @{n.name} · #{n.tokenId}
                  </Text>
                </View>
                {n.tokenId === senderId && (
                  <View
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                      backgroundColor: xColors.accent,
                    }}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
