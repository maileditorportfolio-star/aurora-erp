import { Types } from 'mongoose';
import { Product, StockLevel, StockMovement, Warehouse } from '../models';
import { ApiError } from '../utils/ApiError';
import { round2 } from '../utils/money';
import { createNotification } from './notification.service';

export type StockMovementType =
  | 'receipt'
  | 'issue'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'reservation'
  | 'release';

interface StockReference {
  type?: string;
  id?: Types.ObjectId;
  number?: string;
}

interface StockChangeInput {
  organization: Types.ObjectId;
  productId: Types.ObjectId;
  warehouseId?: Types.ObjectId | null;
  quantity: number;
  type: StockMovementType;
  direction: 'in' | 'out';
  reference?: StockReference;
  note?: string;
  userId?: Types.ObjectId;
  allowNegative?: boolean;
}

async function resolveWarehouse(
  organization: Types.ObjectId,
  productId: Types.ObjectId,
  warehouseId?: Types.ObjectId | null,
): Promise<Types.ObjectId> {
  if (warehouseId) return warehouseId;
  const product = await Product.findOne({ _id: productId, organization }).select('warehouse').lean();
  if (product?.warehouse) return product.warehouse;
  const defaultWarehouse = await Warehouse.findOne({ organization, isDefault: true }).select('_id').lean();
  if (!defaultWarehouse) throw ApiError.validation('No warehouse is configured for this organization');
  return defaultWarehouse._id;
}

async function ensureLevel(
  organization: Types.ObjectId,
  productId: Types.ObjectId,
  warehouseId: Types.ObjectId,
  reorderPoint: number,
) {
  const existing = await StockLevel.findOne({ product: productId, warehouse: warehouseId });
  if (existing) return existing;
  return StockLevel.create({
    organization,
    product: productId,
    warehouse: warehouseId,
    quantity: 0,
    reserved: 0,
    reorderPoint,
  });
}

async function recordMovement(
  input: StockChangeInput,
  balanceAfter: number,
  warehouseId: Types.ObjectId,
) {
  return StockMovement.create({
    organization: input.organization,
    product: input.productId,
    warehouse: warehouseId,
    type: input.type,
    quantity: input.quantity,
    direction: input.direction,
    referenceType: input.reference?.type,
    referenceId: input.reference?.id,
    referenceNumber: input.reference?.number,
    note: input.note,
    balanceAfter,
    createdBy: input.userId,
  });
}

async function maybeWarnLowStock(
  organization: Types.ObjectId,
  product: { _id: Types.ObjectId; name: string; stock: number; reorderPoint: number; trackInventory: boolean },
) {
  if (!product.trackInventory) return;
  if (product.stock > product.reorderPoint) return;
  await createNotification({
    organization,
    type: 'warning',
    title: 'Low stock alert',
    message: `${product.name} is at ${round2(product.stock)} units (reorder point ${product.reorderPoint}).`,
    link: '/inventory/products',
    meta: { productId: String(product._id) },
  });
}

export async function applyStockChange(input: StockChangeInput) {
  if (input.quantity <= 0) throw ApiError.validation('Stock quantity must be greater than zero');
  const product = await Product.findOne({ _id: input.productId, organization: input.organization });
  if (!product) throw ApiError.notFound('Product');
  if (!product.trackInventory || product.type === 'service') return null;

  const warehouseId = await resolveWarehouse(
    input.organization,
    input.productId,
    input.warehouseId ?? product.warehouse,
  );
  const level = await ensureLevel(
    input.organization,
    input.productId,
    warehouseId,
    product.reorderPoint,
  );

  if (input.direction === 'out' && !input.allowNegative && level.quantity < input.quantity) {
    throw ApiError.validation(
      `Insufficient stock for ${product.name}: available ${level.quantity}, requested ${input.quantity}`,
    );
  }

  const delta = input.direction === 'in' ? input.quantity : -input.quantity;
  const updated = await StockLevel.findOneAndUpdate(
    {
      _id: level._id,
      ...(delta < 0 && !input.allowNegative ? { quantity: { $gte: input.quantity } } : {}),
    },
    { $inc: { quantity: delta } },
    { new: true },
  );
  if (!updated) throw ApiError.validation(`Insufficient stock for ${product.name}`);

  const productBefore = product.stock;
  product.stock = round2(product.stock + delta);
  await product.save();

  await recordMovement(input, updated.quantity, warehouseId);

  if (
    product.trackInventory &&
    product.stock <= product.reorderPoint &&
    productBefore > product.reorderPoint
  ) {
    await maybeWarnLowStock(input.organization, product);
  }

  return { level: updated, product };
}

export async function receiveStock(
  input: Omit<StockChangeInput, 'direction' | 'type'> & { type?: 'receipt' | 'transfer_in' },
) {
  return applyStockChange({ ...input, direction: 'in', type: input.type ?? 'receipt' });
}

export async function issueStock(
  input: Omit<StockChangeInput, 'direction' | 'type'> & { type?: 'issue' | 'transfer_out' },
) {
  return applyStockChange({ ...input, direction: 'out', type: input.type ?? 'issue' });
}

export async function adjustStock(input: {
  organization: Types.ObjectId;
  productId: Types.ObjectId;
  warehouseId?: Types.ObjectId | null;
  targetQuantity: number;
  note?: string;
  userId?: Types.ObjectId;
}) {
  if (input.targetQuantity < 0) throw ApiError.validation('Stock cannot be negative');
  const product = await Product.findOne({ _id: input.productId, organization: input.organization });
  if (!product) throw ApiError.notFound('Product');
  if (!product.trackInventory) throw ApiError.validation('This product does not track inventory');
  const warehouseId = await resolveWarehouse(
    input.organization,
    input.productId,
    input.warehouseId ?? product.warehouse,
  );
  const level = await ensureLevel(
    input.organization,
    input.productId,
    warehouseId,
    product.reorderPoint,
  );
  const delta = round2(input.targetQuantity - level.quantity);
  if (delta === 0) return { level, product };

  const updated = await StockLevel.findByIdAndUpdate(
    level._id,
    { $inc: { quantity: delta } },
    { new: true },
  );
  if (!updated) throw ApiError.internal('Failed to adjust stock');

  product.stock = round2(product.stock + delta);
  await product.save();
  await recordMovement(
    {
      organization: input.organization,
      productId: input.productId,
      quantity: Math.abs(delta),
      type: 'adjustment',
      direction: delta > 0 ? 'in' : 'out',
      note: input.note ?? `Adjusted to ${input.targetQuantity}`,
      userId: input.userId,
    },
    updated.quantity,
    warehouseId,
  );
  if (product.stock <= product.reorderPoint) {
    await maybeWarnLowStock(input.organization, product);
  }
  return { level: updated, product };
}

export async function reserveStock(input: {
  organization: Types.ObjectId;
  productId: Types.ObjectId;
  warehouseId?: Types.ObjectId | null;
  quantity: number;
  reference?: StockReference;
  userId?: Types.ObjectId;
}) {
  const warehouseId = await resolveWarehouse(
    input.organization,
    input.productId,
    input.warehouseId,
  );
  const level = await StockLevel.findOne({
    organization: input.organization,
    product: input.productId,
    warehouse: warehouseId,
  });
  if (!level || level.quantity - level.reserved < input.quantity) {
    throw ApiError.validation('Insufficient available stock to reserve');
  }
  const updated = await StockLevel.findOneAndUpdate(
    {
      _id: level._id,
      $expr: { $gte: [{ $subtract: ['$quantity', '$reserved'] }, input.quantity] },
    },
    { $inc: { reserved: input.quantity } },
    { new: true },
  );
  if (!updated) throw ApiError.validation('Insufficient available stock to reserve');
  await Product.updateOne(
    { _id: input.productId, organization: input.organization },
    { $inc: { reserved: input.quantity } },
  );
  await recordMovement(
    {
      organization: input.organization,
      productId: input.productId,
      quantity: input.quantity,
      type: 'reservation',
      direction: 'out',
      reference: input.reference,
      userId: input.userId,
    },
    updated.quantity - updated.reserved,
    warehouseId,
  );
  return updated;
}

export async function releaseReservation(input: {
  organization: Types.ObjectId;
  productId: Types.ObjectId;
  warehouseId?: Types.ObjectId | null;
  quantity: number;
  reference?: StockReference;
  userId?: Types.ObjectId;
}) {
  const warehouseId = await resolveWarehouse(
    input.organization,
    input.productId,
    input.warehouseId,
  );
  const updated = await StockLevel.findOneAndUpdate(
    { organization: input.organization, product: input.productId, warehouse: warehouseId },
    { $inc: { reserved: -input.quantity } },
    { new: true },
  );
  if (!updated) return null;
  if (updated.reserved < 0) updated.reserved = 0;
  await Product.updateOne(
    { _id: input.productId, organization: input.organization },
    { $inc: { reserved: -input.quantity } },
  );
  await recordMovement(
    {
      organization: input.organization,
      productId: input.productId,
      quantity: input.quantity,
      type: 'release',
      direction: 'in',
      reference: input.reference,
      userId: input.userId,
    },
    updated.quantity - updated.reserved,
    warehouseId,
  );
  return updated;
}

/**
 * Converts an existing reservation into an outbound stock issue.
 */
export async function commitReservation(input: {
  organization: Types.ObjectId;
  productId: Types.ObjectId;
  warehouseId?: Types.ObjectId | null;
  quantity: number;
  reference?: StockReference;
  userId?: Types.ObjectId;
}) {
  const warehouseId = await resolveWarehouse(
    input.organization,
    input.productId,
    input.warehouseId,
  );
  const updated = await StockLevel.findOneAndUpdate(
    { organization: input.organization, product: input.productId, warehouse: warehouseId },
    { $inc: { quantity: -input.quantity, reserved: -input.quantity } },
    { new: true },
  );
  if (!updated) throw ApiError.validation('Stock reservation not found');
  const product = await Product.findOneAndUpdate(
    { _id: input.productId, organization: input.organization },
    { $inc: { stock: -input.quantity, reserved: -input.quantity } },
    { new: true },
  );
  await recordMovement(
    {
      organization: input.organization,
      productId: input.productId,
      quantity: input.quantity,
      type: 'issue',
      direction: 'out',
      reference: input.reference,
      userId: input.userId,
    },
    updated.quantity,
    warehouseId,
  );
  if (product && product.stock <= product.reorderPoint) {
    await maybeWarnLowStock(input.organization, product);
  }
  return updated;
}

export async function transferStock(input: {
  organization: Types.ObjectId;
  productId: Types.ObjectId;
  fromWarehouseId: Types.ObjectId;
  toWarehouseId: Types.ObjectId;
  quantity: number;
  note?: string;
  userId?: Types.ObjectId;
}) {
  if (String(input.fromWarehouseId) === String(input.toWarehouseId)) {
    throw ApiError.validation('Source and destination warehouses must differ');
  }
  await issueStock({
    organization: input.organization,
    productId: input.productId,
    warehouseId: input.fromWarehouseId,
    quantity: input.quantity,
    type: 'transfer_out',
    note: input.note,
    userId: input.userId,
  });
  await receiveStock({
    organization: input.organization,
    productId: input.productId,
    warehouseId: input.toWarehouseId,
    quantity: input.quantity,
    type: 'transfer_in',
    note: input.note,
    userId: input.userId,
  });
}
