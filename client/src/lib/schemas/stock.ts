export interface Option {
  id: string;
  name: string;
  code?: string;
  sku?: string;
  unit?: string;
}

export interface StockLevel {
  id: string;
  product?: {
    id?: string;
    name?: string;
    sku?: string;
    unit?: string;
    stock?: number;
    reserved?: number;
    reorderPoint?: number;
  } | string;
  warehouse?: { id?: string; name?: string; code?: string } | string;
  quantity: number;
  reserved?: number;
  reorderPoint?: number;
  updatedAt?: string;
}

export interface StockMovement {
  id: string;
  product?: { id?: string; name?: string; sku?: string; unit?: string } | string;
  warehouse?: { id?: string; name?: string; code?: string } | string;
  type: string;
  quantity: number;
  direction: 'in' | 'out';
  referenceType?: string;
  referenceNumber?: string;
  note?: string;
  balanceAfter?: number;
  createdBy?: { id?: string; name?: string } | string;
  createdAt?: string;
}
