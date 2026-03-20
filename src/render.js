import chalk from 'chalk'

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

function uptimeColor(sec) {
  if (sec > 86400) return chalk.red
  if (sec > 14400) return chalk.yellow
  return chalk.green
}

function stateLabel(state, interactive) {
  const base = (() => {
    switch (state) {
      case 'S': return chalk.green('sleep')
      case 'R': return chalk.cyan('run  ')
      case 'D': return chalk.red('disk ')
      case 'Z': return chalk.red('zombi')
      case 'T': return chalk.yellow('stop ')
      default: return chalk.gray(state.padEnd(5))
    }
  })()
  return base
}

function shortPath(p) {
  if (!p || p === '?') return chalk.gray('—')
  return p
    .replace(/^\/home\/\w+/, '~')
    .replace(/^\/Users\/\w+/, '~')
}

function modeLabel(interactive, tty) {
  if (interactive) return chalk.blue('tty')
  return chalk.gray('bg ')
}

export function renderTable(data) {
  const { processes, containers, alerts, summary } = data
  const W = Math.min(process.stdout.columns || 80, 90)
  const line = '─'.repeat(W)

  console.log()
  console.log(chalk.bold(`  aitop`) + chalk.gray(` — ${new Date().toLocaleTimeString()}`))
  console.log(chalk.gray(`  ${line}`))

  // ── Summary line ───────────────────────────────────────────────────
  const parts = []
  parts.push(chalk.bold(`${summary.total_processes}`) + chalk.gray(' processes'))
  parts.push(chalk.bold(`${summary.total_memory_mb}MB`) + chalk.gray(' RAM'))
  if (summary.total_containers > 0) {
    parts.push(chalk.bold(`${summary.total_containers}`) + chalk.gray(' containers'))
  }
  if (summary.alerts > 0) {
    parts.push(chalk.red.bold(`${summary.alerts} alerts`))
  }
  console.log(`  ${parts.join(chalk.gray('  ·  '))}`)

  // Tool breakdown
  if (Object.keys(summary.by_tool).length > 0) {
    const toolParts = Object.entries(summary.by_tool)
      .map(([tool, count]) => `${count}x ${tool}`)
      .join(chalk.gray(', '))
    console.log(chalk.gray(`  ${toolParts}`))
  }

  // ── Process Table ──────────────────────────────────────────────────
  console.log()
  if (processes.length === 0) {
    console.log(chalk.gray('  No AI processes found.'))
    console.log()
    return
  }

  console.log(chalk.gray(
    `  ${'PID'.padEnd(8)} ${'TOOL'.padEnd(14)} ${'USER'.padEnd(8)} ${'MODE'.padEnd(4)} ${'STATE'.padEnd(6)} ${'UP'.padEnd(7)} ${'MEM'.padEnd(7)} ${'CPU'.padEnd(5)} WORKDIR`
  ))
  console.log(chalk.gray(`  ${line}`))

  for (const p of processes.sort((a, b) => b.uptime_sec - a.uptime_sec)) {
    const color = uptimeColor(p.uptime_sec)
    const cpuStr = p.cpu_pct > 0 ? `${p.cpu_pct.toFixed(0)}%` : '—'
    console.log(
      `  ${color(String(p.pid).padEnd(8))}` +
      ` ${chalk.cyan(p.tool.padEnd(14))}` +
      ` ${String(p.user).padEnd(8)}` +
      ` ${modeLabel(p.interactive, p.tty).padEnd(13)}` +
      ` ${stateLabel(p.state, p.interactive).padEnd(15)}` +
      ` ${color(formatUptime(p.uptime_sec).padEnd(7))}` +
      ` ${String(p.mem_mb + 'MB').padEnd(7)}` +
      ` ${String(cpuStr).padEnd(5)}` +
      ` ${shortPath(p.cwd)}`
    )
  }

  // ── Containers ─────────────────────────────────────────────────────
  if (containers.length > 0) {
    console.log()
    console.log(chalk.bold(`  Containers`) + chalk.gray(` (${containers.length})`))
    console.log(chalk.gray(`  ${line}`))
    for (const c of containers) {
      console.log(`  ${chalk.cyan(c.name.padEnd(30))} ${c.status.padEnd(20)} ${chalk.gray(c.image)}`)
    }
  }

  // ── Alerts ─────────────────────────────────────────────────────────
  if (alerts.length > 0) {
    console.log()
    console.log(chalk.red.bold(`  Alerts`))
    console.log(chalk.gray(`  ${line}`))
    for (const a of alerts) {
      const icon = a.level === 'critical' ? chalk.red('✖') : chalk.yellow('⚠')
      const color = a.level === 'critical' ? chalk.red : chalk.yellow
      console.log(`  ${icon} ${color(a.msg)}`)
    }
  }

  console.log()
}
