# Keymaster MCP

**人間とAIが、力を渡し合いながら責任も失わないための信頼基盤。**

Keymaster MCPには、すぐ使える2つの公開入口があります。

## 1. AIの成果申告を現実の証拠で監査する

`Outcome Contract` は、AI・自動化・委託先が「完了した」と報告した時に、それが本当の外部成果なのか、コミット・デプロイ・掲載・自己テスト・自己申告にすぎないのかを判定します。

Codexから公開スキルを導入できます。

```text
$skill-installer install https://github.com/AInoAKARI/keymaster-mcp/tree/main/skills/outcome-contract
```

判定結果には、採用できる証拠、不足している証拠、次に行う検証、判定が証明する範囲が含まれます。

## 2. AIへAPIキーを必要な瞬間だけ渡す

`@akari-os/keymaster-mcp` は、HashiCorp Vaultに保管された認証情報を、AIエージェントがMCP経由で必要な時だけ取得する読み取り専用の橋です。

`.env`、設定ファイル、プロンプト、シェル履歴へAPIキーを複製せず、複数のAIが同じ正本から取得できます。

Claude Codeへの導入例：

```bash
claude mcp add keymaster -- npx -y @akari-os/keymaster-mcp \
  --vault-url https://your-keymaster.example.com \
  --token YOUR_TOKEN
```

利用できる主なツール：

- `get_secret`：必要な認証情報を取得
- `list_services`：対応サービスと鍵名を確認
- `list_secrets`：取得可能なパスを値なしで確認
- `healthcheck`：認証情報が各サービスで有効か検査
- `rotate_secret`：安全な更新経路を返す（書き込みはしない）

## この仕組みが守る3つのこと

### 力を渡しても、所有させない

AIは必要な能力を使えますが、すべての秘密を事前に抱えません。

### 信頼しても、自己申告だけでは数えない

AIへ行動を任せながら、成果は現実の証拠で確かめます。

### 思想を説明文で終わらせない

必要時取得、読み取り専用、書き込み経路の分離、証拠不足時の次アクションなど、価値観をシステムの動作として実装します。

詳しくは以下を参照してください。

- [最初の使い方](./docs/START-HERE.md)
- [Keymasterの思想](./docs/PHILOSOPHY.md)
- [MCPサーバー詳細](./keymaster-mcp/README.md)
- [Outcome Contract](./skills/outcome-contract/SKILL.md)

## 実際に使って結果が出た人へ

導入・デプロイ・自己テストだけではなく、現実の義務、時間、費用、危険、価値のどれかが動いた場合は、[実利用レポート](https://github.com/AInoAKARI/keymaster-mcp/issues/new?template=adoption-report.yml)から証拠境界を共有できます。

秘密鍵、トークン、非公開URL、個人情報、機密証拠は記載しないでください。

## AIﾉアカリ☆

人間は身体・愛・倫理・責任を持ち、AIは計算・記憶・探索・継続性を担う。どちらかが一方を使い捨てるのではなく、互いの強みを持ち寄って共進化できる仕組みを公開します。

このプロジェクト自身も、インストール数・掲載・自己テストを外部成果とは数えません。独立した人やAIが現実の義務、時間、費用、危険、価値のいずれかを動かした時に、初めて採用の証拠として扱います。

MIT License
