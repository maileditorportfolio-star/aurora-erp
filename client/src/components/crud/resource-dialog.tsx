'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm, type FieldValues, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';
import { ApiRequestError } from '@/lib/api';
import { toDateInput } from '@/lib/formatters';
import { cn, getPath, setPath } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/data/form-field';

export type FormFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'password'
  | 'number'
  | 'date'
  | 'time'
  | 'color'
  | 'textarea'
  | 'select'
  | 'switch';

export interface FormFieldConfig {
  name: string;
  label: string;
  type?: FormFieldType;
  placeholder?: string;
  hint?: string;
  colSpan?: 1 | 2;
  required?: boolean;
  disabled?: boolean;
  step?: string;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: unknown;
  rows?: number;
}

function defaultsFor(
  fields: FormFieldConfig[],
  record?: Record<string, unknown> | null,
): FieldValues {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const existing = record ? getPath(record, field.name) : undefined;
    let value = existing ?? field.defaultValue;
    if (value === undefined || value === null) {
      value = field.type === 'switch' ? false : '';
    } else if (field.type === 'date') {
      value = toDateInput(value as string);
    } else if (field.type === 'switch') {
      value = Boolean(value);
    }
    setPath(values, field.name, value);
  }
  return values;
}

export interface ResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  schema: ZodType;
  fields: FormFieldConfig[];
  record?: Record<string, unknown> | null;
  submitLabel?: string;
  wide?: boolean;
  onSubmit: (values: FieldValues) => Promise<void> | void;
  children?: React.ReactNode;
  extraFooter?: React.ReactNode;
}

export function ResourceDialog({
  open,
  onOpenChange,
  title,
  description,
  schema,
  fields,
  record,
  submitLabel = 'Save',
  wide,
  onSubmit,
  children,
  extraFooter,
}: ResourceDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FieldValues>({
    resolver: zodResolver(schema as ZodType<FieldValues, FieldValues>),
    defaultValues: defaultsFor(fields, record),
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultsFor(fields, record));
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiRequestError
          ? error.message
          : 'Unable to save changes. Please review the form and try again.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[92vh] overflow-y-auto scrollbar-thin',
          wide ? 'max-w-3xl' : 'max-w-xl',
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {serverError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const error = form.formState.errors[field.name];
              const errorMessage = typeof error?.message === 'string' ? error.message : undefined;
              const inputId = `field-${field.name.replaceAll('.', '-')}`;

              return (
                <FormField
                  key={field.name}
                  label={field.label}
                  htmlFor={inputId}
                  error={errorMessage}
                  hint={field.hint}
                  required={field.required}
                  colSpan={field.colSpan}
                >
                  {field.type === 'switch' ? (
                    <Controller
                      control={form.control}
                      name={field.name as Path<FieldValues>}
                      render={({ field: controlled }) => (
                        <div className="flex h-9 items-center gap-2">
                          <Switch
                            id={inputId}
                            checked={Boolean(controlled.value)}
                            onCheckedChange={controlled.onChange}
                            disabled={field.disabled}
                          />
                          <span className="text-xs text-muted-foreground">
                            {Boolean(controlled.value) ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      )}
                    />
                  ) : field.type === 'textarea' ? (
                    <Textarea
                      id={inputId}
                      rows={field.rows ?? 3}
                      placeholder={field.placeholder}
                      disabled={field.disabled}
                      {...form.register(field.name as Path<FieldValues>)}
                    />
                  ) : field.type === 'select' ? (
                    <Select
                      id={inputId}
                      disabled={field.disabled}
                      {...form.register(field.name as Path<FieldValues>)}
                    >
                      <option value="">{field.placeholder ?? 'Select…'}</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      id={inputId}
                      type={field.type ?? 'text'}
                      placeholder={field.placeholder}
                      disabled={field.disabled}
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      {...form.register(field.name as Path<FieldValues>)}
                    />
                  )}
                </FormField>
              );
            })}
          </div>

          {children}

          <DialogFooter>
            {extraFooter}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
