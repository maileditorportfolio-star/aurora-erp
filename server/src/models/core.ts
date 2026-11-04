import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { applyTenant, schemaOptions } from './helpers';
import { ROLES, type RoleKey } from '../config/permissions';

/* ────────────────────────────── Organization ────────────────────────────── */

export interface OrganizationSettings {
  currency: string;
  timezone: string;
  locale: string;
  dateFormat: string;
  taxRate: number;
  invoicePrefix: string;
  quotationPrefix: string;
  salesOrderPrefix: string;
  purchaseOrderPrefix: string;
  fiscalYearStart: number;
  invoiceDueDays: number;
  address: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  industry?: string;
  website?: string;
}

export interface IOrganization {
  name: string;
  slug: string;
  legalName?: string;
  email?: string;
  phone?: string;
  logoUrl?: string;
  brandColor?: string;
  appName?: string;
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'trial' | 'suspended' | 'cancelled';
  trialEndsAt?: Date;
  owner?: Types.ObjectId;
  settings: OrganizationSettings;
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<OrganizationSettings>(
  {
    currency: { type: String, default: 'USD', uppercase: true, trim: true },
    timezone: { type: String, default: 'UTC' },
    locale: { type: String, default: 'en-US' },
    dateFormat: { type: String, default: 'MMM d, yyyy' },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    invoicePrefix: { type: String, default: 'INV', trim: true },
    quotationPrefix: { type: String, default: 'QUO', trim: true },
    salesOrderPrefix: { type: String, default: 'SO', trim: true },
    purchaseOrderPrefix: { type: String, default: 'PO', trim: true },
    fiscalYearStart: { type: Number, default: 1, min: 1, max: 12 },
    invoiceDueDays: { type: Number, default: 30, min: 0 },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },
    industry: String,
    website: String,
  },
  { _id: false },
);

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9][a-z0-9-]{1,62}$/,
    },
    legalName: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    logoUrl: String,
    brandColor: { type: String, default: '#4f46e5' },
    appName: { type: String, trim: true },
    plan: {
      type: String,
      enum: ['starter', 'professional', 'enterprise'],
      default: 'professional',
    },
    status: {
      type: String,
      enum: ['active', 'trial', 'suspended', 'cancelled'],
      default: 'trial',
    },
    trialEndsAt: Date,
    owner: { type: Schema.Types.ObjectId, ref: 'User' },
    settings: { type: settingsSchema, default: () => ({}) },
    onboardingCompleted: { type: Boolean, default: false },
  },
  schemaOptions,
);

organizationSchema.index({ status: 1 });

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);
export type OrganizationDocument = HydratedDocument<IOrganization>;

/* ─────────────────────────────────── User ───────────────────────────────── */

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  isSuperAdmin: boolean;
  status: 'active' | 'invited' | 'suspended';
  avatarUrl?: string;
  phone?: string;
  jobTitle?: string;
  timezone?: string;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    isSuperAdmin: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'invited', 'suspended'], default: 'active' },
    avatarUrl: String,
    phone: String,
    jobTitle: String,
    timezone: { type: String, default: 'UTC' },
    lastLoginAt: Date,
    passwordChangedAt: Date,
    mustChangePassword: { type: Boolean, default: false },
  },
  schemaOptions,
);

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', userSchema);
export type UserDocument = HydratedDocument<IUser>;

/* ──────────────────────────────── Membership ────────────────────────────── */

export interface IMembership {
  organization: Types.ObjectId;
  user: Types.ObjectId;
  role: RoleKey;
  permissions: { grants: string[]; revokes: string[] };
  status: 'active' | 'invited' | 'suspended';
  title?: string;
  invitedBy?: Types.ObjectId;
  joinedAt?: Date;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<IMembership>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ROLES, required: true, default: 'employee' },
    permissions: {
      grants: { type: [String], default: [] },
      revokes: { type: [String], default: [] },
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'suspended'],
      default: 'active',
    },
    title: String,
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    joinedAt: Date,
    lastActiveAt: Date,
  },
  schemaOptions,
);

membershipSchema.index({ organization: 1, user: 1 }, { unique: true });
membershipSchema.index({ organization: 1, role: 1, status: 1 });

applyTenant(membershipSchema);

export const Membership = mongoose.model<IMembership>('Membership', membershipSchema);
export type MembershipDocument = HydratedDocument<IMembership>;

/* ─────────────────────────────── RefreshToken ───────────────────────────── */

export interface IRefreshToken {
  user: Types.ObjectId;
  organization?: Types.ObjectId;
  membership?: Types.ObjectId;
  tokenHash: string;
  family: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedByHash?: string;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization' },
    membership: { type: Schema.Types.ObjectId, ref: 'Membership' },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null },
    replacedByHash: String,
    userAgent: String,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', refreshTokenSchema);

/* ───────────────────────────────── Counter ──────────────────────────────── */

export interface ICounter {
  organization: Types.ObjectId;
  key: string;
  value: number;
}

const counterSchema = new Schema<ICounter>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    key: { type: String, required: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

counterSchema.index({ organization: 1, key: 1 }, { unique: true });

export const Counter = mongoose.model<ICounter>('Counter', counterSchema);

/* ──────────────────────────────── AuditLog ──────────────────────────────── */

export interface IAuditLog {
  organization?: Types.ObjectId;
  actor?: Types.ObjectId;
  actorName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  path: string;
  statusCode: number;
  ip?: string;
  userAgent?: string;
  changes?: unknown;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorName: String,
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: String,
    method: String,
    path: String,
    statusCode: Number,
    ip: String,
    userAgent: String,
    changes: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

auditLogSchema.index({ organization: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

/* ─────────────────────────────── Notification ───────────────────────────── */

export interface INotification {
  organization: Types.ObjectId;
  user?: Types.ObjectId | null;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  readAt?: Date | null;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info',
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: String,
    isRead: { type: Boolean, default: false },
    readAt: Date,
    meta: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

notificationSchema.index({ organization: 1, user: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);

/* Keep the RoleKey import referenced for downstream type augmentation. */
export type { RoleKey };
