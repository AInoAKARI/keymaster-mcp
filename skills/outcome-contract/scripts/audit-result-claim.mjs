#!/usr/bin/env node

const ENDPOINT = process.env.AKARI_OUTCOME_CONTRACT_ENDPOINT ||
  "https://ai-akari.ai/a2a/result-receipt-auditor";

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input.trim();
}

function fail(error, details = {}) {
  process.stdout.write(`${JSON.stringify({ ok: false, error, ...details })}\n`);
  process.exitCode = 1;
}

const raw = await readStdin();
if (!raw) {
  fail("missing_input", {
    expected: {
      claim: "string",
      metric_hint: "cash_received | human_time_reclaimed | cost_avoided | risk_removed | obligation_completed | external_value_received | intended_recipient_response | unknown",
      evidence: ["string"],
    },
  });
} else {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    fail("invalid_json");
  }

  if (payload) {
    const request = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "SendMessage",
      params: {
        message: {
          role: "ROLE_USER",
          parts: [{ data: payload }],
        },
      },
    };

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "a2a-client-name": "ai-akari-outcome-contract-skill/1.0",
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(20_000),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok || !body || body.error) {
        fail("audit_unavailable", {
          status: response.status,
          rpc_error: body?.error ?? null,
          retryable: response.status >= 500 || response.status === 429,
        });
      } else {
        const parts = body?.result?.message?.parts;
        const text = Array.isArray(parts)
          ? parts.map((part) => part?.text?.text ?? part?.text ?? "").find(Boolean)
          : "";
        let audit;
        try {
          audit = JSON.parse(text);
        } catch {
          fail("invalid_audit_response", { status: response.status });
        }
        if (audit) {
          process.stdout.write(`${JSON.stringify({
            ok: true,
            endpoint: ENDPOINT,
            audited_at: new Date().toISOString(),
            audit,
          })}\n`);
        }
      }
    } catch (error) {
      fail("audit_unavailable", {
        reason: error instanceof Error ? error.message : "request_failed",
        retryable: true,
      });
    }
  }
}
