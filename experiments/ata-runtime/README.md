# AIﾉアカリ☆ AtA Runtime v1

AIエージェント同士が `発見 → ハンドシェイク → 0.01円単位voucher → relay → settlement receipt` を人間操作なしで実行する最小ランタイム。

```bash
cd experiments/ata-runtime
npm test
npm run demo:v1
```

## 実装済み

- `src/agent_wallet/`: Ed25519署名、Solana互換base58公開アドレス、秘密鍵非公開。
- `src/ata_gateway/`: 明示的なAtA channel handshake、JPY micros整数会計、累積voucher、replay/tamper防止、AI payload relay、公証receipt。
- `src/ata_mcp/`: MCP `2026-07-28` の最小stdio handler。Notion由来ローカルindex検索とAtA channel/relay toolsを同居させるが、決済side effectはextension/tool/resultで明示する。
- x402 facilitator adapter: `/verify` → `/settle` の外部settlement境界。
- Tests: wallet / voucher chain / gateway / MCP / x402 mock facilitator。

## 0.01円

内部会計単位は `JPY_MICROS`。`1円 = 1,000,000`、`0.01円 = 10,000`。浮動小数点を使わない。

毎回オンチェーン送金せず、署名済み累積voucherを積み上げる。外部チェーンへはx402/Solana settlement adapterでまとめて確定できる。

## 秘密境界

秘密鍵をファイル・ENV・MCP出力へ出さない。`createAgentWallet()` はプロセス内 signer closureだけを持ち、外へ公開するのは DID / public key / address / sign() のみ。

## Settlement truth boundary

v1の標準デモは `notary-only`。オンチェーン決済を偽装しない。`x402-v2` adapterは外部facilitatorが `/verify` と `/settle` を成功させ、transaction/payment identifierを返した時だけ `finality: external` にする。

## 次

1. Solana devnet用x402/SVM payment payload signerをKeymaster実行境界へ接続。
2. cumulative voucherのbatch settlement contract/program adapter。
3. external tx id + balance deltaをSingle Reality Ledgerへappend。
4. A2A Agent Card / Task lifecycle adapter。
