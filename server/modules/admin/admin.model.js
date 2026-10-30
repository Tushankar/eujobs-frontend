import mongoose from 'mongoose'
import { ENUMS } from '../../config/enums.js'

const { Schema } = mongoose

/* Permission catalogue (M-156); labels are client i18n keys. `id` is a real field, so the virtual is off. */
const permissionSchema = new Schema(
  {
    id: { type: String, enum: ENUMS.permission, required: true, unique: true },
    group: { type: String, enum: ENUMS.permissionGroup, required: true },
    order: { type: Number, required: true },
  },
  { timestamps: true, id: false },
)

/* Admin roles (M-157, M-158). `system` marks the three seeded Figma roles. */
const adminRoleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, unique: true },
    description: String,
    scope: { type: String, enum: ENUMS.roleScope },
    permissions: [{ type: String, enum: ENUMS.permission }],
    status: { type: String, enum: ENUMS.roleStatus, default: 'active' },
    system: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

/* Audit log (M-162, M-163): `type` is an i18n key, `params` fill it. */
const auditEventSchema = new Schema(
  {
    type: { type: String, required: true },
    category: { type: String, enum: ENUMS.auditCategory, required: true },
    actor: {
      type: { type: String, enum: ENUMS.actorType, required: true },
      id: Schema.Types.ObjectId,
      name: String,
    },
    target: { type: { type: String }, id: Schema.Types.ObjectId },
    params: Schema.Types.Mixed,
    at: { type: Date, default: Date.now },
  },
  { timestamps: true },
)
auditEventSchema.index({ at: -1 })
auditEventSchema.index({ category: 1, at: -1 })

export const Permission = mongoose.model('Permission', permissionSchema)
export const AdminRole = mongoose.model('AdminRole', adminRoleSchema)
export const AuditEvent = mongoose.model('AuditEvent', auditEventSchema)
