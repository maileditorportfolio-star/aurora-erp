import { Schema, type Types } from 'mongoose';

export interface IDocumentLine {
  product?: Types.ObjectId | null;
  description: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discountRate: number;
  taxRate: number;
  discount: number;
  tax: number;
  total: number;
}

export const documentLineSchema = new Schema<IDocumentLine>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    discountRate: { type: Number, default: 0, min: 0, max: 100 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
  },
  { _id: true },
);
