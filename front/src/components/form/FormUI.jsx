import { X } from "lucide-react";
import { useCurrency } from "../../context/CurrencyContext";

export const inputBase =
  "w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-400 transition focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 dark:focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed";

export const inputError = "border-red-400 focus:ring-red-500/30 focus:border-red-500";

export function FormModal({ open, onClose, title, subtitle, icon, size = "lg", children, footer }) {
  if (!open) return null;

  const maxW = size === "xl" ? "max-w-4xl" : size === "md" ? "max-w-lg" : "max-w-2xl";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${maxW} max-h-[92vh] flex flex-col text-gray-900 dark:text-gray-100`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-200 dark:border-gray-600 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
              {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 shrink-0"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function FormSection({ title, description, children }) {
  return (
    <div className="space-y-4">
      {(title || description) && (
        <div className="pb-1">
          {title && <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h3>}
          {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function FormGrid({ cols = 2, children }) {
  const colClass =
    cols === 3 ? "md:grid-cols-3" : cols === 1 ? "grid-cols-1" : "md:grid-cols-2";
  return <div className={`grid grid-cols-1 ${colClass} gap-4`}>{children}</div>;
}

export function FormField({ label, hint, error, required, children, className = "" }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

export function FormInput({ error, className = "", ...props }) {
  return (
    <input
      className={`${inputBase} ${error ? inputError : ""} ${className}`}
      {...props}
    />
  );
}

export function FormSelect({ error, className = "", children, ...props }) {
  return (
    <select className={`${inputBase} ${error ? inputError : ""} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function FormTextarea({ error, className = "", rows = 3, ...props }) {
  return (
    <textarea
      rows={rows}
      className={`${inputBase} resize-y min-h-[80px] ${error ? inputError : ""} ${className}`}
      {...props}
    />
  );
}

export function FormMoneyInput({ error, value, onChange, className = "", ...props }) {
  const { symbol } = useCurrency();
  const borderClass = error
    ? "border-red-400 focus-within:ring-red-500/30"
    : "border-gray-200 dark:border-gray-500 focus-within:ring-blue-500/40 focus-within:border-blue-500 dark:focus-within:border-blue-400";

  return (
    <div
      className={`flex rounded-lg border bg-white dark:bg-gray-700 overflow-hidden transition focus-within:ring-2 ${borderClass} ${className}`}
    >
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={onChange}
        className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        {...props}
      />
      <span className="inline-flex items-center px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/90 border-l border-gray-200 dark:border-gray-600 shrink-0 whitespace-nowrap">
        {symbol}
      </span>
    </div>
  );
}

export function FormActions({ onCancel, submitLabel, loading, loadingLabel = "Enregistrement...", disabled, formId, onSubmit }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
        >
          Annuler
        </button>
      )}
      <button
        type={onSubmit ? "button" : "submit"}
        form={!onSubmit ? formId : undefined}
        onClick={onSubmit}
        disabled={loading || disabled}
        className="px-5 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition shadow-sm"
      >
        {loading ? loadingLabel : submitLabel}
      </button>
    </div>
  );
}

export function FormAlert({ type = "error", children }) {
  const styles =
    type === "error"
      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
      : type === "success"
        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200";
  return (
    <div className={`px-4 py-3 rounded-lg border text-sm mb-4 ${styles}`}>{children}</div>
  );
}
