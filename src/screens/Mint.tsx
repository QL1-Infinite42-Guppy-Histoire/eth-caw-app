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

function fmtCaw(v: bigint): string {
  const n = Number(ethers.formatUnits(v, 18));
  return n.toLocaleString('ja-JP', { maximumFractionDigits: 0 });
}

export default function Mint({ wallet, preset, names, onMinted }: Props) {
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
          <Text style={styles.title}>名前を取る</Text>
          <Text style={styles.sub}>
            この接続先（{preset.label}）では、アプリ内ミントは準備中です。メインネットに切り替えると使えます。
          </Text>
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
          <Text style={styles.sub}>名前を取得しました（tokenId {result.tokenId}）</Text>
          <Text style={[styles.sub, { textAlign: 'center' }]}>
            Base への同期は数分で完了します。投稿は、コミュニティのノードが立ち上がると使えるようになります。
          </Text>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setResult(null);
            setInput('');
            setPhase('idle');
          }}
        >
          <Text style={styles.buttonText}>別の名前も取る</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>自分の名前</Text>
        {names.length === 0 ? (
          <Text style={styles.sub}>まだ名前を持っていません。下から取得できます。</Text>
        ) : (
          names.map((n) => (
            <Text key={n.tokenId} style={styles.body}>
              @{n.name}
              <Text style={{ color: colors.faint }}> （tokenId {n.tokenId}）</Text>
            </Text>
          ))
        )}
        <Text style={styles.sub}>
          残高：{balances ? `${Number(ethers.formatEther(balances.eth)).toFixed(5)} ETH` : '…'}
          {balances?.caw != null ? ` / ${fmtCaw(balances.caw)} CAW` : ''}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>名前を取る</Text>
        <Text style={styles.sub}>
          名前は Ethereum 上の NFT として発行されます。ノードは不要で、あなたのウォレットから直接手続きします。
        </Text>
        <TextInput
          style={[styles.input, { fontSize: 18 }]}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="ほしい名前（英小文字・数字・_）"
          value={input}
          onChangeText={setInput}
        />

        {phase === 'checking' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.sub}>チェーンで確認しています…</Text>
          </View>
        )}

        {check && !check.valid && (
          <Text style={[styles.sub, { color: colors.danger }]}>
            この名前は使えません（使える文字・長さを確認してください）
          </Text>
        )}
        {check && check.valid && check.taken && (
          <Text style={[styles.sub, { color: colors.danger }]}>
            @{name} はすでに取得されています（tokenId {check.tokenId}）
          </Text>
        )}
        {check && check.valid && !check.taken && (
          <View style={{ gap: 4 }}>
            <Text style={[styles.body, { color: colors.accentDark, fontWeight: '700' }]}>
              @{name} は取得できます
            </Text>
            <Text style={styles.sub}>名前の費用（燃焼）：{fmtCaw(check.burn)} CAW</Text>
            <Text style={styles.sub}>預け入れ：{fmtCaw(DEPOSIT)} CAW（投稿に使う残高になります）</Text>
            <Text style={styles.sub}>
              Base への同期手数料：{fee != null ? `約 ${Number(ethers.formatEther(fee)).toFixed(5)} ETH` : '…'}
              （多めに払って余りは戻ります）
            </Text>
            {cawShort && (
              <Text style={[styles.sub, { color: colors.danger }]}>
                CAW が足りません（必要 {fmtCaw(needCaw)} CAW）。CAW は Uniswap などで購入できます
                （この版ではアプリ内購入は未対応です）。
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
              ? '承認しています…'
              : phase === 'minting'
                ? '発行しています…'
                : phase === 'confirming'
                  ? '確認中です…'
                  : 'この名前を取る'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.sub}>
          手続きは「CAW の承認 → 発行」の2回の署名で進みます。発行した名前は取り消せません。
        </Text>
      </View>
    </ScrollView>
  );
}
