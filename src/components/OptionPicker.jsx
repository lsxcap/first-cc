import { useState } from "react";

export default function OptionPicker({ options, value, onChange, placeholder = "请选择" }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) || null;

  return (
    <div className="picker">
      <button type="button" className={`picker-trigger ${open ? "open" : ""}`} onClick={() => setOpen((current) => !current)}>
        <span>{selected?.label || placeholder}</span>
        <b />
      </button>
      {open && (
        <div className="picker-menu">
          {options.map((option) => (
            <button
              type="button"
              className={option.value === value ? "selected" : ""}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <strong>{option.label}</strong>
              {option.meta && <span>{option.meta}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
