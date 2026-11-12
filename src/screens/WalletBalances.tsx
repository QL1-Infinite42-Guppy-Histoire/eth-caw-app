import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ethers } from 'ethers';

import { xColors } from '../theme';
import { getBalances, type OwnedName } from '../lib/mint';
import type { NetworkPreset } from '../config';
import { STRINGS, type Lang } from '../i18n';
import NameCard from '../components/NameCard';
import { BackIcon } from '../components/icons';

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet;
  preset: NetworkPreset;
  names: OwnedName[];
  onClose: () => void;
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

/**
 * Wallet balances screen (reached from the Profile tab menu). This is
 * the balances view that lived inside Home's profile area before
 * v0.3.0, extracted unchanged: wallet CAW/ETH balances from the same
 * getBalances read, the wallet address, and each name's deposit.
 */
export default function WalletBalances({ lang, wallet, preset, names, onClose }: Props) {
  const t = STRINGS[lang];
  const [balances, setBalances] = useState<{ eth: bigint; caw: bigint | null } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    getBalances(wallet, preset)
      .then((b) => live && setBalances(b))
      .catch(() => live && setBalances(null))
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [wallet, preset, names]);

  return (
    <View style={{ flex: 1, backgroundColor: xColors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: xColors.border,
        }}
      >
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <BackIcon size={21} color={xColors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '800', color: xColors.text }}>{t.walletTitle}</Text>
      </View>
      <ScrollView>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={xCard}>
            <Text style={xSub}>{t.balanceLabel}</Text>
            {!loaded ? (
              <ActivityIndicator color={xColors.accent} style={{ alignSelf: 'flex-start' }} />
            ) : (
              <>
                <Text style={{ fontSize: 22, fontWeight: '800', color: xColors.text }}>
                  {balances
                    ? balances.caw != null
                      ? `${Number(ethers.formatUnits(balances.caw, 18)).toLocaleString('ja-JP', { maximumFractionDigits: 0 })} CAW`
                      : `${Number(ethers.formatEther(balances.eth)).toFixed(5)} ETH`
                    : '—'}
                </Text>
                {balances && balances.caw != null && (
                  <Text style={xSub}>{Number(ethers.formatEther(balances.eth)).toFixed(5)} ETH</Text>
                )}
              </>
            )}
          </View>
          <View style={xCard}>
            <Text style={xSub}>{t.walletAddress}</Text>
            <Text style={{ fontSize: 13, color: xColors.text }} numberOfLines={1} ellipsizeMode="middle">
              {wallet.address}
            </Text>
          </View>
          <View style={xCard}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: xColors.text }}>{t.myNames}</Text>
            {names.length === 0 ? (
              <Text style={xSub}>{t.noNamesYet}</Text>
            ) : (
              names.map((n) => <NameCard key={n.tokenId} name={n} lang={lang} />)
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
