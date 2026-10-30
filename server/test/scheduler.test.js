import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { JobRun, ScheduledTask } from '../jobs/models.js'
import { dailyJobs, scheduleTask, startScheduler, taskHandlers, tick } from '../jobs/scheduler.js'
import { api, useTestDb } from './helpers/index.js'

useTestDb([ScheduledTask, JobRun])

const TYPE = 'email.message'
const MINUTE = 60 * 1000
let calls = []

function handle(fn = () => {}) {
  calls = []
  taskHandlers[TYPE] = async (payload) => {
    calls.push(payload)
    await fn()
  }
}

afterEach(() => {
  delete taskHandlers[TYPE]
  dailyJobs.length = 0
})

describe('scheduler (OD10, §2.7)', () => {
  it('runs a due task exactly once across two parallel ticks', async () => {
    handle()
    const now = new Date()
    await scheduleTask({ type: TYPE, key: 'once', dueAt: new Date(now.getTime() - 1000), payload: { n: 1 } })
    await scheduleTask({ type: TYPE, key: 'later', dueAt: new Date(now.getTime() + MINUTE), payload: { n: 2 } })
    await Promise.all([tick(now), tick(now)])
    assert.deepEqual(calls, [{ n: 1 }])
    assert.equal((await ScheduledTask.findOne({ key: 'once' })).status, 'done')
    assert.equal((await ScheduledTask.findOne({ key: 'later' })).status, 'pending')
  })

  it('collapses tasks scheduled with the same pending key', async () => {
    const dueAt = new Date(Date.now() + MINUTE)
    await scheduleTask({ type: TYPE, key: 'same', dueAt: new Date(), payload: { v: 1 } })
    await scheduleTask({ type: TYPE, key: 'same', dueAt, payload: { v: 2 } })
    const tasks = await ScheduledTask.find({ key: 'same' })
    assert.equal(tasks.length, 1)
    assert.deepEqual(tasks[0].payload, { v: 2 })
  })

  it('retries a failing task on the next ticks, 3 attempts in all', async () => {
    handle(() => {
      throw new Error('boom')
    })
    const start = new Date()
    await scheduleTask({ type: TYPE, key: 'flaky', dueAt: start })
    await tick(start)
    await tick(start)
    assert.equal(calls.length, 1, 'not retried within the same tick time')
    await tick(new Date(start.getTime() + MINUTE))
    await tick(new Date(start.getTime() + 2 * MINUTE))
    await tick(new Date(start.getTime() + 3 * MINUTE))
    assert.equal(calls.length, 3)
    const task = await ScheduledTask.findOne({ key: 'flaky' })
    assert.equal(task.status, 'failed')
    assert.equal(task.attempts, 3)
    assert.equal(task.lastError, 'boom')
  })

  it('catches up at startup: overdue and stale running tasks and missed daily slots', async () => {
    handle()
    const hourAgo = new Date(Date.now() - 60 * MINUTE)
    await ScheduledTask.create({ type: TYPE, key: 'overdue', dueAt: new Date(Date.now() - 24 * 60 * MINUTE), payload: { k: 'overdue' } })
    await ScheduledTask.create({ type: TYPE, key: 'stale', dueAt: hourAgo, status: 'running', lockedAt: hourAgo, attempts: 1, payload: { k: 'stale' } })
    const ran = []
    dailyJobs.push({ name: 'test-missed', hour: 3, run: () => ran.push('missed') })
    dailyJobs.push({ name: 'test-fresh', hour: 3, run: () => ran.push('fresh') })
    await JobRun.create({ name: 'test-missed', lastRunAt: new Date(Date.now() - 2 * 24 * 60 * MINUTE) })
    await JobRun.create({ name: 'test-fresh', lastRunAt: new Date() })

    await startScheduler()
    assert.deepEqual(calls.map((payload) => payload.k).sort(), ['overdue', 'stale'])
    assert.deepEqual(ran, ['missed'])
    assert.equal(await ScheduledTask.countDocuments({ status: 'done' }), 2)
  })

  it('runs a tick through /_test/scheduler/tick', async () => {
    handle()
    await scheduleTask({ type: TYPE, key: 'via-route', dueAt: new Date('2030-01-01T09:00:00Z'), payload: { r: 1 } })
    await api().post('/api/v1/_test/scheduler/tick').send({ now: '2030-01-01T08:59:00Z' })
    assert.equal(calls.length, 0)
    const res = await api().post('/api/v1/_test/scheduler/tick').send({ now: '2030-01-01T09:00:00Z' })
    assert.equal(res.status, 204)
    assert.deepEqual(calls, [{ r: 1 }])
  })
})
