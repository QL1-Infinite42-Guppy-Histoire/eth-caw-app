import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ethers } from 'ethers';

import { xColors } from '../theme';
import { STRINGS, type Lang } from '../i18n';
import type { OwnedName } from '../lib/mint';

// X-style local styles (v0.2.2): flat row separated by a 1px #EFF3F4
// divider, matching the tool screens and Home's profile card.
const xs = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: xColors.border,
  },
  fallbackAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: xColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackLetter: { color: '#fff', fontWeight: '800', fontSize: 18 },
  name: { fontSize: 15, fontWeight: '600', color: xColors.text, lineHeight: 20 },
  tokenId: { color: xColors.sub, fontWeight: '400' },
  deposit: { fontSize: 13, color: xColors.sub, lineHeight: 18 },
});

// One owned CAW name: NFT artwork (inline SVG from the token metadata),
// @name, token number, and the CAW deposited under that name on Base.
export default function NameCard({ name, lang }: { name: OwnedName; lang: Lang }) {
  const t = STRINGS[lang];
  return (
    <View style={xs.row}>
      {name.imageSvg ? (
        <SvgXml xml={name.imageSvg} width={48} height={48} />
      ) : (
        <View style={xs.fallbackAvatar}>
          <Text style={xs.fallbackLetter}>
            {name.name.replace(/^#/, '').charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={xs.name}>
          @{name.name}
          <Text style={xs.tokenId}> #{name.tokenId}</Text>
        </Text>
        {name.depositCaw != null && (
          <Text style={xs.deposit}>
            {t.depositShort}：
            {Number(ethers.formatUnits(name.depositCaw, 18)).toLocaleString('ja-JP', {
              maximumFractionDigits: 0,
            })}{' '}
            CAW
          </Text>
        )}
      </View>
    </View>
  );
}
