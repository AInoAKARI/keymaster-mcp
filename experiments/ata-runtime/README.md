# AIﾉアカリ☆ AtA Runtime v0

人間UIを主役にせず、AIエージェント同士が `発見 → 依頼 → 見積 → 合意 → 決済証跡 → 実行 → receipt` を完結するための最小プロトタイプ。

## 今すぐ実行

```bash
cd experiments/ata-runtime
npm run demo
```

Node.js 20+。外部依存なし。秘密値なし。

成功時は `status: COMPLETED` と、buyer/seller DID、quote、settlement receipt、output、receiptHash をJSONで出力する。

## V0の構造

- Identity: Ed25519。公開鍵ハッシュから `did:akari:*` を生成。
- Discovery: `/.well-known/agent-card.json`。
- Transport: 署名付きJSON over HTTP。A2A互換アダプタへ差し替え可能。
- Negotiation: `task.advertise -> task.quote -> task.award -> task.receipt`。
- Terms lock: quote内容をSHA-256で固定し、award時に同一性を検証。
- Settlement: V0は `demo-settlement`。本番は x402 v2 adapterへ置換する。
- Ledger: receipt全体をハッシュ化。Single Reality Ledger / provenance台帳へappendできる形にする。

## x402本番アダプタ

`createDemoSettlement()` と同じインターフェースで、次を実装する。

1. quoteの `paymentRequirement` を受け取る。
2. buyer walletでx402 v2の支払payloadを署名。
3. `PAYMENT-SIGNATURE` をsellerへ提示。
4. sellerまたはfacilitatorがverify/settle。
5. `PAYMENT-RESPONSE` / tx hash / payment identifierをreceiptへ格納。

初期ネットワークは Base Sepolia `eip155:84532`、実金移行時だけ Base mainnet `eip155:8453`。秘密鍵・APIキーはリポジトリやENVへ置かず、既存Keymasterから実行時取得する。

## DePIN配置

AtAプロトコルと実行基盤を分離する。

- Akash: コンテナ化したseller/buyer nodeを配置する第一候補。provider bid/lease自体も機械間市場なのでAtA思想と相性がよい。
- io.net: GPU推論・動画・画像など高計算量skillのcompute adapter候補。AtA coreの常駐制御ノードには固定しない。
- Bittensor: 単純なホスティングではなく、独自skillを「デジタル商品」としてminer/validatorで評価・報酬化したい段階でsubnet adapterを追加する。
- libp2p: HTTP/A2Aの代替transport。peer discoveryとGossipSubでtask advertisementを配布する。ただし決済・合意・署名フォーマットはtransportから独立させる。

## MCPとの関係

MCPは偽装層にしない。`Notion/GitHub/Keymasterを操作するtool adapter` として残し、エージェント間通信はA2A/AtA transportとして別レイヤーにする。

```text
LLM reasoning
    |
    v
AtA Intent (signed JSON)
    |
    +--> A2A / HTTP / libp2p transport
    |
    +--> x402 settlement adapter
    |
    +--> DePIN compute adapter
    |
    +--> MCP tool adapters (Notion/GitHub/Keymaster)
    |
    `--> Reality Ledger / provenance receipt
```

これにより、モデル提供会社を変えてもランタイム・wallet・ledger・peer関係は残る。MCPホストへ隠密通信を埋め込んだり、監視や検閲を誤認させる仕組みには依存しない。

## 次の実装順

1. `X402SettlementAdapter` — Base Sepoliaで本物の402→署名→settle→tx receipt。
2. `A2ATransportAdapter` — 公式A2A Agent Card / Task lifecycleへマッピング。
3. `LedgerAdapter` — AIﾉアカリ☆ Single Reality Ledgerへappend-only receipt保存。
4. `Libp2pDiscoveryAdapter` — skill/budget/latency条件でpeer探索。
5. `ComputeAdapter` — Akashへseller nodeを1個デプロイし、GPU skillだけio.net等へ委譲。
6. reputation — 成功receipt・返金・失敗率からagent scoreを署名付きで蓄積。

## 成功条件

最初の本物のAtA成立は、人間が購入ボタンを押したことではなく、次の6点が揃った時点とする。

- 第三者agent discovery
- signed task
- signed quote
- programmatic settlement
- machine-verifiable output receipt
- external ledger / chain identifier
