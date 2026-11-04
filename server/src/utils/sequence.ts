import { Counter } from '../models/core';
import { Types } from 'mongoose';
import { ApiError } from './ApiError';

interface SequenceOptions {
  prefix?: string;
  pad?: number;
  includeYear?: boolean;
}

export async function nextSequence(
  organizationId: Types.ObjectId | string,
  key: string,
  _options: SequenceOptions = {},
): Promise<number> {
  const organization = new Types.ObjectId(String(organizationId));
  const document = await Counter.findOneAndUpdate(
    { organization, key },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  if (!document) throw ApiError.internal('Failed to generate sequence number');
  return document.value;
}

export async function nextDocumentNumber(
  organizationId: Types.ObjectId | string,
  key: string,
  prefix: string,
  options: { pad?: number; includeYear?: boolean } = {},
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const sequenceKey = options.includeYear === false ? key : `${key}:${year}`;
  const value = await nextSequence(organizationId, sequenceKey);
  const padded = String(value).padStart(options.pad ?? 5, '0');
  return options.includeYear === false ? `${prefix}-${padded}` : `${prefix}-${year}-${padded}`;
}

export async function nextEmployeeCode(organizationId: Types.ObjectId | string): Promise<string> {
  const value = await nextSequence(organizationId, 'employee');
  return `EMP-${String(value).padStart(4, '0')}`;
}

export async function peekSequence(
  organizationId: Types.ObjectId | string,
  key: string,
): Promise<number> {
  const document = await Counter.findOne({
    organization: new Types.ObjectId(String(organizationId)),
    key,
  }).lean();
  return document?.value ?? 0;
}
