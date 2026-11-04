import { Types } from 'mongoose';
import { Notification } from '../models';
import { logger } from '../config/logger';

interface NotificationInput {
  organization: Types.ObjectId;
  user?: Types.ObjectId | null;
  type?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  link?: string;
  meta?: Record<string, unknown>;
}

export async function createNotification(input: NotificationInput) {
  try {
    return await Notification.create({
      organization: input.organization,
      user: input.user ?? null,
      type: input.type ?? 'info',
      title: input.title,
      message: input.message,
      link: input.link,
      meta: input.meta,
    });
  } catch (error) {
    logger.warn({ err: error }, 'Failed to create notification');
    return null;
  }
}

export async function createManyNotifications(inputs: NotificationInput[]) {
  if (!inputs.length) return [];
  try {
    return await Notification.insertMany(
      inputs.map((input) => ({
        organization: input.organization,
        user: input.user ?? null,
        type: input.type ?? 'info',
        title: input.title,
        message: input.message,
        link: input.link,
        meta: input.meta,
      })),
    );
  } catch (error) {
    logger.warn({ err: error }, 'Failed to create notifications');
    return [];
  }
}
