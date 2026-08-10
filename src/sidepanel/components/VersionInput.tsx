import { isValidVersionFormat } from "../../shared/version-format";

interface VersionInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}

export function VersionInput({ value, onChange, label, disabled }: VersionInputProps) {
  const valid = value.length === 0 || isValidVersionFormat(value);
  return (
    <span className="version-input">
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
      <span className="version-input__hint">
        {valid ? "Format valid — existence not verified." : "Expected format: 1.136.17"}
      </span>
    </span>
  );
}
