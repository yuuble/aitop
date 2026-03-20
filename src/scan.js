import { execSync } from 'child_process'
import { readFileSync, readdirSync, readlinkSync, statSync, existsSync } from 'fs'
import { platform } from 'os'

// ── AI Tool Definitions ────────────────────────────────────────────────────
// Each entry: process name(s) to match, display name, provider
const AI_TOOLS = [
  { match: ['claude'],                          name: 'Claude Code',    provider: 'Anthropic' },
  { match: ['cursor'],                          name: 'Cursor',         provider: 'Cursor' },
  { match: ['copilot-agent', 'copilot'],        name: 'Copilot',        provider: 'GitHub' },
  { match: ['aider'],                           name: 'Aider',          provider: 'Aider' },
  { match: ['cody'],                            name: 'Cody',           provider: 'Sourcegraph' },
  { match: ['windsurf'],                        name: 'Windsurf',       provider: 'Codeium' },
  { match: ['continue'],                        name: 'Continue',       provider: 'Continue' },
  { match: ['tabby'],                           name: 'Tabby',          provider: 'TabbyML' },
  { match: ['ollama'],                          name: 'Ollama',         provider: 'Local' },
  { match: ['lms', 'lmstudio'],                 name: 'LM Studio',     provider: 'Local' },
  { match: ['interpreter'],                     name: 'Open Interpreter', provider: 'Open Interpreter' },
  { match: ['gpt-engineer'],                    name: 'GPT Engineer',   provider: 'GPT Engineer' },
  { match: ['codex'],                           name: 'Codex CLI',      provider: 'OpenAI' },
  { match: ['devin'],                           name: 'Devin',          provider: 'Cognition' },
  { match: ['goose'],                           name: 'Goose',          provider: 'Block' },
  { match: ['amp'],                             name: 'Amp',            provider: 'Sourcegraph' },
]

const IS_MAC = platform() === 'darwin'
const IS_LINUX = platform() === 'linux'

// ── Main Scanner ───────────────────────────────────────────────────────────

export function scan({ docker = true, verbose = false } = {}) {
  const processes = collectProcesses(verbose)
  const containers = docker ? collectContainers() : []
  const alerts = detectAlerts(processes, containers)

  return {
    timestamp: new Date().toISOString(),
    platform: platform(),
    processes,
    containers,
    alerts,
    summary: {
      total_processes: processes.length,
      total_memory_mb: processes.reduce((s, p) => s + p.mem_mb, 0),
      total_containers: containers.length,
      alerts: alerts.length,
      by_tool: groupBy(processes, 'tool'),
    },
  }
}

// ── Process Collection ─────────────────────────────────────────────────────

function collectProcesses(verbose) {
  const processes = []
  const seen = new Set()

  // Strategy 1: Direct pgrep for known process names
  for (const tool of AI_TOOLS) {
    for (const pattern of tool.match) {
      const pids = pgrep(pattern)
      for (const pid of pids) {
        if (seen.has(pid)) continue
        seen.add(pid)
        const info = getProcessInfo(pid)
        if (!info) continue
        processes.push({ ...info, tool: tool.name, provider: tool.provider })
      }
    }
  }

  // Strategy 2: Scan all node/python processes for AI-related args
  if (verbose) {
    const candidates = findAINodeProcesses()
    for (const { pid, tool, provider } of candidates) {
      if (seen.has(pid)) continue
      seen.add(pid)
      const info = getProcessInfo(pid)
      if (info) processes.push({ ...info, tool, provider })
    }
  }

  return processes
}

function pgrep(name) {
  try {
    const out = execSync(`pgrep -x ${name} 2>/dev/null`, { encoding: 'utf8', timeout: 5000 }).trim()
    return out ? out.split('\n').map(Number).filter(Boolean) : []
  } catch {
    return []
  }
}

function getProcessInfo(pid) {
  if (IS_LINUX) return getProcessInfoLinux(pid)
  if (IS_MAC) return getProcessInfoMac(pid)
  return null
}

function getProcessInfoLinux(pid) {
  try {
    const now = Math.floor(Date.now() / 1000)
    const status = readFileSync(`/proc/${pid}/status`, 'utf8')

    const rssMatch = status.match(/VmRSS:\s+(\d+)/)
    const rssKb = rssMatch ? parseInt(rssMatch[1], 10) : 0

    let user = '?'
    try { user = execSync(`ps -o user= -p ${pid} 2>/dev/null`, { encoding: 'utf8', timeout: 3000 }).trim() } catch {}

    let cwd = '?'
    try { cwd = readlinkSync(`/proc/${pid}/cwd`) } catch {}

    let startEpoch = now
    try { startEpoch = Math.floor(statSync(`/proc/${pid}`).ctimeMs / 1000) } catch {}

    let cpuPct = 0
    try { cpuPct = parseFloat(execSync(`ps -o %cpu= -p ${pid} 2>/dev/null`, { encoding: 'utf8', timeout: 3000 }).trim()) || 0 } catch {}

    let state = '?'
    try { state = execSync(`ps -o state= -p ${pid} 2>/dev/null`, { encoding: 'utf8', timeout: 3000 }).trim() } catch {}

    // Try to detect if it has a terminal (interactive) or is headless (agent)
    let tty = null
    try { tty = execSync(`ps -o tty= -p ${pid} 2>/dev/null`, { encoding: 'utf8', timeout: 3000 }).trim() } catch {}
    const interactive = tty && tty !== '?' && tty !== '??'

    return {
      pid,
      user,
      cwd,
      mem_kb: rssKb,
      mem_mb: Math.round(rssKb / 1024),
      uptime_sec: now - startEpoch,
      cpu_pct: cpuPct,
      state,
      interactive,
      tty: tty || null,
    }
  } catch {
    return null
  }
}

function getProcessInfoMac(pid) {
  try {
    const now = Math.floor(Date.now() / 1000)
    const out = execSync(
      `ps -o user=,rss=,%cpu=,state=,tty=,lstart= -p ${pid} 2>/dev/null`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim()

    if (!out) return null

    // Parse ps output
    const parts = out.split(/\s+/)
    const user = parts[0] || '?'
    const rssKb = parseInt(parts[1], 10) || 0
    const cpuPct = parseFloat(parts[2]) || 0
    const state = parts[3] || '?'
    const tty = parts[4] || '?'

    // lstart is like "Thu Mar 20 14:02:43 2026" — parse from remaining parts
    const lstartStr = parts.slice(5).join(' ')
    let startEpoch = now
    try { startEpoch = Math.floor(new Date(lstartStr).getTime() / 1000) } catch {}

    // cwd via lsof on mac
    let cwd = '?'
    try {
      const lsof = execSync(`lsof -p ${pid} -Fn 2>/dev/null | grep '^n/' | head -1`, { encoding: 'utf8', timeout: 5000 })
      cwd = lsof.trim().replace(/^n/, '')
    } catch {}

    const interactive = tty && tty !== '?' && tty !== '??'

    return {
      pid,
      user,
      cwd,
      mem_kb: rssKb,
      mem_mb: Math.round(rssKb / 1024),
      uptime_sec: now - startEpoch,
      cpu_pct: cpuPct,
      state,
      interactive,
      tty: tty || null,
    }
  } catch {
    return null
  }
}

function findAINodeProcesses() {
  const results = []
  try {
    const out = execSync(`ps -eo pid,args 2>/dev/null`, { encoding: 'utf8', timeout: 5000 })
    const aiPatterns = [
      { pattern: /anthropic|claude/i, tool: 'Claude (node)', provider: 'Anthropic' },
      { pattern: /openai/i, tool: 'OpenAI Agent (node)', provider: 'OpenAI' },
      { pattern: /langchain|langgraph/i, tool: 'LangChain Agent', provider: 'LangChain' },
      { pattern: /autogen/i, tool: 'AutoGen Agent', provider: 'Microsoft' },
      { pattern: /crewai/i, tool: 'CrewAI Agent', provider: 'CrewAI' },
    ]
    for (const line of out.trim().split('\n')) {
      const match = line.trim().match(/^(\d+)\s+(.*)$/)
      if (!match) continue
      const [, pidStr, args] = match
      if (!args.includes('node') && !args.includes('python')) continue
      for (const ap of aiPatterns) {
        if (ap.pattern.test(args)) {
          results.push({ pid: parseInt(pidStr, 10), ...ap })
          break
        }
      }
    }
  } catch {}
  return results
}

// ── Docker Container Detection ─────────────────────────────────────────────

function collectContainers() {
  try {
    const out = execSync(
      `docker ps --format '{{.ID}}\\t{{.Names}}\\t{{.Status}}\\t{{.CreatedAt}}\\t{{.Image}}' 2>/dev/null`,
      { encoding: 'utf8', timeout: 10000 }
    )
    const containers = []
    const aiImagePatterns = [
      /claude/i, /anthropic/i, /openai/i, /ollama/i,
      /agent/i, /copilot/i, /cursor/i, /ai[-_]?worker/i,
    ]
    for (const line of out.trim().split('\n')) {
      if (!line) continue
      const [id, name, status, created, image] = line.split('\t')
      const isAI = aiImagePatterns.some(p => p.test(name) || p.test(image))
      if (isAI) {
        containers.push({ id: id.substring(0, 12), name, status, created, image })
      }
    }
    return containers
  } catch {
    return []
  }
}

// ── Alert Detection ────────────────────────────────────────────────────────

function detectAlerts(processes, containers) {
  const alerts = []

  for (const p of processes) {
    if (p.uptime_sec > 86400) {
      alerts.push({
        level: 'critical',
        msg: `PID ${p.pid} (${p.tool}) running for ${formatUptime(p.uptime_sec)} — likely zombie`,
        pid: p.pid,
      })
    } else if (p.uptime_sec > 14400 && !p.interactive) {
      alerts.push({
        level: 'warning',
        msg: `PID ${p.pid} (${p.tool}) headless for ${formatUptime(p.uptime_sec)} — no terminal attached`,
        pid: p.pid,
      })
    }

    if (p.mem_mb > 1024) {
      alerts.push({
        level: 'warning',
        msg: `PID ${p.pid} (${p.tool}) using ${p.mem_mb}MB RAM`,
        pid: p.pid,
      })
    }
  }

  // Duplicate processes in same directory
  const cwdMap = {}
  for (const p of processes) {
    const key = `${p.tool}:${p.cwd}`
    if (!cwdMap[key]) cwdMap[key] = []
    cwdMap[key].push(p)
  }
  for (const [key, procs] of Object.entries(cwdMap)) {
    if (procs.length > 1) {
      alerts.push({
        level: 'warning',
        msg: `${procs.length}x ${procs[0].tool} in same directory (${procs[0].cwd}) — duplicate sessions?`,
      })
    }
  }

  return alerts
}

function formatUptime(sec) {
  if (sec > 86400) {
    const d = Math.floor(sec / 86400)
    const h = Math.floor((sec % 86400) / 3600)
    return `${d}d${h}h`
  }
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h${m}m`
}

function groupBy(arr, key) {
  const map = {}
  for (const item of arr) {
    const k = item[key] || 'unknown'
    map[k] = (map[k] || 0) + 1
  }
  return map
}
