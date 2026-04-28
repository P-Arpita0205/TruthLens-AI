import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  required = false,
  autoComplete,
  disabled = false,
  leftIcon: LeftIcon,
  inputClassName = '',
  wrapperClassName = '',
  labelClassName = 'block text-sm font-bold text-slate-700 mb-2'
}) {
  const [isVisible, setIsVisible] = useState(false);
  const leftPaddingClass = LeftIcon ? 'pl-12' : 'pl-4';

  return (
    <div className={wrapperClassName}>
      {label ? (
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
      ) : null}

      <div className="relative">
        {LeftIcon ? (
          <LeftIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        ) : null}

        <input
          id={id}
          type={isVisible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`${leftPaddingClass} pr-12 ${inputClassName}`.trim()}
        />

        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          title={isVisible ? 'Hide password' : 'Show password'}
        >
          {isVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
