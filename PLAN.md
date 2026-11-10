# CAW — Ethereum Edition アプリ開発計画（2026-11-10）

ユーザー決定: アプリ版を作る。接続先は当面テストネット（自前ステージング）、本番ノード稼働後に向き先を切り替える。

## 対象プロトコル
Gilgamesh 版 CAW の自前デプロイ。QL1 版 CAW Social アプリとは別プロトコル・別アプリ。
- 名前 = Ethereum L1 の NFT（CawProfile）、台帳は Base 側 Ledger に LayerZero 同期
- 投稿 = EIP-712 署名アクションをノード API に送り、バリデータが Base の CawActions へ提出（ユーザーは L2 ガス不要）
- 読み取り = ノード API（インデックス済み DB）

## 接続先（フェーズ）
- Phase A（開発・初期）: 自前テストネット一式
  - Sepolia / Base Sepolia / Arbitrum Sepolia のステージングデプロイ（稼働実績あり）
  - ノード API はこの VM 上で動かし、開発中はトンネル経由でスマホから届くようにする
- Phase B（本番）: メインネットデプロイ＋公開 HTTPS ノードに切替
- **ノード URL はアプリ内設定で変更可能にする**（トンネル URL の変動と本番切替の両方に、再ビルドなしで追随するため）

## スタック（QL1 版 CAW Social アプリと同系統）
- Expo（React Native）+ TypeScript、ethers v6
- 鍵保管: expo-secure-store、認証: expo-local-authentication（生体）
- ビルド: GitHub Actions、配布: GitHub Release の直接 DL リンク（APK をチャット添付しない既定ルール）
- リポジトリ: `eth-caw-app`（公開・MIT）、package: `one.guppyguide.caweth`、表示名「CAW — Ethereum Edition」

## v1 スコープ
1. ウォレット: 作成（ニーモニック）／インポート、SecureStore 暗号化保管、生体アンロック
2. 認証: ノード API の personal_sign チャレンジ（`Verify wallet ownership for CAW` 形式）→ セッション
3. ホーム TL: `GET /api/caws` 系で投稿一覧（名前・本文・時刻・いいね数など）
4. 投稿: EIP-712（ActionData 型、CawActions を verifyingContract）で署名 → `POST /api/actions`
   - cawonce は `POST /api/users/check-cawonces` で安全な値を取る（INT4 制約）
   - tip は `GET /api/validator-analytics/tip-config` の baseTip
   - 本文は smltxt 圧縮（ノード側の流儀に合わせる）
5. 名前表示: 自分の tokenId と名前（台帳読み取り／API の authorizedTokenIds）
6. いいね／リコー: アクション種別を API で送る（投稿と同じ署名基盤）
7. 設定: ノード URL、ネットワーク表示（Testnet/Mainnet）、鍵の表示（警告付き）

## v1 に入れないもの
- 名前の新規ミント（アプリ内購入フローは v1.1。まずは読み＋投稿）
- DM、メディアアップロード、フォロー管理のフル実装（API の対応範囲を見て段階追加）
- iOS（Android 先行、既定方針どおり）

## マイルストーン
- M1: スキャフォールド＋ウォレット作成/復元＋認証がテストネットノードで通る
- M2: TL 表示＋投稿が実機で通る（= アプリ版の「名前→投稿→表示」）
- M3: いいね／リコー、設定（ノード URL 切替）、体裁（UI イメージ準拠のライトテーマ）
- M4: Actions ビルドで APK を Release 配布、実機確認

## 未確定・リスク
- スマホ→ノードの到達手段（開発中）: Cloudflare クイックトンネル or Tailscale。URL が変わり得るため設定式で吸収
- ノードは VM 再起動で落ちる（この環境の制約）。落ちたら provision スクリプト＋再起動で復旧する運用
- 本番切替時は chainId（84532→8453）、CawActions アドレス、RPC、ノード URL を設定プリセットで切替
