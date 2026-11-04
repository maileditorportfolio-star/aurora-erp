import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { dashboardData } from '../services/dashboard.service';
import { ApiError } from '../utils/ApiError';

export const dashboardController = {
  overview: asyncHandler(async (req, res) => {
    if (!req.organizationId) throw ApiError.forbidden('Select an organization');
    const months = Math.min(24, Math.max(3, Number(req.query.months) || 12));
    return sendSuccess(res, await dashboardData(req.organizationId, months));
  }),
};
