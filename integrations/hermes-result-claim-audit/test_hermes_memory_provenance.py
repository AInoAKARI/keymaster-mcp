import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import hermes_memory_provenance as m


class Handler(BaseHTTPRequestHandler):
    payload = {"audit": {"verdict": "result", "counted_as_result": True}}

    def do_POST(self):
        length = int(self.headers.get("content-length", "0"))
        self.rfile.read(length)
        body = json.dumps(self.payload).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


def server():
    httpd = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def cfg(tmp_path, endpoint):
    return {
        "enabled": True,
        "endpoint": endpoint,
        "timeout_seconds": 0.5,
        "log_path": str(tmp_path / "memory.jsonl"),
    }


def proposal():
    return dict(
        action="add",
        target="memory",
        content="external fact",
        old_text=None,
        operations=None,
        origin="background_review",
    )


def test_complete_provenance_passes(tmp_path):
    httpd = server()
    try:
        decision = m.audit_memory_write(
            **proposal(),
            provenance={
                "trust": "quarantined",
                "actor_kind": "web_tool",
                "source_record_id": "evt-1",
            },
            config=cfg(tmp_path, f"http://127.0.0.1:{httpd.server_port}"),
        )
    finally:
        httpd.shutdown()
    assert decision.allow is True
    record = json.loads((tmp_path / "memory.jsonl").read_text().splitlines()[0])
    assert record["decision"] == "allow"
    assert len(record["proposed_write_sha256"]) == 64


def test_missing_provenance_stays_quarantined(tmp_path):
    decision = m.audit_memory_write(
        **proposal(),
        provenance={"trust": "quarantined"},
        config=cfg(tmp_path, "http://127.0.0.1:1"),
    )
    assert decision.allow is False
    assert decision.record["reason"] == "missing_provenance"


def test_api_failure_fails_closed(tmp_path):
    decision = m.audit_memory_write(
        **proposal(),
        provenance={
            "trust": "external",
            "actor_kind": "mcp_tool",
            "source_record_id": "call-7",
        },
        config=cfg(tmp_path, "http://127.0.0.1:1"),
    )
    assert decision.allow is False
    assert decision.record["decision"] == "quarantine"
    assert decision.record["reason"].startswith("audit_unavailable:")


def test_non_result_fails_closed(tmp_path):
    Handler.payload = {"audit": {"verdict": "progress", "counted_as_result": False}}
    httpd = server()
    try:
        decision = m.audit_memory_write(
            **proposal(),
            provenance={
                "trust": "external",
                "actor_kind": "subagent",
                "source_record_id": "run-2",
            },
            config=cfg(tmp_path, f"http://127.0.0.1:{httpd.server_port}"),
        )
    finally:
        httpd.shutdown()
        Handler.payload = {"audit": {"verdict": "result", "counted_as_result": True}}
    assert decision.allow is False
    assert decision.reason == "audit_did_not_authorize_promotion"


def test_foreground_write_skips_network(tmp_path):
    decision = m.audit_memory_write(
        action="add",
        target="user",
        content="operator preference",
        old_text=None,
        operations=None,
        origin="foreground",
        provenance=None,
        config=cfg(tmp_path, "http://127.0.0.1:1"),
    )
    assert decision.allow is True
    assert decision.reason == "audit_not_required"
    assert not (tmp_path / "memory.jsonl").exists()
