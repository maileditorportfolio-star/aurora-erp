import type { Request } from 'express';
import type { Model } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, searchFilter } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';

export interface CrudConfig {
  model: Model<any>;
  resource: string;
  searchFields: string[];
  populate?: string | string[];
  dateField?: string;
  defaultSort?: string;
  sortable?: string[];
  buildFilter?: (req: Request) => Record<string, unknown>;
  beforeCreate?: (data: Record<string, unknown>, req: Request) => Promise<Record<string, unknown>> | Record<string, unknown>;
  beforeUpdate?: (data: Record<string, unknown>, req: Request) => Promise<Record<string, unknown>> | Record<string, unknown>;
  beforeDelete?: (req: Request, id: string) => Promise<void>;
  softDelete?: boolean;
}

function tenantFilter(req: Request): Record<string, unknown> {
  if (!req.organizationId) return {};
  return { organization: req.organizationId };
}

function optionsFor(req: Request) {
  const withDeleted = String(req.query.withDeleted) === 'true' && Boolean(req.user?.isSuperAdmin);
  return withDeleted ? { withDeleted: true } : {};
}

export function createCrudController(config: CrudConfig) {
  const { model } = config;

  const list = asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: config.defaultSort,
    });
    const filter: Record<string, unknown> = {
      ...tenantFilter(req),
      ...searchFilter(pagination.search, config.searchFields),
      ...(config.buildFilter?.(req) ?? {}),
    };

    if (config.dateField && (req.query.from || req.query.to)) {
      const range: Record<string, Date> = {};
      if (req.query.from) range.$gte = new Date(String(req.query.from));
      if (req.query.to) {
        const to = new Date(String(req.query.to));
        to.setUTCHours(23, 59, 59, 999);
        range.$lte = to;
      }
      filter[config.dateField] = range;
    }

    let sort = pagination.sort;
    if (config.sortable?.length) {
      sort = Object.fromEntries(
        Object.entries(sort).filter(([key]) => config.sortable!.includes(key)),
      ) as Record<string, 1 | -1>;
      if (!Object.keys(sort).length) sort = { createdAt: -1 };
    }

    const query = model.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit);
    if (config.populate) query.populate(config.populate as string);
    const [items, total] = await Promise.all([
      query.lean().exec(),
      model.countDocuments(filter).exec(),
    ]);

    return sendPaginated(res, items as unknown[], pagination.meta(total));
  });

  const get = asyncHandler(async (req, res) => {
    const query = model.findOne({ _id: req.params.id, ...tenantFilter(req) }).setOptions(optionsFor(req));
    if (config.populate) query.populate(config.populate as string);
    const document = await query.lean();
    if (!document) throw ApiError.notFound(config.resource);
    return sendSuccess(res, document);
  });

  const create = asyncHandler(async (req, res) => {
    let body = { ...(req.body as Record<string, unknown>) };
    if (config.beforeCreate) body = await config.beforeCreate(body, req);
    if (model.schema.path('organization') && req.organizationId) body.organization = req.organizationId;
    if (model.schema.path('createdBy') && req.user) body.createdBy = req.user.id;
    const document = await model.create(body);
    if (config.populate) await document.populate(config.populate as string);
    return sendCreated(res, document.toJSON());
  });

  const update = asyncHandler(async (req, res) => {
    let body = { ...(req.body as Record<string, unknown>) };
    if (config.beforeUpdate) body = await config.beforeUpdate(body, req);
    if (config.softDelete !== false && body.isDeleted !== undefined) delete body.isDeleted;
    delete body.organization;
    const query = model
      .findOneAndUpdate({ _id: req.params.id, ...tenantFilter(req) }, body, {
        new: true,
        runValidators: true,
      })
      .setOptions(optionsFor(req));
    if (config.populate) query.populate(config.populate as string);
    const document = await query;
    if (!document) throw ApiError.notFound(config.resource);
    return sendSuccess(res, document.toJSON());
  });

  const remove = asyncHandler(async (req, res) => {
    if (config.beforeDelete) await config.beforeDelete(req, req.params.id as string);
    const document = await model
      .findOne({ _id: req.params.id, ...tenantFilter(req) })
      .setOptions(optionsFor(req));
    if (!document) throw ApiError.notFound(config.resource);
    if (config.softDelete !== false && typeof document.softDelete === 'function') {
      await document.softDelete(req.user ? undefined : undefined);
    } else {
      await model.deleteOne({ _id: document._id });
    }
    return sendSuccess(res, { id: String(document._id), deleted: true });
  });

  const restore = asyncHandler(async (req, res) => {
    const document = await model
      .findOneAndUpdate(
        { _id: req.params.id, ...tenantFilter(req) },
        { $set: { isDeleted: false, deletedAt: null, deletedBy: null } },
        { new: true },
      )
      .setOptions({ withDeleted: true });
    if (!document) throw ApiError.notFound(config.resource);
    return sendSuccess(res, document.toJSON());
  });

  return { list, get, create, update, remove, restore };
}
