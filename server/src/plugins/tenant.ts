import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose, { Types } from 'mongoose';

export interface TenantContext {
  organizationId?: string;
  userId?: string;
  isSuperAdmin?: boolean;
  skipTenant?: boolean;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(context: TenantContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

export function enterTenantContext(context: TenantContext): void {
  storage.enterWith(context);
}

export function currentOrganizationId(): Types.ObjectId | undefined {
  const organizationId = storage.getStore()?.organizationId;
  if (!organizationId || !Types.ObjectId.isValid(organizationId)) return undefined;
  return new Types.ObjectId(organizationId);
}

export function requireOrganizationId(): Types.ObjectId {
  const organizationId = currentOrganizationId();
  if (!organizationId) {
    throw new Error('Tenant context is missing an organization');
  }
  return organizationId;
}

export function asObjectId(value: string | Types.ObjectId): Types.ObjectId {
  return typeof value === 'string' ? new Types.ObjectId(value) : value;
}

/**
 * Applies tenant isolation to every query for schemas that expose an
 * `organization` path. If no tenant context is active (seed scripts, auth
 * lookups, platform jobs) the query is left untouched. Cross-tenant platform
 * operations must explicitly opt out with `skipTenant`.
 */
export function tenantPlugin(schema: mongoose.Schema): void {
  if (!schema.path('organization')) return;

  const scope = function (this: mongoose.Query<unknown, unknown>) {
    const context = storage.getStore();
    if (!context?.organizationId || context.skipTenant) return;
    if (!Types.ObjectId.isValid(context.organizationId)) return;
    const organization = new Types.ObjectId(context.organizationId);
    this.setQuery({ ...this.getFilter(), organization });
  };

  schema.pre('find', scope);
  schema.pre('findOne', scope);
  schema.pre('findOneAndUpdate', scope);
  schema.pre('findOneAndDelete', scope);
  schema.pre('countDocuments', scope);
  schema.pre('estimatedDocumentCount', scope);
  schema.pre('updateOne', scope);
  schema.pre('updateMany', scope);
  schema.pre('deleteOne', scope);
  schema.pre('deleteMany', scope);

  schema.pre('aggregate', function () {
    const context = storage.getStore();
    if (!context?.organizationId || context.skipTenant) return;
    if (!Types.ObjectId.isValid(context.organizationId)) return;
    this.pipeline().unshift({
      $match: { organization: new Types.ObjectId(context.organizationId) },
    });
  });

  schema.pre('validate', function () {
    const context = storage.getStore();
    const doc = this as unknown as { organization?: Types.ObjectId };
    if (!doc.organization && context?.organizationId && Types.ObjectId.isValid(context.organizationId)) {
      doc.organization = new Types.ObjectId(context.organizationId);
    }
  });

  type InsertManyHook = (
    hook: 'insertMany',
    handler: (
      this: unknown,
      next: () => void,
      docs: Array<{ organization?: Types.ObjectId }>,
    ) => void,
  ) => void;

  (schema.pre as unknown as (hook: string, fn: (docs: Array<{ organization?: Types.ObjectId }>) => void | Promise<void>) => void)('insertMany', async (docs) => {
    const context = storage.getStore();
    if (!context?.organizationId || context.skipTenant) return;
    if (!Types.ObjectId.isValid(context.organizationId)) return;
    const organization = new Types.ObjectId(context.organizationId);
    for (const doc of docs ?? []) {
      if (!doc.organization) doc.organization = organization;
    }
  });
}
