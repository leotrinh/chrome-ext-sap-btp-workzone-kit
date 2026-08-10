import { isValidVersionFormat } from "../../shared/version-format";

interface VersionInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  /** Narrower layout for tight contexts (table cells): smaller input, hint suppressed unless invalid. */
  compact?: boolean;
}

export function VersionInput({ value, onChange, label, disabled, compact }: VersionInputProps) {
  const valid = value.length === 0 || isValidVersionFormat(value);
  return (
    <span className={compact ? "version-input version-input--compact" : "version-input"}>
      {label && <label>{label}</label>}
      <input
        type="text"
        inputMode="text"
        placeholder="1.136.17"
        value={value}
        disabled={disabled}
        aria-invalid={!valid}
        onChange={(event) => onChange(event.target.value)}
        className={valid ? "" : "version-input--invalid"}
      />
      {(!compact || !valid) && (
        <span className="version-input__hint">
          {valid ? "Format valid — existence not verified." : "Expected format: 1.136.17"}
        </span>
      )}
    </span>
  );
}
