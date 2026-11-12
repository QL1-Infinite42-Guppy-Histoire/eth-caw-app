import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
      <ScrollView style={xs.root} contentContainerStyle={xs.content}>
        <View style={[xs.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <Text style={{ fontSize: 40 }}>✅</Text>
          <Text style={xs.title}>{t.swapDone}</Text>
          <Text style={xs.sub}>
            {t.balanceLabel}：{balances ? `${fmtEth(balances.eth)} ETH` : '…'}
            {balances?.caw != null ? ` / ${fmtCaw(balances.caw)} CAW` : ''}
          </Text>
        </View>
        <TouchableOpacity style={xs.button} onPress={() => setPhase('input')}>
          <Text style={xs.buttonText}>{t.swapExecute}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (phase === 'review' || busy || phase === 'error') {
    return (
      <ScrollView style={xs.root} contentContainerStyle={xs.content}>
        <View style={xs.card}>
          <Text style={xs.title}>{t.swapReview}</Text>
          <Text style={xs.body}>
            {t.swapPay}：{payIsEth ? `${fmtEth(amountIn)} ETH` : `${fmtCaw(amountIn)} CAW`}
          </Text>
          <Text style={xs.body}>
            {t.swapReceive}：
            {quoted != null
              ? payIsEth
                ? `${fmtCaw(quoted)} CAW`
                : `${fmtEth(quoted, 8)} ETH`
              : '…'}
          </Text>
          <Text style={xs.sub}>
            {t.swapMinReceive}：
            {minOut != null
              ? payIsEth
                ? `${fmtCaw(minOut)} CAW`
                : `${fmtEth(minOut, 8)} ETH`
              : '…'}{' '}
            （{t.swapSlippage} {slippage}%）
          </Text>
          <Text style={xs.sub}>{t.swapConfirmNote}</Text>
          {error && <Text style={[xs.sub, { color: xColors.danger }]}>{error}</Text>}
        </View>
        <TouchableOpacity
          style={[xs.button, { opacity: busy ? 0.5 : 1 }]}
          disabled={busy}
          onPress={doSwap}
        >
          <Text style={xs.buttonText}>
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
            <Text style={xs.sub}>{t.swapBack}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={xs.root} contentContainerStyle={xs.content}>
      <View style={xs.card}>
        <Text style={xs.sub}>
          {t.swapPay}（{paySymbol}）
          {payBalance != null
            ? ` ・ ${t.balanceLabel} ${payIsEth ? fmtEth(payBalance) : fmtCaw(payBalance)}`
            : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            style={[xs.input, { flex: 1, fontSize: 20 }]}
            keyboardType="decimal-pad"
            placeholder="0.0"
            value={amountText}
            onChangeText={setAmountText}
          />
          <TouchableOpacity style={xs.ghostButton} onPress={setMax}>
            <Text style={xs.ghostText}>{t.swapMax}</Text>
          </TouchableOpacity>
        </View>
        {payIsEth && <Text style={xs.sub}>{t.swapKeepGas}</Text>}
      </View>

      <TouchableOpacity onPress={flip} style={{ alignItems: 'center', marginVertical: -2 }}>
        <Text style={{ fontSize: 22, color: xColors.accent }}>⇅</Text>
      </TouchableOpacity>

      <View style={xs.card}>
        <Text style={xs.sub}>{t.swapReceive}（{receiveSymbol}）</Text>
        <Text style={{ fontSize: 20, fontWeight: '700', color: xColors.text }}>
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
          <Text style={xs.sub}>
            {t.swapRate}：1 ETH ={' '}
            {payIsEth
              ? fmtCaw((quoted * 10n ** 18n) / amountIn)
              : fmtCaw((amountIn * 10n ** 18n) / quoted)}{' '}
            CAW
          </Text>
        )}
      </View>

      <View style={xs.card}>
        <Text style={xs.sub}>{t.swapSlippage}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SLIPPAGES.map((v) => (
            <TouchableOpacity
              key={v}
              style={v === slippage ? xs.button : xs.ghostButton}
              onPress={() => setSlippage(v)}
            >
              <Text style={v === slippage ? xs.buttonText : xs.ghostText}>{v}%</Text>
            </TouchableOpacity>
          ))}
        </View>
        {insufficient && (
          <Text style={[xs.sub, { color: xColors.danger }]}>{t.swapInsufficient}</Text>
        )}
        {amountIn <= 0n && <Text style={xs.sub}>{t.swapEnterAmount}</Text>}
      </View>

      <TouchableOpacity
        style={[
          xs.button,
          { opacity: amountIn > 0n && quoted != null && !insufficient ? 1 : 0.45 },
        ]}
        disabled={!(amountIn > 0n && quoted != null && !insufficient)}
        onPress={() => setPhase('review')}
      >
        <Text style={xs.buttonText}>{t.swapReview}</Text>
      </TouchableOpacity>
      <Text style={xs.sub}>{t.swapRoute}</Text>
    </ScrollView>
  );
}
