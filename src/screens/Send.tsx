import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ethers } from 'ethers';

import { xColors } from '../theme';
// X-style local styles for the v0.2.2 reskin of the tool screens: same
// tokens and shapes as the social surfaces (Home / Compose /
// Notifications) — white background, #EFF3F4-bordered cards, accent
// pill buttons, #CFD9DE-outlined secondary pills and inputs.
const xs = StyleSheet.create({
  root: { flex: 1, backgroundColor: xColors.bg },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: xColors.border,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  h1: { fontSize: 22, fontWeight: '800', color: xColors.text },
  title: { fontSize: 16, fontWeight: '700', color: xColors.text },
  body: { fontSize: 14, color: xColors.text, lineHeight: 20 },
  sub: { fontSize: 13, color: xColors.sub, lineHeight: 18 },
  input: {
    backgroundColor: '#ffffff',
    borderColor: xColors.divider,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: xColors.text,
  },
  button: {
    backgroundColor: xColors.accent,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  ghostButton: {
    borderColor: xColors.divider,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  ghostText: { color: xColors.text, fontSize: 15, fontWeight: '600' },
  dangerText: { color: xColors.danger, fontSize: 14, fontWeight: '600' },
});

import { STRINGS, type Lang } from '../i18n';
import type { NetworkPreset } from '../config';
import { fetchOwnedNames, getBalances, type OwnedName } from '../lib/mint';
import {
  estimateNameFee,
  estimateSendFee,
  explorerTxUrl,
  sendAsset,
  sendName,
  type SendAsset,
} from '../lib/send';

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet;
  preset: NetworkPreset;
}

type Stage = 'input' | 'confirm' | 'sending' | 'done';

export default function Send({ lang, wallet, preset }: Props) {
  const t = STRINGS[lang];
  const hasCaw = !!preset.cawTokenL1;
  const [asset, setAsset] = useState<SendAsset>('ETH');
  const [balances, setBalances] = useState<{ eth: bigint; caw: bigint | null } | null>(null);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [stage, setStage] = useState<Stage>('input');
  const [fee, setFee] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState('');
  const [names, setNames] = useState<OwnedName[] | null>(null);
  const [selName, setSelName] = useState<OwnedName | null>(null);

  useEffect(() => {
    if (asset === 'NAME' && names === null) {
      fetchOwnedNames(wallet, preset)
        .then(setNames)
        .catch(() => setNames([]));
    }
  }, [asset, names, wallet, preset]);

  const refreshBalances = React.useCallback(() => {
    getBalances(wallet, preset)
      .then(setBalances)
      .catch(() => setBalances(null));
  }, [wallet, preset]);

  useEffect(() => refreshBalances(), [refreshBalances]);

  const balance = asset === 'ETH' ? balances?.eth : balances?.caw;
  const balanceText =
    balance == null
      ? '…'
      : asset === 'ETH'
        ? `${Number(ethers.formatEther(balance)).toFixed(5)} ETH`
        : `${Number(ethers.formatUnits(balance, 18)).toLocaleString('ja-JP', { maximumFractionDigits: 0 })} CAW`;

  const parseAmount = (): bigint | null => {
    try {
      const v = asset === 'ETH' ? ethers.parseEther(amount.trim()) : ethers.parseUnits(amount.trim(), 18);
      return v > 0n ? v : null;
    } catch {
      return null;
    }
  };

  const review = async () => {
    setError(null);
    const dest = to.trim();
    if (!ethers.isAddress(dest)) {
      setError(t.sendInvalidAddress);
      return;
    }
    if (asset === 'NAME') {
      if (!selName) {
        setError(t.sendPickName);
        return;
      }
      try {
        setFee(await estimateNameFee(wallet, preset, dest, BigInt(selName.tokenId)));
      } catch {
        setFee(null);
      }
      setStage('confirm');
      return;
    }
    const value = parseAmount();
    if (value == null) {
      setError(t.sendInvalidAmount);
      return;
    }
    if (balance != null && value > balance) {
      setError(t.sendTooMuch);
      return;
    }
    try {
      setFee(await estimateSendFee(wallet, preset, asset, dest, value));
    } catch {
      setFee(null);
    }
    setStage('confirm');
  };

  const doSend = async () => {
    if (asset === 'NAME') {
      if (!selName) return;
      setStage('sending');
      setError(null);
      try {
        const hash = await sendName(wallet, preset, to.trim(), BigInt(selName.tokenId));
        setTxHash(hash);
        setStage('done');
      } catch (e) {
        setStage('confirm');
        setError(e instanceof Error ? e.message : String(e));
        Alert.alert(t.sendFailed, e instanceof Error ? e.message : String(e));
      }
      return;
    }
    const value = parseAmount();
    if (value == null) return;
    setStage('sending');
    setError(null);
    try {
      const hash = await sendAsset(wallet, preset, asset, to.trim(), value);
      setTxHash(hash);
      setStage('done');
      refreshBalances();
    } catch (e) {
      setStage('confirm');
      setError(e instanceof Error ? e.message : String(e));
      Alert.alert(t.sendFailed, e instanceof Error ? e.message : String(e));
    }
  };

  const reset = () => {
    setTo('');
    setAmount('');
    setFee(null);
    setError(null);
    setTxHash('');
    setSelName(null);
    setNames(null);
    setStage('input');
  };

  const sentWhat =
    asset === 'NAME' && selName ? `@${selName.name} (#${selName.tokenId})` : `${amount} ${asset}`;

  if (stage === 'done') {
    return (
      <ScrollView style={xs.root} contentContainerStyle={xs.content}>
        <View style={xs.card}>
          <Text style={xs.title}>{t.sendDoneTitle}</Text>
          <Text style={xs.body}>
            {sentWhat} → {to.trim()}
          </Text>
          <Text style={xs.sub}>{t.sendTxLabel}</Text>
          <Text selectable style={xs.body}>
            {txHash}
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(explorerTxUrl(preset, txHash))}>
            <Text style={{ color: xColors.accent, fontSize: 14 }}>{t.sendViewExplorer}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={xs.button} onPress={reset}>
            <Text style={xs.buttonText}>{t.sendAnotherBtn}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (stage === 'confirm' || stage === 'sending') {
    return (
      <ScrollView style={xs.root} contentContainerStyle={xs.content}>
        <View style={xs.card}>
          <Text style={xs.title}>{t.sendConfirmTitle}</Text>
          <Text style={xs.body}>{sentWhat}</Text>
          {asset === 'NAME' && <Text style={xs.sub}>{t.sendNameDepositNote}</Text>}
          <Text style={xs.sub}>{t.sendToLabel}</Text>
          <Text selectable style={xs.body}>
            {to.trim()}
          </Text>
          <Text style={xs.sub}>
            {t.sendFeeLabel}：{fee != null ? `~${Number(ethers.formatEther(fee)).toFixed(6)} ETH` : '…'}
          </Text>
          <Text style={[xs.sub, { color: xColors.danger }]}>{t.sendIrreversible}</Text>
          {error && <Text style={[xs.body, { color: xColors.danger }]}>{error}</Text>}
          <TouchableOpacity style={xs.button} onPress={doSend} disabled={stage === 'sending'}>
            <Text style={xs.buttonText}>{stage === 'sending' ? t.nodeStatusChecking : t.sendDoBtn}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={xs.ghostButton} onPress={() => setStage('input')} disabled={stage === 'sending'}>
            <Text style={xs.ghostText}>{t.sendBackBtn}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={xs.root} contentContainerStyle={xs.content}>
      <View style={xs.card}>
        <Text style={xs.title}>{t.sendTitle}</Text>
        <Text style={xs.sub}>{t.sendAsset}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['ETH', ...(hasCaw ? ['CAW'] : []), 'NAME'] as SendAsset[]).map((a) => (
            <TouchableOpacity
              key={a}
              style={a === asset ? xs.button : xs.ghostButton}
              onPress={() => setAsset(a)}
            >
              <Text style={a === asset ? xs.buttonText : xs.ghostText}>
                {a === 'NAME' ? t.sendAssetName : a}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={{ flex: 1 }} />
          {asset !== 'NAME' && (
            <Text style={[xs.sub, { alignSelf: 'center' }]}>
              {t.sendBalance}：{balanceText}
            </Text>
          )}
        </View>
        <Text style={xs.sub}>{t.sendToLabel}</Text>
        <TextInput
          style={xs.input}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="0x…"
          value={to}
          onChangeText={setTo}
        />
        <TouchableOpacity
          onPress={async () => {
            const s = await Clipboard.getStringAsync();
            if (s) setTo(s.trim());
          }}
        >
          <Text style={{ color: xColors.accent, fontSize: 13 }}>{t.nodePasteBtn}</Text>
        </TouchableOpacity>
        {asset === 'NAME' ? (
          <>
            <Text style={xs.sub}>{t.sendNameLabel}</Text>
            {names === null ? (
              <Text style={xs.sub}>…</Text>
            ) : names.length === 0 ? (
              <Text style={xs.sub}>{t.sendNoNames}</Text>
            ) : (
              names.map((n) => (
                <TouchableOpacity
                  key={n.tokenId}
                  style={selName?.tokenId === n.tokenId ? xs.button : xs.ghostButton}
                  onPress={() => setSelName(n)}
                >
                  <Text style={selName?.tokenId === n.tokenId ? xs.buttonText : xs.ghostText}>
                    @{n.name} (#{n.tokenId})
                    {n.depositCaw != null
                      ? ` · ${Number(ethers.formatUnits(n.depositCaw, 18)).toLocaleString('ja-JP', { maximumFractionDigits: 0 })} CAW`
                      : ''}
                  </Text>
                </TouchableOpacity>
              ))
            )}
            <Text style={xs.sub}>{t.sendNameDepositNote}</Text>
          </>
        ) : (
          <>
            <Text style={xs.sub}>{t.sendAmountLabel}</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                style={[xs.input, { flex: 1 }]}
                keyboardType="decimal-pad"
                placeholder="0.0"
                value={amount}
                onChangeText={setAmount}
              />
              <TouchableOpacity
                style={xs.ghostButton}
                onPress={() => {
                  if (balance == null) return;
                  setAmount(asset === 'ETH' ? ethers.formatEther(balance) : ethers.formatUnits(balance, 18));
                }}
              >
                <Text style={xs.ghostText}>{t.sendMax}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        {error && <Text style={[xs.body, { color: xColors.danger }]}>{error}</Text>}
        <TouchableOpacity style={xs.button} onPress={review}>
          <Text style={xs.buttonText}>{t.sendReviewBtn}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
