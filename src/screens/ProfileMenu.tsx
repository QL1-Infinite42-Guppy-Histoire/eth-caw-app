import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ethers } from 'ethers';
import { SvgXml } from 'react-native-svg';

import { xColors } from '../theme';
import type { Session } from '../lib/api';
import { getBalances, type OwnedName } from '../lib/mint';
import type { NetworkPreset } from '../config';
import { STRINGS, type Lang } from '../i18n';
import NameCard from '../components/NameCard';
import {
  BookmarkIcon,
  ChevronRightIcon,
  GearIcon,
  NameBadgeIcon,
  SendIcon,
  ServerIcon,
  SwapIcon,
  WalletIcon,
} from '../components/icons';

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet | null;
  preset: NetworkPreset;
  session: Session | null;
  names: OwnedName[];
  onOpenWallet: () => void;
  onOpenNames: () => void;
  onOpenSwap: () => void;
  onOpenSend: () => void;
  onOpenBookmarks: () => void;
  onOpenServer: () => void;
  onOpenSettings: () => void;
}

const xCard = {
  backgroundColor: xColors.bg,
  borderWidth: 1,
  borderColor: xColors.border,
  borderRadius: 16,
  padding: 16,
  gap: 6,
} as const;
const xSub = { fontSize: 12, color: xColors.sub, lineHeight: 17 } as const;
const xButton = {
  backgroundColor: xColors.accent,
  borderRadius: 999,
  paddingVertical: 10,
  alignItems: 'center',
  marginTop: 6,
} as const;
const xButtonText = { color: '#ffffff', fontSize: 15, fontWeight: '700' } as const;

/**
 * The Profile tab = the app's menu (per the finished design): identity
 * header, CAW deposit balance card, then icon rows into every tool
 * screen. When no node session exists yet, the pre-v0.3.0 Home content
 * (names card + server-search card) is shown below the menu so nothing
 * that was reachable before becomes unreachable.
 */
export default function ProfileMenu({
  lang,
  wallet,
  preset,
  session,
  names,
  onOpenWallet,
  onOpenNames,
  onOpenSwap,
  onOpenSend,
  onOpenBookmarks,
  onOpenServer,
  onOpenSettings,
}: Props) {
  const t = STRINGS[lang];
  const primary = names[0] ?? null;

  // Only needed for the no-session balance summary card below.
  const [balances, setBalances] = useState<{ eth: bigint; caw: bigint | null } | null>(null);
  useEffect(() => {
    if (!wallet || session) return;
    let live = true;
    getBalances(wallet, preset)
      .then((b) => live && setBalances(b))
      .catch(() => live && setBalances(null));
    return () => {
      live = false;
    };
  }, [wallet, preset, names, session]);

  const rows: { icon: React.ReactNode; label: string; onPress: () => void }[] = [
    { icon: <WalletIcon size={22} color={xColors.sub} />, label: t.menuWallet, onPress: onOpenWallet },
    { icon: <NameBadgeIcon size={22} color={xColors.sub} />, label: t.menuNames, onPress: onOpenNames },
    { icon: <SwapIcon size={22} color={xColors.sub} />, label: t.tabSwap, onPress: onOpenSwap },
    { icon: <SendIcon size={22} color={xColors.sub} />, label: t.tabSend, onPress: onOpenSend },
    { icon: <BookmarkIcon size={22} color={xColors.sub} />, label: t.bookmarksTitle, onPress: onOpenBookmarks },
    { icon: <ServerIcon size={22} color={xColors.sub} />, label: t.tabNode, onPress: onOpenServer },
    { icon: <GearIcon size={22} color={xColors.sub} />, label: t.tabSettings, onPress: onOpenSettings },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: xColors.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {primary?.imageSvg ? (
            <View style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden' }}>
              <SvgXml xml={primary.imageSvg} width={56} height={56} />
            </View>
          ) : primary ? (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: xColors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 22 }}>
                {primary.name.replace(/^#/, '').charAt(0).toUpperCase() || 'C'}
              </Text>
            </View>
          ) : (
            <Image source={require('../../assets/icon.png')} style={{ width: 56, height: 56, borderRadius: 28 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: xColors.text }} numberOfLines={1}>
              {primary ? primary.name : 'CAW'}
            </Text>
            <Text style={{ fontSize: 14, color: xColors.sub }} numberOfLines={1}>
              {primary ? `@${primary.name}` : session ? t.headerNoName : t.headerWaiting}
            </Text>
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 4,
                borderWidth: 1,
                borderColor: xColors.border,
                borderRadius: 999,
                paddingHorizontal: 7,
                paddingVertical: 2,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: session ? xColors.recaw : xColors.divider,
                }}
              />
              <Text style={{ fontSize: 10, color: session ? xColors.accent : xColors.sub }}>
                {session ? t.chipConnected : t.headerWaiting}
              </Text>
            </View>
          </View>
        </View>

        {primary?.depositCaw != null && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginTop: 16,
              borderWidth: 1,
              borderColor: xColors.border,
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Image source={require('../../assets/icon.png')} style={{ width: 40, height: 40, borderRadius: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: xColors.sub }}>{t.depositCardTitle}</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: xColors.text }}>
                {Number(ethers.formatUnits(primary.depositCaw, 18)).toLocaleString('ja-JP', {
                  maximumFractionDigits: 2,
                })}{' '}
                CAW
              </Text>
              <Text style={{ fontSize: 11, color: xColors.sub, marginTop: 1 }}>{t.depositCardNote}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={{ marginTop: 10 }}>
        {rows.map((row) => (
          <TouchableOpacity
            key={row.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingHorizontal: 16,
              paddingVertical: 11,
              borderBottomWidth: 1,
              borderBottomColor: xColors.border,
            }}
            onPress={row.onPress}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: '#eef3f4',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {row.icon}
            </View>
            <Text style={{ flex: 1, fontSize: 16, color: xColors.text }}>{row.label}</Text>
            <ChevronRightIcon size={19} color={xColors.sub} />
          </TouchableOpacity>
        ))}
      </View>

      {!session && (
        <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12, paddingBottom: 24 }}>
          <View style={xCard}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: xColors.text }}>{t.myNames}</Text>
            {names.length === 0 ? (
              <Text style={xSub}>{t.noNamesYet}</Text>
            ) : (
              names.map((n) => <NameCard key={n.tokenId} name={n} lang={lang} />)
            )}
            <TouchableOpacity style={xButton} onPress={onOpenNames}>
              <Text style={xButtonText}>{t.goMint}</Text>
            </TouchableOpacity>
          </View>
          <View style={xCard}>
            <Text style={xSub}>{t.balanceLabel}</Text>
            <Text style={{ fontSize: 19, fontWeight: '700', color: xColors.text }}>
              {balances
                ? balances.caw != null
                  ? `${Number(ethers.formatUnits(balances.caw, 18)).toLocaleString('ja-JP', { maximumFractionDigits: 0 })} CAW`
                  : `${Number(ethers.formatEther(balances.eth)).toFixed(5)} ETH`
                : '…'}
            </Text>
            {balances && balances.caw != null && (
              <Text style={xSub}>{Number(ethers.formatEther(balances.eth)).toFixed(5)} ETH</Text>
            )}
          </View>
          <View style={xCard}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: xColors.text }}>{t.timeline}</Text>
            <Text style={xSub}>{t.nodeSearching}</Text>
            <Text style={xSub}>{t.mintNoNodeNote}</Text>
            <TouchableOpacity style={xButton} onPress={onOpenServer}>
              <Text style={xButtonText}>{t.nodeHomeCta}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
