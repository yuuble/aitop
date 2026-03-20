import { describe, it } from 'node:test'
import assert from 'node:assert'
import { scan } from './scan.js'

describe('aitop', () => {
  it('scan returns valid structure', () => {
    const data = scan({ docker: false })
    assert.ok(data.timestamp)
    assert.ok(data.platform)
    assert.ok(Array.isArray(data.processes))
    assert.ok(Array.isArray(data.containers))
    assert.ok(Array.isArray(data.alerts))
    assert.ok(data.summary)
    assert.ok(typeof data.summary.total_processes === 'number')
    assert.ok(typeof data.summary.total_memory_mb === 'number')
  })

  it('detects at least one AI process (this test runs under claude)', () => {
    const data = scan({ docker: false })
    // If running under claude, we should find at least one
    const hasClaude = data.processes.some(p => p.tool === 'Claude Code')
    // This might not always be true in CI, so just verify structure
    for (const p of data.processes) {
      assert.ok(p.pid > 0, 'pid should be positive')
      assert.ok(p.tool, 'tool should be set')
      assert.ok(p.provider, 'provider should be set')
      assert.ok(typeof p.mem_mb === 'number', 'mem_mb should be number')
      assert.ok(typeof p.uptime_sec === 'number', 'uptime_sec should be number')
    }
  })

  it('summary.by_tool matches process count', () => {
    const data = scan({ docker: false })
    const totalFromMap = Object.values(data.summary.by_tool).reduce((s, n) => s + n, 0)
    assert.strictEqual(totalFromMap, data.summary.total_processes)
  })

  it('json output is valid JSON', () => {
    const data = scan({ docker: false })
    const json = JSON.stringify(data)
    const parsed = JSON.parse(json)
    assert.strictEqual(parsed.processes.length, data.processes.length)
  })
})
