interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBox({ value, onChange }: SearchBoxProps) {
  return (
    <input
      type="search"
      className="search-box"
      placeholder="Search app name or version…"
      aria-label="Search applications"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
