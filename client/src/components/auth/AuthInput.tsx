import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type FocusEvent,
  type ReactNode,
} from "react";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import clsx from "clsx";

interface AuthInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> {
  id: string;
  label: string;
  icon: ReactNode;
  type?: "text" | "email" | "password";
  hint?: string;
  error?: string;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  function AuthInput(
    {
      id,
      label,
      icon,
      type = "text",
      hint,
      error,
      onKeyDown,
      onKeyUp,
      onBlur,
      ...props
    },
    ref
  ) {
    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const isPassword = type === "password";
    const resolvedType = isPassword && showPassword ? "text" : type;

    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;
    const capsId = `${id}-caps`;

    const describedBy =
      [hint ? hintId : null, error ? errorId : null, isPassword ? capsId : null]
        .filter(Boolean)
        .join(" ") || undefined;

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (isPassword) {
        setCapsLock(event.getModifierState?.("CapsLock") ?? false);
      }
      onKeyDown?.(event);
    };

    const handleKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
      if (isPassword) {
        setCapsLock(event.getModifierState?.("CapsLock") ?? false);
      }
      onKeyUp?.(event);
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
      setCapsLock(false);
      onBlur?.(event);
    };

    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-200">
          {label}
        </label>

        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            {icon}
          </span>

          <input
            ref={ref}
            id={id}
            type={resolvedType}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={handleBlur}
            className={clsx(
              "w-full rounded-xl border border-white/15 bg-white/[0.04] py-3 pl-11 text-[15px] text-white placeholder:text-slate-400 transition duration-200 hover:border-white/25 focus:border-accent-500 focus:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:shadow-[0_0_0_5px_rgba(225,29,72,0.12)]",
              isPassword ? "pr-12" : "pr-4",
              error && "field-invalid"
            )}
            {...props}
          />

          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              aria-controls={id}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          ) : null}
        </div>

        {hint ? (
          <p id={hintId} className="mt-1.5 text-xs text-slate-400">
            {hint}
          </p>
        ) : null}

        <p
          id={errorId}
          className={clsx(
            "mt-1.5 text-xs font-medium text-red-300",
            error ? "block" : "hidden"
          )}
        >
          {error}
        </p>

        {isPassword ? (
          <p
            id={capsId}
            role="status"
            className={clsx(
              "mt-1.5 items-center gap-1.5 text-xs font-medium text-amber-300",
              capsLock ? "flex" : "hidden"
            )}
          >
            <TriangleAlert size={14} />
            Caps Lock is on.
          </p>
        ) : null}
      </div>
    );
  }
);
