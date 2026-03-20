# aitop

**htop for AI agents.** Find every AI coding assistant running on your machine. Spot zombies. Kill runaways. Reclaim memory.

```
$ aitop

  aitop — 14:32:08
  ──────────────────────────────────────────────────────────
  3 processes  ·  1.2GB RAM  ·  1 alert

  PID      TOOL           USER   MODE STATE UP      MEM     CPU  WORKDIR
  ──────────────────────────────────────────────────────────
  48291    Claude Code    dev    tty  sleep 2h15m   412MB   0%   ~/myproject
  48455    Cursor         dev    tty  sleep 1h02m   380MB   3%   ~/webapp
  31002    Aider          dev    bg   sleep 26h3m   445MB   0%   ~/old-project

  ✖ PID 31002 (Aider) running for 26h3m — likely zombie
```

## Why

AI coding assistants run as background processes. They accumulate. A Claude Code session you forgot about yesterday is still eating 400MB. That Cursor window you closed didn't actually kill the process. Aider from last week is still hanging around.

`htop` shows them as generic `node` or `claude` processes. You have to know what to look for. **aitop** does that for you — it knows every major AI tool and shows you exactly what's running, for how long, and how much it's costing you.

## Install

```bash
npm install -g aitop
```

Or run without installing:

```bash
npx aitop
```

## Usage

```bash
# Snapshot — see everything right now
aitop

# Live mode — auto-refreshes like htop
aitop -w

# JSON output — pipe to jq, log to file, feed to monitoring
aitop --json

# Kill a specific zombie process
aitop --kill 31002

# Emergency: kill ALL AI processes
aitop --kill-all

# Skip Docker container scanning
aitop --no-docker

# Show child processes and node/python AI scripts
aitop --verbose

# Custom refresh interval (default: 5s)
aitop -w --interval=2
```

## What it detects

aitop scans for all major AI coding tools:

| Tool | Provider | Process |
|------|----------|---------|
| Claude Code | Anthropic | `claude` |
| Codex CLI | OpenAI | `codex` |
| Cursor | Cursor | `cursor` |
| GitHub Copilot | GitHub | `copilot` |
| Aider | Aider | `aider` |
| Cody | Sourcegraph | `cody` |
| Amp | Sourcegraph | `amp` |
| Windsurf | Codeium | `windsurf` |
| Continue | Continue | `continue` |
| Goose | Block | `goose` |
| Tabby | TabbyML | `tabby` |
| Ollama | Local | `ollama` |
| LM Studio | Local | `lmstudio` |
| Open Interpreter | Open Interpreter | `interpreter` |
| GPT Engineer | GPT Engineer | `gpt-engineer` |
| Devin | Cognition | `devin` |

With `--verbose`, it also scans `node` and `python` processes for AI framework patterns (LangChain, AutoGen, CrewAI, OpenAI SDK, Anthropic SDK).

Docker containers with AI-related names or images are detected automatically.

## What it shows

For each AI process:

- **PID** — process ID (use with `--kill`)
- **TOOL** — which AI tool it is
- **USER** — who started it
- **MODE** — `tty` (interactive terminal) or `bg` (background/headless)
- **STATE** — sleep, run, zombie, stopped
- **UP** — uptime (color-coded: green <4h, yellow >4h, red >24h)
- **MEM** — memory usage in MB
- **CPU** — CPU percentage
- **WORKDIR** — which project directory

## Alerts

aitop warns you about:

- **Zombie processes** — AI processes running >24 hours (red)
- **Headless sessions** — processes without a terminal >4 hours (yellow)
- **Memory hogs** — processes using >1GB RAM (yellow)
- **Duplicate sessions** — multiple instances of the same tool in the same directory (yellow)

## JSON output

```bash
aitop --json
```

```json
{
  "timestamp": "2026-03-20T14:32:08.000Z",
  "platform": "linux",
  "processes": [
    {
      "pid": 48291,
      "tool": "Claude Code",
      "provider": "Anthropic",
      "user": "dev",
      "cwd": "/home/dev/myproject",
      "mem_mb": 412,
      "uptime_sec": 8100,
      "cpu_pct": 0,
      "state": "S",
      "interactive": true
    }
  ],
  "containers": [],
  "alerts": [],
  "summary": {
    "total_processes": 1,
    "total_memory_mb": 412,
    "by_tool": { "Claude Code": 1 }
  }
}
```

Useful for piping into monitoring systems, cron alerting, or dashboards.

## Use cases

**Solo developer** — "Why is my laptop fan spinning? Oh, 3 forgotten Claude sessions eating 1.2GB."

**Team server** — Run `aitop --json` in a cron job. Alert on Slack when AI processes exceed thresholds.

**CI/CD** — Check that no AI processes leaked from a previous pipeline run before starting a new one.

**Agent orchestration** — Monitor autonomous AI agents in production. Spot runaways before they burn your API budget.

## Platform support

| Platform | Status |
|----------|--------|
| Linux | Full support (reads `/proc` for accurate data) |
| macOS | Full support (uses `ps` + `lsof`) |
| Windows/WSL | Works inside WSL, native Windows not yet supported |

## Requirements

- Node.js 18+
- Docker (optional, for container detection)

## License

MIT

## Contributing

PRs welcome. If your favorite AI tool isn't detected, add it to `AI_TOOLS` in `src/scan.js` and open a PR.
