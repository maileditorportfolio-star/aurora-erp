'use client';

import type { FieldValues } from 'react-hook-form';
import { useCreateResource, useUpdateResource } from '@/hooks/use-resource';

export function useSaveResource<T = unknown>(
  endpoint: string,
  recordId: string | undefined,
  invalidate: string[] = [],
) {
  const create = useCreateResource<T, FieldValues>(endpoint, invalidate);
  const update = useUpdateResource<T, FieldValues>(endpoint, invalidate);
  const isPending = create.isPending || update.isPending;

  const save = async (values: FieldValues) => {
    if (recordId) {
      await update.mutateAsync({ id: recordId, payload: values });
    } else {
      await create.mutateAsync(values);
    }
  };

  return { save, isPending };
}
