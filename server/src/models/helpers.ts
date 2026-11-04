import type { Schema, Types } from 'mongoose';
import { tenantPlugin } from '../plugins/tenant';
import { softDeletePlugin } from '../plugins/softDelete';

export interface SoftDeleteFields {
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: Types.ObjectId | null;
  softDelete(userId?: Types.ObjectId): Promise<this>;
  restore(): Promise<this>;
}

export const schemaOptions = {
  timestamps: true,
  versionKey: false as const,
  toJSON: {
    virtuals: true,
    transform: (_doc: unknown, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.passwordHash;
      return ret;
    },
  },
};

export function applyTenant(schema: Schema): Schema {
  schema.plugin(tenantPlugin);
  return schema;
}

export function applyTenantSoftDelete(schema: Schema): Schema {
  schema.plugin(tenantPlugin);
  schema.plugin(softDeletePlugin);
  return schema;
}

export function applySoftDelete(schema: Schema): Schema {
  schema.plugin(softDeletePlugin);
  return schema;
}

export function moneyField(defaultValue = 0) {
  return { type: Number, default: defaultValue, min: 0 };
}
