# OpenClaw Setup Tasks

> Host: `legitk1ng` (100.73.35.31) · OpenClaw 2026.5.7 · Tailnet: `tailb79f25.ts.net`

## Task List

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | [Connect mobile device via OpenClaw node](#1-connect-mobile-device-via-openclaw-node) | 🔴 HIGH | Pending |
| 2 | [Set up Gemini CLI re-auth cron job](#2-set-up-gemini-cli-re-auth-cron-job) | 🟠 MED | Pending |
| 3 | [Install and configure all eligible skills](#3-install-and-configure-all-eligible-skills) | 🟠 MED | Pending |
| 4 | [Configure all plugins correctly](#4-configure-all-plugins-correctly) | 🟡 LOW | Pending |
| 5 | [Set up ACP tools](#5-set-up-acp-tools) | 🟡 LOW | Pending |
| 6 | [Security audit & harden Telegram group policy](#6-security-audit--harden-telegram-group-policy) | 🟠 MED | Pending |

---

## 1. Connect mobile device via OpenClaw node
**Priority:** HIGH (user-requested first)

Connect pixel-7 (100.68.246.100) or google-pixel-slate (100.107.31.29) as an OpenClaw node on the tailnet so mobile devices can run agent sessions.

**Steps:**
- [ ] Install openclaw on mobile/remote device
- [ ] Configure node to point at gateway: `wss://legitk1ng.tailb79f25.ts.net`
- [ ] Authenticate with gateway token
- [ ] Verify node appears in `openclaw status --all`
- [ ] Create bootstrap file for `main` agent on mobile node

**Tailnet devices available:**
- `pixel-7` — 100.68.246.100 · pixel-7.tailb79f25.ts.net
- `google-pixel-slate` — 100.107.31.29 · google-pixel-slate.tailb79f25.ts.net

---

## 2. Set up Gemini CLI re-auth cron job
**Priority:** MEDIUM

OAuth token for `google-gemini-cli:legitgilles@gmail.com` expires and needs background refresh.

**Steps:**
- [ ] Run initial re-auth: `openclaw models auth login --provider google-gemini-cli`
- [ ] Create Windows Scheduled Task or openclaw cron to run refresh before expiry
- [ ] Test that token refresh runs silently without blocking agent

---

## 3. Install and configure all eligible skills
**Priority:** MEDIUM

165 skills eligible, 39 blocked by missing binaries/config.

**Steps:**
- [ ] Install `jq` and `rg` (ripgrep) for session-logs skill
- [ ] Install `gh` CLI for github/gh-issues skills
- [ ] Install `ffmpeg` for video-frames skill
- [ ] Configure `TRELLO_API_KEY` + `TRELLO_TOKEN` env vars for trello skill
- [ ] Configure `ELEVENLABS_API_KEY` for sag skill
- [ ] Configure sherpa-onnx runtime + model dirs for TTS
- [ ] Enable coding-agent skill (requires `@anthropic-ai/claude-code`)
- [ ] Re-enable any skills incorrectly auto-disabled by doctor --fix

---

## 4. Configure all plugins correctly
**Priority:** LOW

68 loaded, 26 disabled. Review and enable relevant plugins.

**Steps:**
- [ ] Audit disabled plugins list
- [ ] Enable plugins relevant to Windows environment
- [ ] Configure any needing API keys

---

## 5. Set up ACP tools
**Priority:** LOW

Expand ACP tool permissions for the main agent beyond current allowlist.

**Current allowlist:** message, nodes, agents_list, dir_fetch, dir_list, file_fetch, file_write

**Steps:**
- [ ] Review full ACP tool catalog: `openclaw tools list`
- [ ] Add relevant tools to `agents.list[main].tools.alsoAllow`
- [ ] Test tool access from agent session

---

## 6. Security audit & harden Telegram group policy
**Priority:** MEDIUM

Doctor flagged open group policy — any Telegram group can ping the agent.

**Steps:**
- [ ] Set `channels.telegram.groupPolicy` to `"allowlist"`
- [ ] Add known group IDs to `channels.telegram.groupAllowFrom`
- [ ] Run `openclaw security audit --deep`
- [ ] Review and resolve any audit findings

---

*Last updated: 2026-05-12*
