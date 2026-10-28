import React, { useState } from 'react';
import { Eye, EyeOff, Search, X } from 'lucide-react';
import { VoiceSearchButton } from './VoiceSearchButton.jsx';

export const Input = ({
  label,
  labelClassName = '',
  error,
  helperText,
  icon: Icon,
  className = '',
  id,
  type = 'text',
  voiceSearch,
  onVoiceResult,
  onClear,
  clearable,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const isPassword = type === 'password';
  const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type;

  // Determine if this input represents a search field with voice search capability
  const isSearchField = Boolean(Icon === Search || type === 'search' || voiceSearch || onVoiceResult);
  const enableVoice = voiceSearch !== false && isSearchField;

  // Show clear button when search has text value
  const hasValue = Boolean(props.value !== undefined && props.value !== null && String(props.value).length > 0);
  const showClear = Boolean((clearable ?? isSearchField) && hasValue && (onClear || props.onChange));

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (props.onChange) {
      props.onChange({
        target: { value: '', name: props.name || inputId },
        currentTarget: { value: '', name: props.name || inputId }
      });
    }
  };

  const handleVoiceResult = (transcript) => {
    if (props.onChange) {
      props.onChange({
        target: { value: transcript, name: props.name || inputId },
        currentTarget: { value: transcript, name: props.name || inputId }
      });
    }
    if (onVoiceResult) {
      onVoiceResult(transcript);
    }
  };

  // Compute right padding so text does not collide with action icons
  let paddingRightClass = 'pr-3.5';
  if (isPassword) {
    paddingRightClass = 'pr-10';
  } else if (enableVoice && showClear) {
    paddingRightClass = 'pr-16';
  } else if (enableVoice || showClear) {
    paddingRightClass = 'pr-10';
  }

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className={`block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 ${labelClassName}`}>
          {label}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <input
          id={inputId}
          type={resolvedType}
          className={`block w-full rounded-lg border text-base sm:text-sm transition-colors min-h-[40px] sm:min-h-[38px] focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-500 ${
            Icon ? 'pl-9' : 'pl-3.5'
          } ${paddingRightClass} py-2 ${
            error
              ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-blue-100'
          } ${className}`}
          {...props}
        />

        {/* Right-aligned action buttons (Password toggle, Clear, Voice search) */}
        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
          {showClear && !isPassword && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
              title="Clear search"
              aria-label="Clear search"
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {enableVoice && !isPassword && (
            <VoiceSearchButton
              onResult={handleVoiceResult}
              size="sm"
            />
          )}

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="p-1 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
};
