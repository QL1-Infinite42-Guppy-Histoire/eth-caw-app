import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ethers } from 'ethers';

import { colors, styles } from '../theme';
import type { NetworkPreset } from '../config';
import { STRINGS, type Lang } from '../i18n';
import { getBalances } from '../lib/mint';
import {
  executeSwap,
  minOutWithSlippage,
  quoteSwap,
  type SwapDirection,
} from '../lib/swap';

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet;
  preset: NetworkPreset;
}

type Phase = 'input' | 'review' | 'approving' | 'swapping' | 'confirming' | 'done' | 'error';

const GAS_RESERVE = ethers.parseEther('0.002');
const SLIPPAGES = [0.5, 1, 3];

function fmtCaw(v: bigint): string {
  return Number(ethers.formatUnits(v, 18)).toLocaleString('ja-JP', {
    maximumFractionDigits: 0,
  });
}
function fmtEth(v: bigint, dp = 6): string {
  return Number(ethers.formatEther(v)).toFixed(dp);
}

export default function Swap({ lang, wallet, preset }: Props) {
  const t = STRINGS[lang];
  const [dir, setDir] = useState<SwapDirection>('ethToCaw');
  const [amountText, setAmountText] = useState('');
  const [quoted, setQuoted] = useState<bigint | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [slippage, setSlippage] = useState(1);
  const [balances, setBalances] = useState<{ eth: bigint; caw: bigint | null } | null>(null);
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const payIsEth = dir === 'ethToCaw';
  const paySymbol = payIsEth ? 'ETH' : 'CAW';
  const receiveSymbol = payIsEth ? 'CAW' : 'ETH';
  const payBalance = balances ? (payIsEth ? balances.eth : (balances.caw ?? 0n)) : null;

  const refreshBalances = useCallback(async () => {
    try {
      setBalances(await getBalances(wallet, preset));
    } catch {
      setBalances(null);
    }
  }, [wallet, preset]);

  useEffect(() => {
    void refreshBalances();
  }, [refreshBalances]);

  let amountIn = 0n;
  try {
    if (amountText.trim()) {
      amountIn = payIsEth
        ? ethers.parseEther(amountText.trim())
        : ethers.parseUnits(amountText.trim(), 18);
    }
  } catch {
    amountIn = 0n;
  }

  // Debounced quote for the receive side.
  useEffect(() => {
    setQuoted(null);
    if (amountIn <= 0n) {
      setQuoting(false);
      return;
    }
    setQuoting(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setQuoted(await quoteSwap(preset, dir, amountIn));
      } catch {
        setQuoted(null);
      } finally {
        setQuoting(false);
      }
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [amountText, dir, preset, amountIn]);

  const insufficient = (() => {
    if (!balances || amountIn <= 0n) return false;
    if (payIsEth) return amountIn + GAS_RESERVE > balances.eth;
    return amountIn > (balances.caw ?? 0n) || balances.eth < ethers.parseEther('0.0005');
  })();

  const minOut = quoted != null ? minOutWithSlippage(quoted, slippage) : null;
  const busy = phase === 'approving' || phase === 'swapping' || phase === 'confirming';

  const setMax = () => {
    if (!balances) return;
    if (payIsEth) {
      const max = balances.eth > GAS_RESERVE ? balances.eth - GAS_RESERVE : 0n;
      setAmountText(ethers.formatEther(max));
    } else {
      setAmountText(ethers.formatUnits(balances.caw ?? 0n, 18));
    }
  };

  const flip = () => {
    setDir(payIsEth ? 'cawToEth' : 'ethToCaw');
    setAmountText('');
    setPhase('input');
    setError(null);
  };

  const doSwap = async () => {
    if (quoted == null || minOut == null) return;
    setError(null);
    try {
      // Re-quote right before executing so the minimum tracks the live rate.
      const fresh = await quoteSwap(preset, dir, amountIn);
      const freshMin = minOutWithSlippage(fresh, slippage);
      await executeSwap(wallet, preset, dir, amountIn, freshMin, (step) => setPhase(step));
      setPhase('done');
      setAmountText('');
      await refreshBalances();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  if (phase === 'done') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <Text style={{ fontSize: 40 }}>✅</Text>
          <Text style={styles.title}>{t.swapDone}</Text>
          <Text style={styles.sub}>
            {t.balanceLabel}：{balances ? `${fmtEth(balances.eth)} ETH` : '…'}
            {balances?.caw != null ? ` / ${fmtCaw(balances.caw)} CAW` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={() => setPhase('input')}>
          <Text style={styles.buttonText}>{t.swapExecute}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (phase === 'review' || busy || phase === 'error') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.swapReview}</Text>
          <Text style={styles.body}>
            {t.swapPay}：{payIsEth ? `${fmtEth(amountIn)} ETH` : `${fmtCaw(amountIn)} CAW`}
          </Text>
          <Text style={styles.body}>
            {t.swapReceive}：
            {quoted != null
              ? payIsEth
                ? `${fmtCaw(quoted)} CAW`
                : `${fmtEth(quoted, 8)} ETH`
              : '…'}
          </Text>
          <Text style={styles.sub}>
            {t.swapMinReceive}：
            {minOut != null
              ? payIsEth
                ? `${fmtCaw(minOut)} CAW`
                : `${fmtEth(minOut, 8)} ETH`
              : '…'}{' '}
            （{t.swapSlippage} {slippage}%）
          </Text>
          <Text style={styles.sub}>{t.swapConfirmNote}</Text>
          {error && <Text style={[styles.sub, { color: colors.danger }]}>{error}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.button, { opacity: busy ? 0.5 : 1 }]}
          disabled={busy}
          onPress={doSwap}
        >
          <Text style={styles.buttonText}>
            {phase === 'approving'
              ? t.stepApproving
              : phase === 'swapping'
                ? t.stepSwapping
                : phase === 'confirming'
                  ? t.stepConfirming
                  : t.swapExecute}
          </Text>
        </TouchableOpacity>
        {!busy && (
          <TouchableOpacity onPress={() => setPhase('input')} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={styles.sub}>{t.swapBack}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sub}>
          {t.swapPay}（{paySymbol}）
          {payBalance != null
            ? ` ・ ${t.balanceLabel} ${payIsEth ? fmtEth(payBalance) : fmtCaw(payBalance)}`
            : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1, fontSize: 20 }]}
            keyboardType="decimal-pad"
            placeholder="0.0"
            value={amountText}
            onChangeText={setAmountText}
          />
          <TouchableOpacity style={styles.ghostButton} onPress={setMax}>
            <Text style={styles.ghostText}>{t.swapMax}</Text>
          </TouchableOpacity>
        </View>
        {payIsEth && <Text style={styles.sub}>{t.swapKeepGas}</Text>}
      </View>

      <TouchableOpacity onPress={flip} style={{ alignItems: 'center', marginVertical: -2 }}>
        <Text style={{ fontSize: 22, color: colors.accent }}>⇅</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.sub}>{t.swapReceive}（{receiveSymbol}）</Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink }}>
          {amountIn <= 0n
            ? '0'
            : quoting
              ? t.swapQuoting
              : quoted != null
                ? payIsEth
                  ? fmtCaw(quoted)
                  : fmtEth(quoted, 8)
                : '—'}
        </Text>
        {quoted != null && amountIn > 0n && (
          <Text style={styles.sub}>
            {t.swapRate}：1 ETH ={' '}
            {payIsEth
              ? fmtCaw((quoted * 10n ** 18n) / amountIn)
              : fmtCaw((amountIn * 10n ** 18n) / quoted)}{' '}
            CAW
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sub}>{t.swapSlippage}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SLIPPAGES.map((v) => (
            <TouchableOpacity
              key={v}
              style={v === slippage ? styles.button : styles.ghostButton}
              onPress={() => setSlippage(v)}
            >
              <Text style={v === slippage ? styles.buttonText : styles.ghostText}>{v}%</Text>
            </TouchableOpacity>
          ))}
        </View>
        {insufficient && (
          <Text style={[styles.sub, { color: colors.danger }]}>{t.swapInsufficient}</Text>
        )}
        {amountIn <= 0n && <Text style={styles.sub}>{t.swapEnterAmount}</Text>}
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          { opacity: amountIn > 0n && quoted != null && !insufficient ? 1 : 0.45 },
        ]}
        disabled={!(amountIn > 0n && quoted != null && !insufficient)}
        onPress={() => setPhase('review')}
      >
        <Text style={styles.buttonText}>{t.swapReview}</Text>
      </TouchableOpacity>
      <Text style={styles.sub}>{t.swapRoute}</Text>
    </ScrollView>
  );
}
