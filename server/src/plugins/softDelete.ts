import mongoose from 'mongoose';

export interface SoftDeleteDocument {
  isDeleted: boolean;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
}

export function softDeletePlugin(schema: mongoose.Schema): void {
  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  });

  const excludeDeleted = function (this: mongoose.Query<unknown, unknown>) {
    const options = this.getOptions() as { withDeleted?: boolean };
    if (options.withDeleted) return;
    const filter = this.getFilter() as Record<string, unknown>;
    if (filter.isDeleted === undefined) {
      this.setQuery({ ...filter, isDeleted: { $ne: true } });
    }
  };

  schema.pre('find', excludeDeleted);
  schema.pre('findOne', excludeDeleted);
  schema.pre('findOneAndUpdate', excludeDeleted);
  schema.pre('countDocuments', excludeDeleted);
  schema.pre('aggregate', function () {
    const options = this.options as { withDeleted?: boolean };
    if (options?.withDeleted) return;
    this.pipeline().push({ $match: { isDeleted: { $ne: true } } });
  });

  schema.methods.softDelete = function (userId?: mongoose.Types.ObjectId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    if (userId) this.deletedBy = userId;
    return this.save();
  };

  schema.methods.restore = function () {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };
}
