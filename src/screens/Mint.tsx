import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ethers } from 'ethers';

import { colors, styles } from '../theme';
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

// Name minting is closed in the app for maintenance (since v0.1.10, period
// undecided). NOTE: this closes only the app's entrance — the contract's
// mint function is permissionless and cannot be halted by anyone, so the
// wording shown to users must never claim issuance itself is stopped.
const MINT_MAINTENANCE = true;

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
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.getNameTitle}</Text>
          <Text style={styles.sub}>{fmt(t.mintUnsupported, { label: preset.label })}</Text>
        </View>
      </ScrollView>
    );
  }

  if (MINT_MAINTENANCE) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.myNames}</Text>
          {names.length === 0 ? (
            <Text style={styles.sub}>{t.noNamesYetMint}</Text>
          ) : (
            names.map((n) => <NameCard key={n.tokenId} name={n} lang={lang} />)
          )}
          <Text style={styles.sub}>
            {t.balanceLabel}：{balances ? `${Number(ethers.formatEther(balances.eth)).toFixed(5)} ETH` : '…'}
            {balances?.caw != null ? ` / ${fmtCaw(balances.caw)} CAW` : ''}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>🛠 {t.mintMaintTitle}</Text>
          <Text style={styles.sub}>{t.mintMaintBody}</Text>
        </View>
      </ScrollView>
    );
  }

  if (phase === 'done' && result) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <Text style={{ fontSize: 40 }}>🎉</Text>
          <Text style={styles.h1}>@{result.name}</Text>
          <Text style={styles.sub}>{fmt(t.doneName, { id: result.tokenId })}</Text>
          <Text style={[styles.sub, { textAlign: 'center' }]}>{t.doneNote}</Text>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setResult(null);
            setInput('');
            setPhase('idle');
          }}
        >
          <Text style={styles.buttonText}>{t.anotherName}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>{t.myNames}</Text>
        {names.length === 0 ? (
          <Text style={styles.sub}>{t.noNamesYetMint}</Text>
        ) : (
          names.map((n) => <NameCard key={n.tokenId} name={n} lang={lang} />)
        )}
        <Text style={styles.sub}>
          {t.balanceLabel}：{balances ? `${Number(ethers.formatEther(balances.eth)).toFixed(5)} ETH` : '…'}
          {balances?.caw != null ? ` / ${fmtCaw(balances.caw)} CAW` : ''}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{t.getNameTitle}</Text>
        <Text style={styles.sub}>{t.mintIntro}</Text>
        <TextInput
          style={[styles.input, { fontSize: 18 }]}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t.namePlaceholder}
          value={input}
          onChangeText={setInput}
        />

        {phase === 'checking' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.sub}>{t.checking}</Text>
          </View>
        )}

        {check && !check.valid && (
          <Text style={[styles.sub, { color: colors.danger }]}>{t.nameInvalid}</Text>
        )}
        {check && check.valid && check.taken && (
          <Text style={[styles.sub, { color: colors.danger }]}>
            {fmt(t.nameTaken, { name, id: check.tokenId ?? 0 })}
          </Text>
        )}
        {check && check.valid && !check.taken && (
          <View style={{ gap: 4 }}>
            <Text style={[styles.body, { color: colors.accentDark, fontWeight: '700' }]}>
              {fmt(t.nameAvailable, { name })}
            </Text>
            <Text style={styles.sub}>{fmt(t.burnLabel, { n: fmtCaw(check.burn) })}</Text>
            <Text style={styles.sub}>{fmt(t.depositLabel, { n: fmtCaw(DEPOSIT) })}</Text>
            <Text style={styles.sub}>
              {fee != null ? fmt(t.syncFeeLabel, { n: Number(ethers.formatEther(fee)).toFixed(5) }) : '…'}
              {t.syncFeeNote}
            </Text>
            {cawShort && (
              <Text style={[styles.sub, { color: colors.danger }]}>
                {fmt(t.cawShort, { n: fmtCaw(needCaw) })}
              </Text>
            )}
          </View>
        )}

        {error && <Text style={[styles.sub, { color: colors.danger }]}>{error}</Text>}

        <TouchableOpacity
          style={[
            styles.button,
            {
              opacity:
                check && check.valid && !check.taken && !cawShort && !busy ? 1 : 0.45,
            },
          ]}
          disabled={!(check && check.valid && !check.taken && !cawShort) || busy}
          onPress={doMint}
        >
          <Text style={styles.buttonText}>
            {phase === 'approving'
              ? t.stepApproving
              : phase === 'minting'
                ? t.stepMinting
                : phase === 'confirming'
                  ? t.stepConfirming
                  : t.mintButton}
          </Text>
        </TouchableOpacity>
        <Text style={styles.sub}>{t.mintNote}</Text>
      </View>
    </ScrollView>
  );
}
