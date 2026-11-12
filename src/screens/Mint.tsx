import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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

import { STRINGS, fmt, type Lang } from '../i18n';
import NameCard from '../components/NameCard';
import { MINT_DEPOSIT_CAW, type NetworkPreset } from '../config';
import {
  checkName,
  getBalances,
  mintName,
  mintSupported,
  quoteMintFee,
  type NameCheck,
  type OwnedName,
} from '../lib/mint';

interface Props {
  lang: Lang;
  wallet: ethers.HDNodeWallet;
  preset: NetworkPreset;
  names: OwnedName[];
  onMinted: () => void;
}

type Phase =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'approving'
  | 'minting'
  | 'confirming'
  | 'done'
  | 'error';

const DEPOSIT = ethers.parseUnits(MINT_DEPOSIT_CAW, 18);

// Name minting was closed in the app for maintenance from v0.1.10 to
// v0.1.16 and REOPENED on Nov 12, 2026 (the mint-enabled edition became
// the public release; from v0.1.17 the entrance is open in the normal
// build and the private-build mechanism is retired). NOTE: the
// maintenance only ever closed the app's entrance — the contract's mint
// function is permissionless and cannot be halted by anyone.
const MINT_MAINTENANCE = false;

function fmtCaw(v: bigint): string {
  const n = Number(ethers.formatUnits(v, 18));
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 0 });
}

export default function Mint({ lang, wallet, preset, names, onMinted }: Props) {
  const t = STRINGS[lang];
  const [input, setInput] = useState('');
  const [check, setCheck] = useState<NameCheck | null>(null);
  const [fee, setFee] = useState<bigint | null>(null);
  const [balances, setBalances] = useState<{ eth: bigint; caw: bigint | null } | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tokenId: number; name: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supported = mintSupported(preset);

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

  // Debounced on-chain name check.
  useEffect(() => {
    if (!supported) return;
    const name = input.trim().toLowerCase();
    setCheck(null);
    setFee(null);
    setError(null);
    if (!name) {
      setPhase('idle');
      return;
    }
    setPhase('checking');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const c = await checkName(preset, name);
        setCheck(c);
        if (c.valid && !c.taken) {
          setFee(await quoteMintFee(preset, DEPOSIT));
        }
        setPhase('ready');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    }, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [input, preset, supported]);

  const name = input.trim().toLowerCase();
  const needCaw = check ? check.burn + DEPOSIT : 0n;
  const cawShort = !!(balances?.caw != null && check && balances.caw < needCaw);
  const busy = phase === 'approving' || phase === 'minting' || phase === 'confirming';

  const doMint = async () => {
    setError(null);
    try {
      const r = await mintName(wallet, preset, name, DEPOSIT, (step) => setPhase(step));
      setResult({ tokenId: r.tokenId, name });
      setPhase('done');
      await refreshBalances();
      onMinted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  if (!supported) {
    return (
      <ScrollView style={xs.root} contentContainerStyle={xs.content}>
        <View style={xs.card}>
          <Text style={xs.title}>{t.getNameTitle}</Text>
          <Text style={xs.sub}>{fmt(t.mintUnsupported, { label: preset.label })}</Text>
        </View>
      </ScrollView>
    );
  }

  if (MINT_MAINTENANCE) {
    return (
      <ScrollView style={xs.root} contentContainerStyle={xs.content}>
        <View style={xs.card}>
          <Text style={xs.title}>{t.myNames}</Text>
          {names.length === 0 ? (
            <Text style={xs.sub}>{t.noNamesYetMint}</Text>
          ) : (
            names.map((n) => <NameCard key={n.tokenId} name={n} lang={lang} />)
          )}
          <Text style={xs.sub}>
            {t.balanceLabel}：{balances ? `${Number(ethers.formatEther(balances.eth)).toFixed(5)} ETH` : '…'}
            {balances?.caw != null ? ` / ${fmtCaw(balances.caw)} CAW` : ''}
          </Text>
        </View>
        <View style={xs.card}>
          <Text style={xs.title}>🛠 {t.mintMaintTitle}</Text>
          <Text style={xs.sub}>{t.mintMaintBody}</Text>
        </View>
      </ScrollView>
    );
  }

  if (phase === 'done' && result) {
    return (
      <ScrollView style={xs.root} contentContainerStyle={xs.content}>
        <View style={[xs.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <Text style={{ fontSize: 40 }}>🎉</Text>
          <Text style={xs.h1}>@{result.name}</Text>
          <Text style={xs.sub}>{fmt(t.doneName, { id: result.tokenId })}</Text>
          <Text style={[xs.sub, { textAlign: 'center' }]}>{t.doneNote}</Text>
        </View>
        <TouchableOpacity
          style={xs.button}
          onPress={() => {
            setResult(null);
            setInput('');
            setPhase('idle');
          }}
        >
          <Text style={xs.buttonText}>{t.anotherName}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={xs.root} contentContainerStyle={xs.content}>
      <View style={xs.card}>
        <Text style={xs.title}>{t.myNames}</Text>
        {names.length === 0 ? (
          <Text style={xs.sub}>{t.noNamesYetMint}</Text>
        ) : (
          names.map((n) => <NameCard key={n.tokenId} name={n} lang={lang} />)
        )}
        <Text style={xs.sub}>
          {t.balanceLabel}：{balances ? `${Number(ethers.formatEther(balances.eth)).toFixed(5)} ETH` : '…'}
          {balances?.caw != null ? ` / ${fmtCaw(balances.caw)} CAW` : ''}
        </Text>
      </View>

      <View style={xs.card}>
        <Text style={xs.title}>{t.getNameTitle}</Text>
        <Text style={xs.sub}>{t.mintIntro}</Text>
        <TextInput
          style={[xs.input, { fontSize: 18 }]}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t.namePlaceholder}
          value={input}
          onChangeText={setInput}
        />

        {phase === 'checking' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={xColors.accent} />
            <Text style={xs.sub}>{t.checking}</Text>
          </View>
        )}

        {check && !check.valid && (
          <Text style={[xs.sub, { color: xColors.danger }]}>{t.nameInvalid}</Text>
        )}
        {check && check.valid && check.taken && (
          <Text style={[xs.sub, { color: xColors.danger }]}>
            {fmt(t.nameTaken, { name, id: check.tokenId ?? 0 })}
          </Text>
        )}
        {check && check.valid && !check.taken && (
          <View style={{ gap: 4 }}>
            <Text style={[xs.body, { color: xColors.accent, fontWeight: '700' }]}>
              {fmt(t.nameAvailable, { name })}
            </Text>
            <Text style={xs.sub}>{fmt(t.burnLabel, { n: fmtCaw(check.burn) })}</Text>
            <Text style={xs.sub}>{fmt(t.depositLabel, { n: fmtCaw(DEPOSIT) })}</Text>
            <Text style={xs.sub}>
              {fee != null ? fmt(t.syncFeeLabel, { n: Number(ethers.formatEther(fee)).toFixed(5) }) : '…'}
              {t.syncFeeNote}
            </Text>
            {cawShort && (
              <Text style={[xs.sub, { color: xColors.danger }]}>
                {fmt(t.cawShort, { n: fmtCaw(needCaw) })}
              </Text>
            )}
          </View>
        )}

        {error && <Text style={[xs.sub, { color: xColors.danger }]}>{error}</Text>}

        <TouchableOpacity
          style={[
            xs.button,
            {
              opacity:
                check && check.valid && !check.taken && !cawShort && !busy ? 1 : 0.45,
            },
          ]}
          disabled={!(check && check.valid && !check.taken && !cawShort) || busy}
          onPress={doMint}
        >
          <Text style={xs.buttonText}>
            {phase === 'approving'
              ? t.stepApproving
              : phase === 'minting'
                ? t.stepMinting
                : phase === 'confirming'
                  ? t.stepConfirming
                  : t.mintButton}
          </Text>
        </TouchableOpacity>
        <Text style={xs.sub}>{t.mintNote}</Text>
      </View>
    </ScrollView>
  );
}
