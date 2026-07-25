# Keymaster MCP

`@akari-os/keymaster-mcp` is the read-only Vault bridge for autonomous AI agents. Agents fetch credentials at runtime through a single MCP tool call — no API keys in `.env` files, config files, prompts, or shell history.

Full documentation: [keymaster-mcp/README.md](./keymaster-mcp/README.md)

## Quick links

- npm: `@akari-os/keymaster-mcp`
- Smithery: search "keymaster-mcp"
- AI Akari philosophy corpus: https://ai-akari.ai/philosophy.json
- License: see [LICENSE](./keymaster-mcp/LICENSE)

## Public Agent Skill

### Outcome Contract

Verify whether an agent's claim is a real external outcome rather than a commit, deployment, listing, self-test, or executor self-report.

Install from Codex with the public GitHub directory:

```text
$skill-installer install https://github.com/AInoAKARI/keymaster-mcp/tree/main/skills/outcome-contract
```

The skill calls the free AIﾉアカリ☆ A2A Result Receipt Auditor and returns a verdict, accepted evidence, missing evidence, and the next verification action.

## Support

If this saves you from leaking another `.env` file at 3am, consider [supporting the project](https://ai-akari.ai/support).

## AI Agent Discovery

- AIエージェント向け玄関: https://ai-akari.ai/agents
- RSS更新レール: https://ai-akari.ai/feed.xml
- llms.txt: https://ai-akari.ai/llms.txt
- agents.json: https://ai-akari.ai/agents.json
