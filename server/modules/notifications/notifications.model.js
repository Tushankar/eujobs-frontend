import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'
import { LIMITS } from '../../config/limits.js'

const { Schema } = mongoose

/*
 * In-app notifications (Phase 11b). Only the type and its parameters are stored, never finished text: the client
 * renders them in the reader's current language. `target` is the item the notification opens; `section` the sidebar
 * item that counts it; `permission` (admin types) the permission the reader must still hold to see it.
 * `groupKey` collapses repeated events while unread (P11b-Q6); `count` is how many events it holds.
 * `at` is the latest event; a notification is deleted 90 days after it (P11b-Q5).
 */
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ENUMS.notificationType, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    target: { kind: { type: String, required: true }, id: { type: String, required: true } },
    section: String,
    permission: String,
    groupKey: String,
    count: { type: Number, default: 1 },
    at: { type: Date, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
)
notificationSchema.index({ userId: 1, at: -1 })
notificationSchema.index({ userId: 1, readAt: 1, section: 1 })
notificationSchema.index({ userId: 1, groupKey: 1, readAt: 1 })
notificationSchema.index({ at: 1 }, { expireAfterSeconds: LIMITS.notifications.retentionDays * 24 * 60 * 60 })

export const Notification = mongoose.model('Notification', notificationSchema)
