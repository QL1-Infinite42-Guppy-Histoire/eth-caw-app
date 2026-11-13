import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ethers } from 'ethers';
import { SvgXml } from 'react-native-svg';

import { xColors } from '../theme';
import { getBalances, type OwnedName } from '../lib/mint';
import type { NetworkPreset } from '../config';
import { STRINGS, type Lang } from '../i18n';
import { BackIcon, SendIcon, UserPlusIcon } from '../components/icons';
import UserAvatar from '../components/UserAvatar';

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet;
  preset: NetworkPreset;
  names: OwnedName[];
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenSend: () => void;
  onOpenMint: () => void;
}

const MONO = 'monospace';

/** Compact display figure (QL1's card rule): big balances abbreviated
 *  "x.xxM" / "x.xxB" (truncated, never rounded up), the rest grouped
 *  with up to 2 decimals. Display only — the exact figure is one tap
 *  away in the list and is the ethers formatUnits string itself. */
function fmtDisplay(raw: bigint, decimals: number): string {
  const v = Number(ethers.formatUnits(raw, decimals));
  if (!Number.isFinite(v)) return ethers.formatUnits(raw, decimals);
  const trim = (x: number) => {
    const s = (Math.floor(x * 100) / 100).toFixed(2);
    return s.replace(/\.?0+$/, '');
  };
  if (Math.abs(v) >= 1_000_000_000) return `${trim(v / 1_000_000_000)}B`;
  if (Math.abs(v) >= 1_000_000) return `${trim(v / 1_000_000)}M`;
  return v.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
}

interface AssetRow {
  label: string;
  unit: string;
  raw: bigint | null;
  decimals: number;
}

/** The balances as a vertical asset list (QL1 v0.6.2 BalanceList
 *  metrics): bordered box, hairline rows, amount right; a null raw
 *  keeps the honest dash — unread is never shown as 0. Tapping a row
 *  swaps its amount for the exact full figure. No prices, no fiat
 *  totals: the app has no price source it trusts. */
function AssetList({ rows, hint }: { rows: AssetRow[]; hint: string }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View>
      <View style={listStyles.list}>
        {rows.map((row, idx) => {
          const shown =
            row.raw === null
              ? null
              : open === idx
                ? ethers.formatUnits(row.raw, row.decimals)
                : fmtDisplay(row.raw, row.decimals);
          return (
            <Pressable
              key={idx}
              style={({ pressed }) => [
                listStyles.row,
                idx === rows.length - 1 && listStyles.rowLast,
                pressed && { backgroundColor: '#f7f9f9' },
              ]}
              onPress={() => row.raw !== null && setOpen((o) => (o === idx ? null : idx))}
              accessibilityRole="button"
            >
              <Text style={listStyles.label} numberOfLines={1}>
                {row.label}
              </Text>
              <Text style={listStyles.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
                {shown === null ? '—' : shown}
                {shown === null ? null : <Text style={listStyles.unit}> {row.unit}</Text>}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={listStyles.hint}>{hint}</Text>
    </View>
  );
}

const listStyles = StyleSheet.create({
  list: {
    borderWidth: 1,
    borderColor: '#d9dee2',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: xColors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  label: { fontSize: 15, color: xColors.text, flexShrink: 1 },
  amount: { fontSize: 17, color: xColors.text, fontWeight: '600' },
  unit: { fontSize: 11.5, color: xColors.sub, fontWeight: '400' },
  hint: { fontSize: 12, color: xColors.sub, marginTop: 8 },
});

/**
 * The wallet screen (v0.4.0), rebuilt in the QL1 app's MetaMask-style
 * layout (its v0.6.2 wallet screen):
 *  1. PROFILE SECTION — the primary name's avatar, display name,
 *     "@handle · #id" and the copyable address chip. The whole
 *     section is tappable and opens the user's OWN profile page.
 *     No name yet: the honest prompt + the Get-a-name entry.
 *  2. ACTION BUTTONS — Send and Get-a-name, the primary (X-blue)
 *     treatment. QL1's second button is Deposit; on Ethereum a
 *     deposit exists only inside the mint flow (there is no
 *     top-up deposit for an existing name), so the slot carries
 *     the mint entrance instead of a dead Deposit button.
 *  3. ASSET LIST — the balances the app already reads, in a fixed
 *     order: ETH (L1) / CAW (L1) / each name's in-name CAW deposit.
 *     No new chain reads were added for this screen.
 */
export default function WalletBalances({
  lang,
  wallet,
  preset,
  names,
  onClose,
  onOpenProfile,
  onOpenSend,
  onOpenMint,
}: Props) {
  const t = STRINGS[lang];
  const [balances, setBalances] = useState<{ eth: bigint; caw: bigint | null } | null>(null);
  const [addrCopied, setAddrCopied] = useState(false);

  useEffect(() => {
    let live = true;
    getBalances(wallet, preset)
      .then((b) => live && setBalances(b))
      .catch(() => live && setBalances(null));
    return () => {
      live = false;
    };
  }, [wallet, preset, names]);

  const primary = names[0] ?? null;
  const chipAddress = `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`;
  const copyAddr = useCallback(async () => {
    await Clipboard.setStringAsync(wallet.address);
    setAddrCopied(true);
    setTimeout(() => setAddrCopied(false), 2000);
  }, [wallet.address]);

  const rows: AssetRow[] = [
    { label: 'Ethereum', unit: 'ETH', raw: balances ? balances.eth : null, decimals: 18 },
    { label: 'CAW', unit: 'CAW', raw: balances ? balances.caw : null, decimals: 18 },
    ...names.map((n) => ({
      label: `@${n.name}`,
      unit: 'CAW',
      raw: n.depositCaw,
      decimals: 18,
    })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: xColors.bg }}>
      <View style={styles.backRow}>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <BackIcon size={20} color={xColors.accent} />
        </TouchableOpacity>
        <Text style={styles.backTitle}>{t.walletTitle}</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28 }}>
        {/* (1) Profile section — tap for the own profile. */}
        {primary ? (
          <Pressable
            onPress={onOpenProfile}
            style={({ pressed }) => [pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <View style={styles.summaryRow}>
              {primary.imageSvg ? (
                <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden' }}>
                  <SvgXml xml={primary.imageSvg} width={48} height={48} />
                </View>
              ) : (
                <UserAvatar label={primary.name} seed={primary.name} size={48} />
              )}
              <View style={{ flex: 1, marginStart: 12 }}>
                <Text style={styles.summaryName} numberOfLines={1}>
                  {primary.name}
                </Text>
                <Text style={styles.small} numberOfLines={1}>
                  @{primary.name} · #{primary.tokenId}
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.chip, pressed && { backgroundColor: '#e3e8ea' }]}
                onPress={copyAddr}
                accessibilityLabel={t.copyAddress}
              >
                <Text style={styles.chipText}>{addrCopied ? t.nodeCopied : chipAddress}</Text>
              </Pressable>
            </View>
          </Pressable>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Text style={{ fontSize: 15, color: xColors.text, lineHeight: 22 }}>{t.noNamesYet}</Text>
            <Pressable style={[styles.bigBtn, { marginTop: 12 }]} onPress={onOpenMint}>
              <Text style={styles.bigBtnText}>{t.tabMint}</Text>
            </Pressable>
          </View>
        )}

        {/* (2) Actions — Send / Get a name. */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
            onPress={onOpenSend}
            accessibilityRole="button"
          >
            <SendIcon size={19} color="#fff" />
            <Text style={styles.actionBtnText} numberOfLines={1}>
              {t.sendTitle}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
            onPress={onOpenMint}
            accessibilityRole="button"
          >
            <UserPlusIcon size={19} color="#fff" />
            <Text style={styles.actionBtnText} numberOfLines={1}>
              {t.tabMint}
            </Text>
          </Pressable>
        </View>

        {/* (3) Asset list. */}
        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <AssetList rows={rows} hint={t.tapHint} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: xColors.border,
    backgroundColor: xColors.bg,
  },
  backTitle: { fontSize: 16, fontWeight: '800', color: xColors.text },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  summaryName: { fontSize: 17, fontWeight: '800', color: xColors.text },
  small: { fontSize: 13, color: xColors.sub, lineHeight: 19 },
  chip: {
    backgroundColor: '#eff3f4',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginStart: 10,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: xColors.text,
    fontFamily: MONO,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: xColors.accent,
    borderRadius: 999,
    paddingVertical: 12,
  },
  actionBtnText: { fontSize: 15.5, fontWeight: '700', color: '#fff' },
  bigBtn: {
    backgroundColor: xColors.accent,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    alignSelf: 'flex-start',
  },
  bigBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
