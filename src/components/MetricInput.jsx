export default function MetricInput({ label, unit, value, onChange, placeholder = "0" }) {
  return (
    <label className="form-field">
      {label}
      <div className="input-unit">
        <input
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ""))}
          placeholder={placeholder}
        />
        <span>{unit}</span>
      </div>
    </label>
  );
}
