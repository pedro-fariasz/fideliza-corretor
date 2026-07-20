// Campo de formulário genérico: label + input/select + erro de validação.
const inputClasses =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm ' +
  'focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue';

export default function FormField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  required = false,
  options = null,
  placeholder = '',
  error = '',
  min,
  max,
  step,
}) {
  const id = `campo-${name}`;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>

      {options ? (
        <select id={id} name={name} value={value} onChange={onChange} className={inputClasses}>
          <option value="">Selecione...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={3}
          className={inputClasses}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className={inputClasses}
        />
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
