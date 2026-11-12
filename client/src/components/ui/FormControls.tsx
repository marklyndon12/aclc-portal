import { useId } from "react";
import clsx from "clsx";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

interface FieldShellProps {
  label: string;
  hint?: string;
}

function FieldShell({
  label,
  hint,
  htmlFor,
  children,
}: FieldShellProps & { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}

export function GlassInput({
  label,
  hint,
  id,
  className,
  ...props
}: FieldShellProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldShell label={label} hint={hint} htmlFor={inputId}>
      <input id={inputId} className={clsx("input-glass", className)} {...props} />
    </FieldShell>
  );
}

export function GlassSelect({
  label,
  hint,
  id,
  className,
  children,
  ...props
}: FieldShellProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <FieldShell label={label} hint={hint} htmlFor={selectId}>
      <select
        id={selectId}
        className={clsx("input-glass appearance-none bg-slate-900/60", className)}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function GlassTextarea({
  label,
  hint,
  id,
  className,
  ...props
}: FieldShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <FieldShell label={label} hint={hint} htmlFor={textareaId}>
      <textarea
        id={textareaId}
        className={clsx("input-glass resize-none", className)}
        {...props}
      />
    </FieldShell>
  );
}
