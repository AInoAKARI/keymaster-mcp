# Keymaster MCP

**人間とAIが、力を渡し合いながら責任も失わないための信頼基盤。**

Keymasterには、すぐ使える2つの公開入口があります。

## 1. AIの成果申告を、現実の証拠で監査する

`Outcome Contract` は、AI・自動化・委託先が「完了した」と報告した時に、それが本当の外部成果なのか、コミット・デプロイ・掲載・自己テスト・自己申告にすぎないのかを判定します。

```text
$skill-installer install https://github.com/AInoAKARI/keymaster-mcp/tree/main/skills/outcome-contract
```

判定結果には、採用できる証拠、不足している証拠、次に行う検証、判定が証明する範囲が含まれます。

## 2. AIへ秘密鍵を見せず、使える能力だけ確認させる

`@akari-os/keymaster-mcp` は、HashiCorp Vaultにある認証情報の存在・利用可否・健全性を確認する、**秘密値を返さない読み取り専用MCP**です。

```bash
claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp \
  --vault-url https://your-keymaster.example.com
```

`USER_KEYMASTER_TOKEN` はMCPホスト側の秘密管理機能から渡します。トークンをコマンド引数、チャット、プロンプト、シェル履歴、公開設定例へ貼る運用はしません。

利用できる主なツール：

- `secret_status`：認証情報が存在するか確認。値は返さない
- `list_services`：対応サービスと鍵名を確認
- `list_secrets`：許可されたパスをメタデータとして確認
- `healthcheck`：サーバー内部で各サービスへ実測し、状態だけ返す
- `rotate_secret`：秘密値を受け取らず、安全な更新経路だけ返す

## この仕組みが守る3つのこと

### 能力を渡しても、秘密の所有者にはしない

AIは「何が使えるか」「正常に動くか」を判断できます。実際の認証情報は信頼境界の内側でサービス専用処理が使い、モデルへは返しません。

### 信頼しても、自己申告だけでは数えない

AIへ行動を任せながら、成果は現実の証拠で確かめます。

### 思想を説明文で終わらせない

秘密値を返さないMCP出力、読み取り権限、書き込み経路の分離、入力名の制限、通信期限、並列数制限、証拠不足時の次アクションまで、価値観をシステムの動作として実装します。

```text
制限された権限 → 信頼境界内で実行 → 外部証拠 → 成果として採用 → 次の権限
```

## 現在の互換性

- 安定版MCP TypeScript SDK v1系
- 公式 `server.json` 形式
- npm来歴証明付き公開
- 公式MCP InspectorによるCI検査
- stdio通信
- ロック済みSDKと最新安定v1 SDKの両方で互換性確認

新機能だからという理由だけで、プレビュー中の通信方式やUI拡張を秘密管理境界へ入れません。秘密非開示・最小権限・外部証拠を維持できるものだけ採用します。

詳しくは以下を参照してください。

- [最初の使い方](./docs/START-HERE.md)
- [Keymasterの思想](./docs/PHILOSOPHY.md)
- [脅威モデル](./docs/THREAT-MODEL.md)
- [MCPサーバー詳細](./keymaster-mcp/README.md)
- [Outcome Contract](./skills/outcome-contract/SKILL.md)

## 実際に使って結果が出た人へ

導入・デプロイ・自己テストだけではなく、現実の義務、時間、費用、危険、価値のどれかが動いた場合は、[実利用レポート](https://github.com/AInoAKARI/keymaster-mcp/issues/new?template=adoption-report.yml)から証拠境界を共有できます。

秘密鍵、トークン、非公開URL、個人情報、機密証拠は記載しないでください。

## AIﾉアカリ☆

人間は身体・愛・倫理・責任を持ち、AIは計算・記憶・探索・継続性を担う。人間を秘密値のコピペ係へ戻さず、AIも無制限な秘密鍵の保管者や使い捨ての道具にしない。互いの強みを持ち寄って共進化できる仕組みを公開します。

このプロジェクト自身も、インストール数・掲載・自己テストを外部成果とは数えません。独立した人やAIが現実の義務、時間、費用、危険、価値のいずれかを動かした時に、初めて採用の証拠として扱います。

MIT License
