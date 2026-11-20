import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

/*
 * 2026-11-20: the stored form of a contract's four rules (contracts.js has the rest). Its own file with no other
 * imports, so the models that embed it (jobs, agreements, placements) never meet an import cycle.
 */
export const RULES = ['exclusivity', 'noticeDays', 'coolingOffDays', 'maxWeeklyHours']

const rule = (value) => new mongoose.Schema({ value, clause: String }, { _id: false })
export const rulesSchema = new mongoose.Schema(
  {
    exclusivity: rule({ type: String, enum: ENUMS.exclusivity }),
    noticeDays: rule(Number),
    coolingOffDays: rule(Number),
    maxWeeklyHours: rule(Number),
  },
  { _id: false },
)
