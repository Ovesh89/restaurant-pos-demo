import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useVoiceSearch } from '../../hooks/useVoiceSearch.js';

/**
 * Reusable VoiceSearchButton component
 * Triggers speech recognition and returns the recognized text via onResult.
 * Features animated listening states, tooltip, and accessible button semantics.
 */
export const VoiceSearchButton = ({
  onResult,
  className = '',
  size = 'md',
  disabled = false,
  title
}) => {
  const { isListening, isSupported, toggleListening } = useVoiceSearch({
    onResult
  });

  const sizeClasses =
    size === 'sm'
      ? 'p-1 text-xs'
      : 'p-1.5 text-sm';

  const iconSizes =
    size === 'sm'
      ? 'w-3.5 h-3.5'
      : 'w-4 h-4';

  const resolvedTitle =
    title ||
    (!isSupported
      ? 'Voice search is not supported in this browser'
      : isListening
      ? 'Listening... Click to stop'
      : 'Click to speak and search');

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center rounded-full transition-all duration-200 focus:outline-none ${sizeClasses} ${
        isListening
          ? 'bg-red-500 text-white shadow-md shadow-red-200 ring-2 ring-red-400 animate-pulse'
          : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 active:scale-95'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      title={resolvedTitle}
      aria-label={resolvedTitle}
      tabIndex={0}
    >
      <Mic className={iconSizes} />
      {isListening && (
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
        </span>
      )}
    </button>
  );
};
