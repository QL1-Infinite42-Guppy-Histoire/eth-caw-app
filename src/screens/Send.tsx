import React, { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ethers } from 'ethers';

import { colors, styles } from '../theme';
import { STRINGS, type Lang } from '../i18n';
import type { NetworkPreset } from '../config';
import { getBalances } from '../lib/mint';
import { estimateSendFee, explorerTxUrl, sendAsset, type SendAsset } from '../lib/send';

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
    setStage('input');
  };

  if (stage === 'done') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.sendDoneTitle}</Text>
          <Text style={styles.body}>
            {amount} {asset} → {to.trim()}
          </Text>
          <Text style={styles.sub}>{t.sendTxLabel}</Text>
          <Text selectable style={styles.body}>
            {txHash}
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(explorerTxUrl(preset, txHash))}>
            <Text style={{ color: colors.accent, fontSize: 14 }}>{t.sendViewExplorer}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={reset}>
            <Text style={styles.buttonText}>{t.sendAnotherBtn}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (stage === 'confirm' || stage === 'sending') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.sendConfirmTitle}</Text>
          <Text style={styles.body}>
            {amount} {asset}
          </Text>
          <Text style={styles.sub}>{t.sendToLabel}</Text>
          <Text selectable style={styles.body}>
            {to.trim()}
          </Text>
          <Text style={styles.sub}>
            {t.sendFeeLabel}：{fee != null ? `~${Number(ethers.formatEther(fee)).toFixed(6)} ETH` : '…'}
          </Text>
          <Text style={[styles.sub, { color: colors.danger }]}>{t.sendIrreversible}</Text>
          {error && <Text style={[styles.body, { color: colors.danger }]}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={doSend} disabled={stage === 'sending'}>
            <Text style={styles.buttonText}>{stage === 'sending' ? t.nodeStatusChecking : t.sendDoBtn}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => setStage('input')} disabled={stage === 'sending'}>
            <Text style={styles.ghostText}>{t.sendBackBtn}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>{t.sendTitle}</Text>
        <Text style={styles.sub}>{t.sendAsset}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['ETH', ...(hasCaw ? ['CAW'] : [])] as SendAsset[]).map((a) => (
            <TouchableOpacity
              key={a}
              style={a === asset ? styles.button : styles.ghostButton}
              onPress={() => setAsset(a)}
            >
              <Text style={a === asset ? styles.buttonText : styles.ghostText}>{a}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ flex: 1 }} />
          <Text style={[styles.sub, { alignSelf: 'center' }]}>
            {t.sendBalance}：{balanceText}
          </Text>
        </View>
        <Text style={styles.sub}>{t.sendToLabel}</Text>
        <TextInput
          style={styles.input}
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
          <Text style={{ color: colors.accent, fontSize: 13 }}>{t.nodePasteBtn}</Text>
        </TouchableOpacity>
        <Text style={styles.sub}>{t.sendAmountLabel}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="decimal-pad"
            placeholder="0.0"
            value={amount}
            onChangeText={setAmount}
          />
          <TouchableOpacity
            style={styles.ghostButton}
            onPress={() => {
              if (balance == null) return;
              setAmount(asset === 'ETH' ? ethers.formatEther(balance) : ethers.formatUnits(balance, 18));
            }}
          >
            <Text style={styles.ghostText}>{t.sendMax}</Text>
          </TouchableOpacity>
        </View>
        {error && <Text style={[styles.body, { color: colors.danger }]}>{error}</Text>}
        <TouchableOpacity style={styles.button} onPress={review}>
          <Text style={styles.buttonText}>{t.sendReviewBtn}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
