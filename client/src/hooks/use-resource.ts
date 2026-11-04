'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiRequestError, buildQuery } from '@/lib/api';
import type { ListParams, PaginationMeta } from '@/lib/types';

export interface ResourceListResult<T> {
  data: T[];
  meta: PaginationMeta | null;
}

export function useResourceList<T>(
  endpoint: string,
  params: ListParams = {},
  options: { enabled?: boolean } = {},
) {
  const query = buildQuery(params);
  return useQuery<ResourceListResult<T>>({
    queryKey: [endpoint, 'list', params],
    queryFn: () => api.list<T>(`${endpoint}${query}`),
    enabled: options.enabled ?? true,
  });
}

export function useResource<T>(endpoint: string, id?: string | null) {
  return useQuery<T>({
    queryKey: [endpoint, 'item', id],
    queryFn: () => api.get<T>(`${endpoint}/${id}`),
    enabled: Boolean(id),
  });
}

export function useResourceOptions<T = Record<string, unknown>>(
  endpoint: string,
  params: ListParams = { limit: 100 },
  enabled = true,
) {
  return useQuery<ResourceListResult<T>>({
    queryKey: [endpoint, 'options', params],
    queryFn: () => api.list<T>(`${endpoint}${buildQuery(params)}`),
    enabled,
    staleTime: 120_000,
  });
}

export function useCreateResource<T, TInput = unknown>(
  endpoint: string,
  invalidate: string[] = [],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TInput) => api.post<T>(endpoint, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
      for (const key of invalidate) await queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (error) => notifyError(error),
  });
}

export function useUpdateResource<T, TInput = unknown>(
  endpoint: string,
  invalidate: string[] = [],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TInput }) =>
      api.patch<T>(`${endpoint}/${id}`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
      for (const key of invalidate) await queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (error) => notifyError(error),
  });
}

export function useDeleteResource(endpoint: string, invalidate: string[] = []) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<unknown>(`${endpoint}/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
      for (const key of invalidate) await queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (error) => notifyError(error),
  });
}

export function useResourceAction<T = unknown>(
  endpoint: string,
  invalidate: string[] = [],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, payload }: { id: string; action: string; payload?: unknown }) =>
      api.post<T>(`${endpoint}/${id}/${action}`, payload ?? {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
      for (const key of invalidate) await queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (error) => notifyError(error),
  });
}

export function notifyError(error: unknown) {
  const message =
    error instanceof ApiRequestError ? error.message : 'Something went wrong. Please try again.';
  toast.error(message);
}

export function notifySuccess(message: string) {
  toast.success(message);
}
