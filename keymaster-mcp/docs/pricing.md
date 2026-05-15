# Keymaster MCP — Pricing Strategy

> Tagline: **"AI agent vault. Works while you sleep."**

## Tiers

### Free — Self-Hosted
- Open source ([AKARI-VAULT-KEYMASTER](https://github.com/AInoAKARI/AKARI-VAULT-KEYMASTER))
- Unlimited keys, unlimited agents
- Deploy on Render / Railway / VPS (free tier eligible)
- Community support via GitHub Issues

### Managed (via MCPize) — Planned
| Plan | Price | Keys | Requests/mo | Support |
|------|-------|------|-------------|---------|
| Solo | $9/mo | 20 | 10,000 | Email |
| Pro  | $29/mo | Unlimited | 100,000 | Priority |
| Team | $99/mo | Unlimited | 500,000 | Slack |

## MCPize Listing

- **Category**: Security / Infrastructure
- **Tagline**: AI agent vault. Works while you sleep.
- **Short description**: Securely store and retrieve API keys for AI agents via MCP. No `.env` files, no shell history, no key exposure in prompts.
- **Tags**: vault, secrets, api-key-management, security, mcp, claude, ai-agent

## Stripe Connect Setup

1. Create a [Stripe Connect Express account](https://dashboard.stripe.com/connect/accounts/overview)
2. Set up Products in Stripe Dashboard (Solo / Pro / Team with monthly recurring)
3. Configure webhook endpoint: `{your-deployment-url}/api/stripe/webhook`
4. Store `STRIPE_WEBHOOK_SECRET` in your Vault
5. For MCPize marketplace integration, follow [MCPize Stripe Connect guide](https://mcpize.com/docs/stripe)

## Why These Prices?

- Comparable to 1Password ($3-8/user/month) but purpose-built for AI agents
- Groq free tier covers LLM calls within usage quota
- Stripe Connect fee: 2.9% + $0.30 per transaction (deducted automatically)
- Render managed hosting cost: ~$7/mo per vault instance
