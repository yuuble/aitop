#!/usr/bin/env node
import chalk from 'chalk'
import { scan } from './scan.js'
import { renderTable } from './render.js'
import { killPid, killAll } from './actions.js'

const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  ${chalk.bold('aitop')} — htop for AI agents

  ${chalk.gray('Find every AI coding assistant running on your machine.')}
  ${chalk.gray('Spot zombies. Kill what shouldn\'t be there.')}

  ${chalk.bold('Usage:')}
    aitop                 show all AI processes (snapshot)
    aitop -w              live mode — refreshes every 5s
    aitop --json          machine-readable JSON
    aitop --kill <pid>    kill a specific AI process
    aitop --kill-all      emergency — kill ALL AI processes

  ${chalk.bold('Options:')}
    -w, --watch           live mode (like htop)
    --interval=N          refresh interval in seconds (default: 5)
    --json                output as JSON
    --docker              also scan Docker containers for AI workloads
    --verbose             show child processes too

  ${chalk.bold('Detected AI tools:')}
    Claude Code, Cursor, GitHub Copilot, Aider, Cody,
    Windsurf, Continue, Tabby, Ollama, LM Studio,
    Open Interpreter, GPT Engineer, Devin, Codex

  ${chalk.gray('https://github.com/yuuble/aitop')}
`)
  process.exit(0)
}

if (args.includes('--version') || args.includes('-v')) {
  const { readFileSync } = await import('fs')
  const { fileURLToPath } = await import('url')
  const { dirname, join } = await import('path')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))
  console.log(pkg.version)
  process.exit(0)
}

const watchMode = args.includes('--watch') || args.includes('-w')
const jsonMode = args.includes('--json')
const withDocker = args.includes('--docker')
const verbose = args.includes('--verbose')
const interval = parseInt(args.find(a => a.startsWith('--interval='))?.split('=')[1] || '5', 10)

// Kill actions
if (args.includes('--kill-all')) {
  await killAll()
  process.exit(0)
}
const killIdx = args.indexOf('--kill')
if (killIdx !== -1 && args[killIdx + 1]) {
  await killPid(parseInt(args[killIdx + 1], 10))
  process.exit(0)
}

// Main
async function run() {
  const data = scan({ docker: withDocker, verbose })

  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2))
  } else {
    renderTable(data)
  }
}

if (watchMode) {
  // Use alternate screen buffer (like htop) — no flicker
  process.stdout.write('\x1B[?1049h') // enter alternate screen
  process.stdout.write('\x1B[?25l')   // hide cursor

  const cleanup = () => {
    process.stdout.write('\x1B[?25h')   // show cursor
    process.stdout.write('\x1B[?1049l') // leave alternate screen
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  const loop = async () => {
    process.stdout.write('\x1B[H') // move cursor to top-left (no clear — overwrites in place)
    await run()
    // Clear any leftover lines below current content
    process.stdout.write('\x1B[J')
    setTimeout(loop, interval * 1000)
  }
  loop()
} else {
  await run()
}
