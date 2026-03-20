import { execSync } from 'child_process'
import chalk from 'chalk'
import { scan } from './scan.js'

export async function killPid(targetPid) {
  const { processes } = scan({ docker: false })
  const proc = processes.find(p => p.pid === targetPid)

  if (!proc) {
    console.log(chalk.red(`  PID ${targetPid} is not a recognized AI process.`))
    console.log(chalk.gray(`  Use aitop to see active AI processes first.`))
    process.exit(1)
  }

  console.log(chalk.yellow(`  Killing ${proc.tool} — PID ${proc.pid} (${proc.user}, ${proc.mem_mb}MB)`))

  try {
    process.kill(targetPid, 'SIGTERM')
    // Wait briefly and check
    await new Promise(r => setTimeout(r, 500))
    try {
      process.kill(targetPid, 0) // check if still alive
      console.log(chalk.yellow(`  Process still alive, sending SIGKILL...`))
      process.kill(targetPid, 'SIGKILL')
    } catch {
      // Process gone — good
    }
    console.log(chalk.green(`  Done.`))
  } catch (e) {
    console.log(chalk.red(`  Failed: ${e.message}`))
    console.log(chalk.gray(`  Try: sudo aitop --kill ${targetPid}`))
  }
}

export async function killAll() {
  const { processes } = scan({ docker: false })
  const myPpid = process.ppid

  // Don't kill the process that's running aitop
  const targets = processes.filter(p => p.pid !== myPpid)

  if (targets.length === 0) {
    console.log(chalk.green(`  No AI processes to kill.`))
    return
  }

  console.log(chalk.red.bold(`  KILLING ${targets.length} AI PROCESSES`))
  if (myPpid && processes.find(p => p.pid === myPpid)) {
    console.log(chalk.gray(`  Keeping PID ${myPpid} (your current session)`))
  }
  console.log()

  let killed = 0
  for (const p of targets) {
    try {
      process.kill(p.pid, 'SIGTERM')
      console.log(chalk.yellow(`  ✖ PID ${String(p.pid).padEnd(8)} ${p.tool.padEnd(14)} ${p.mem_mb}MB freed`))
      killed++
    } catch (e) {
      console.log(chalk.red(`  ✗ PID ${String(p.pid).padEnd(8)} ${p.tool.padEnd(14)} failed: ${e.message}`))
    }
  }

  const freedMb = targets.filter((_, i) => i < killed).reduce((s, p) => s + p.mem_mb, 0)
  console.log()
  console.log(chalk.green(`  ${killed}/${targets.length} killed — ~${freedMb}MB freed`))
}
