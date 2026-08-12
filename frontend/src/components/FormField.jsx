// Campo de formulário genérico: label + input/select + erro de validação.
const inputClasses =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm ' +
  'transition-colors placeholder:text-gray-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/40 ' +
  'dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500';

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
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-red-600 dark:text-red-400">*</span>}
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

      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
