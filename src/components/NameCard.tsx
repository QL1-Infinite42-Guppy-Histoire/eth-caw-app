import React from 'react';
import { Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ethers } from 'ethers';

import { colors, styles } from '../theme';
import { STRINGS, type Lang } from '../i18n';
import type { OwnedName } from '../lib/mint';

// One owned CAW name: NFT artwork (inline SVG from the token metadata),
// @name, token number, and the CAW deposited under that name on Base.
export default function NameCard({ name, lang }: { name: OwnedName; lang: Lang }) {
  const t = STRINGS[lang];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
      }}
    >
      {name.imageSvg ? (
        <SvgXml xml={name.imageSvg} width={48} height={48} />
      ) : (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>
            {name.name.replace(/^#/, '').charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.body}>
          @{name.name}
          <Text style={{ color: colors.faint }}> #{name.tokenId}</Text>
        </Text>
        {name.depositCaw != null && (
          <Text style={styles.sub}>
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
