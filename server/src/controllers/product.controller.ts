import type { Request } from 'express';
import { Category, Product, StockLevel, StockMovement, Supplier, Warehouse } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, searchFilter } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { adjustStock, receiveStock, transferStock } from '../services/inventory.service';
import { Types } from 'mongoose';

async function assertReferences(req: Request, data: Record<string, unknown>) {
  const organization = req.organizationId;
  const checks: Promise<unknown>[] = [];
  if (data.category) {
    checks.push(
      Category.exists({ _id: data.category, organization }).then((exists) => {
        if (!exists) throw ApiError.validation('Category not found');
      }),
    );
  }
  if (data.supplier) {
    checks.push(
      Supplier.exists({ _id: data.supplier, organization }).then((exists) => {
        if (!exists) throw ApiError.validation('Vendor not found');
      }),
    );
  }
  if (data.warehouse) {
    checks.push(
      Warehouse.exists({ _id: data.warehouse, organization }).then((exists) => {
        if (!exists) throw ApiError.validation('Warehouse not found');
      }),
    );
  }
  await Promise.all(checks);
}

export const productController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-createdAt',
      defaultLimit: 20,
    });
    const filter: Record<string, unknown> = {
      organization: req.organizationId,
      ...searchFilter(pagination.search, ['name', 'sku', 'barcode', 'description', 'tags']),
    };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.supplier) filter.supplier = req.query.supplier;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.lowStock === 'true') {
      filter.$expr = {
        $and: [
          { $eq: ['$trackInventory', true] },
          { $eq: ['$type', 'goods'] },
          { $lte: ['$stock', '$reorderPoint'] },
        ],
      };
    }

    const [items, total, lowStockCount] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name color')
        .populate('supplier', 'name')
        .populate('warehouse', 'name code')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Product.countDocuments(filter),
      Product.countDocuments({
        organization: req.organizationId,
        status: 'active',
        trackInventory: true,
        type: 'goods',
        $expr: { $lte: ['$stock', '$reorderPoint'] },
      }),
    ]);

    return sendPaginated(res, items, pagination.meta(total), { lowStock: lowStockCount });
  }),

  get: asyncHandler(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, organization: req.organizationId })
      .populate('category', 'name color')
      .populate('supplier', 'name email phone')
      .populate('warehouse', 'name code')
      .lean();
    if (!product) throw ApiError.notFound('Product');
    return sendSuccess(res, product);
  }),

  create: asyncHandler(async (req, res) => {
    const { stock: initialStock = 0, ...body } = req.body as Record<string, unknown>;
    await assertReferences(req, body);
    if (body.type !== 'service' && body.trackInventory !== false && !body.warehouse) {
      const defaultWarehouse = await Warehouse.findOne({
        organization: req.organizationId,
        isDefault: true,
      }).lean();
      if (defaultWarehouse) body.warehouse = defaultWarehouse._id;
    }

    const product = await Product.create({
      ...body,
      organization: req.organizationId!,
      stock: 0,
      reserved: 0,
      createdBy: req.user?.id,
    });
    if (Number(initialStock) > 0 && product.trackInventory && product.type === 'goods') {
      await receiveStock({
        organization: new Types.ObjectId(req.organizationId),
        productId: product._id,
        warehouseId: product.warehouse,
        quantity: Number(initialStock),
        note: 'Opening stock',
        reference: { type: 'opening' },
        userId: req.user ? new Types.ObjectId(req.user.id) : undefined,
      });
      const fresh = await Product.findById(product._id);
      if (fresh) return sendCreated(res, fresh.toJSON());
    }
    return sendCreated(res, product.toJSON());
  }),

  update: asyncHandler(async (req, res) => {
    const body = { ...(req.body as Record<string, unknown>) };
    delete body.stock;
    delete body.reserved;
    delete body.organization;
    await assertReferences(req, body);
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, organization: req.organizationId },
      body,
      { new: true, runValidators: true },
    );
    if (!product) throw ApiError.notFound('Product');
    return sendSuccess(res, product.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!product) throw ApiError.notFound('Product');
    if (product.stock > 0) {
      throw ApiError.conflict('Products with stock on hand cannot be deleted. Adjust stock to zero first.');
    }
    await product.softDelete();
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),

  byBarcode: asyncHandler(async (req, res) => {
    const code = String(req.params.code);
    const product = await Product.findOne({
      organization: req.organizationId,
      $or: [{ barcode: code }, { sku: code.toUpperCase() }],
    })
      .populate('category', 'name')
      .populate('warehouse', 'name code')
      .lean();
    if (!product) throw ApiError.notFound('Product');
    return sendSuccess(res, product);
  }),

  levels: asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { organization: req.organizationId };
    if (req.query.productId) filter.product = req.query.productId;
    if (req.query.warehouseId) filter.warehouse = req.query.warehouseId;
    if (req.query.lowStock === 'true') {
      filter.$expr = { $lte: ['$quantity', '$reorderPoint'] };
    }
    const levels = await StockLevel.find(filter)
      .populate('product', 'name sku unit stock reserved reorderPoint')
      .populate('warehouse', 'name code')
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
    return sendSuccess(res, levels);
  }),

  movements: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-createdAt',
      defaultLimit: 30,
    });
    const filter: Record<string, unknown> = { organization: req.organizationId };
    if (req.query.productId) filter.product = req.query.productId;
    if (req.query.warehouseId) filter.warehouse = req.query.warehouseId;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.from || req.query.to) {
      const range: Record<string, Date> = {};
      if (req.query.from) range.$gte = new Date(String(req.query.from));
      if (req.query.to) {
        const to = new Date(String(req.query.to));
        to.setUTCHours(23, 59, 59, 999);
        range.$lte = to;
      }
      filter.createdAt = range;
    }
    const [items, total] = await Promise.all([
      StockMovement.find(filter)
        .populate('product', 'name sku unit')
        .populate('warehouse', 'name code')
        .populate('createdBy', 'name')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      StockMovement.countDocuments(filter),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),

  adjust: asyncHandler(async (req, res) => {
    const result = await adjustStock({
      organization: new Types.ObjectId(req.organizationId),
      productId: new Types.ObjectId(req.body.productId),
      warehouseId: req.body.warehouseId ? new Types.ObjectId(req.body.warehouseId) : undefined,
      targetQuantity: Number(req.body.quantity),
      note: req.body.note,
      userId: req.user ? new Types.ObjectId(req.user.id) : undefined,
    });
    return sendSuccess(res, {
      productId: req.body.productId,
      quantity: result.level.quantity,
      stock: result.product.stock,
    });
  }),

  transfer: asyncHandler(async (req, res) => {
    await transferStock({
      organization: new Types.ObjectId(req.organizationId),
      productId: new Types.ObjectId(req.body.productId),
      fromWarehouseId: new Types.ObjectId(req.body.fromWarehouseId),
      toWarehouseId: new Types.ObjectId(req.body.toWarehouseId),
      quantity: Number(req.body.quantity),
      note: req.body.note,
      userId: req.user ? new Types.ObjectId(req.user.id) : undefined,
    });
    return sendSuccess(res, { transferred: true });
  }),

  lowStock: asyncHandler(async (req, res) => {
    const products = await Product.find({
      organization: req.organizationId,
      status: 'active',
      trackInventory: true,
      type: 'goods',
      $expr: { $lte: ['$stock', '$reorderPoint'] },
    })
      .populate('category', 'name')
      .populate('supplier', 'name email')
      .sort({ stock: 1 })
      .limit(50)
      .lean();
    return sendSuccess(res, products);
  }),
};
