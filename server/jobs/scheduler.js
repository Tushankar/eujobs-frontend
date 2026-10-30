import { DateTime } from 'luxon'
import { config } from '../config/env.js'
import { JobRun, ScheduledTask } from './models.js'

/*
 * In-process scheduler (OD10, §2.7): a 60 s tick over MongoDB due-records, plus one tick at startup
 * that catches up on anything missed while the server was off. Test mode starts no timer; the
 * /_test/scheduler/tick route runs a tick as of a given time.
 */
const TICK_MS = 60 * 1000
const MAX_ATTEMPTS = 3
const STALE_RUNNING_MS = 10 * 60 * 1000

/** Task handlers by type (jobs/tasks/<type>.js registers each one in its phase). */
export const taskHandlers = {}

/** Daily slots: { name, hour, run(now) } at `hour`:00 server time (U7, U32). */
export const dailyJobs = []

/** Creates or collapses the pending task with this key (a pending key is unique). */
export function scheduleTask({ type, key, dueAt, payload }) {
  return ScheduledTask.findOneAndUpdate(
    { key, status: 'pending' },
    { $set: { type, dueAt, payload }, $setOnInsert: { attempts: 0 } },
    { upsert: true, returnDocument: 'after' },
  )
}

function claimNextTask(now) {
  return ScheduledTask.findOneAndUpdate(
    { status: 'pending', dueAt: { $lte: now } },
    { $set: { status: 'running', lockedAt: now }, $inc: { attempts: 1 } },
    { sort: { dueAt: 1 }, returnDocument: 'after' },
  )
}

async function runTask(task, now) {
  try {
    await taskHandlers[task.type](task.payload, task)
    await ScheduledTask.updateOne({ _id: task._id }, { status: 'done', lastError: null })
  } catch (error) {
    const failed = task.attempts >= MAX_ATTEMPTS
    if (failed) console.error(`Scheduled task ${task.type} (${task.key}) failed after ${MAX_ATTEMPTS} attempts: ${error.message}`)
    // A retry is due on the next tick. If a newer pending task took the key meanwhile, this one is dropped.
    await ScheduledTask.updateOne(
      { _id: task._id },
      { status: failed ? 'failed' : 'pending', dueAt: new Date(now.getTime() + TICK_MS), lastError: error.message },
    ).catch(() => ScheduledTask.updateOne({ _id: task._id }, { status: 'failed', lastError: error.message }))
  }
}

/** The most recent `hour`:00 slot at or before `now`, in server time. */
function lastSlot(now, hour) {
  const today = DateTime.fromJSDate(now).set({ hour, minute: 0, second: 0, millisecond: 0 })
  return (today > DateTime.fromJSDate(now) ? today.minus({ days: 1 }) : today).toJSDate()
}

async function runDailyJobs(now) {
  for (const job of dailyJobs) {
    await JobRun.updateOne({ name: job.name }, { $setOnInsert: { lastRunAt: null } }, { upsert: true })
    const claimed = await JobRun.findOneAndUpdate(
      { name: job.name, $or: [{ lastRunAt: null }, { lastRunAt: { $lt: lastSlot(now, job.hour) } }] },
      { lastRunAt: now },
    )
    if (!claimed) continue
    try {
      await job.run(now)
    } catch (error) {
      console.error(`Daily job ${job.name} failed: ${error.message}`)
      // Restoring the previous run time makes the next tick try again.
      await JobRun.updateOne({ name: job.name }, { lastRunAt: claimed.lastRunAt })
    }
  }
}

export async function tick(now = new Date()) {
  await runDailyJobs(now)
  for (let task = await claimNextTask(now); task; task = await claimNextTask(now)) await runTask(task, now)
}

/** Startup: release tasks left running by a stopped server, catch up once, then tick every 60 s. */
export async function startScheduler() {
  await ScheduledTask.updateMany(
    { status: 'running', lockedAt: { $lt: new Date(Date.now() - STALE_RUNNING_MS) } },
    { status: 'pending' },
  )
  await tick()
  if (!config.isTest) setInterval(() => tick().catch((error) => console.error(`Scheduler tick failed: ${error.message}`)), TICK_MS)
}
