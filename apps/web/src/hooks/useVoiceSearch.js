import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { I18nContext } from '../i18n/I18nContext.jsx';

// Map POS language codes to BCP-47 speech recognition locales
const LANGUAGE_SPEECH_MAP = {
  en: 'en-IN',
  gu: 'gu-IN',
  hi: 'hi-IN',
  ur: 'ur-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  ml: 'ml-IN'
};

/**
 * useVoiceSearch hook
 * Provides browser Web Speech API integration for search fields.
 * Supports English, Hindi, Gujarati, Urdu, Tamil, Telugu, Kannada, Malayalam,
 * with graceful fallback and animated listening states.
 */
export const useVoiceSearch = ({
  onResult,
  onStart,
  onEnd,
  onError,
  lang: customLang
} = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  // Read current UI language if I18nContext is present
  const i18n = useContext(I18nContext);
  const currentLang = customLang || i18n?.language || 'en';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(Boolean(SpeechRecognition));
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Safe to ignore if already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const msg = 'Voice search is not supported in this browser. Please use Chrome, Edge, or Safari.';
      setError(msg);
      if (onError) onError(msg);
      alert(msg);
      return;
    }

    // Toggle off if currently listening
    if (isListening) {
      stopListening();
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      // Select locale according to user's selected language
      const selectedSpeechLocale =
        LANGUAGE_SPEECH_MAP[currentLang] || navigator.language || 'en-US';
      recognition.lang = selectedSpeechLocale;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        if (onStart) onStart();
      };

      recognition.onresult = (event) => {
        if (event.results && event.results.length > 0) {
          const rawTranscript = event.results[0][0].transcript;
          if (rawTranscript) {
            // Strip trailing punctuation often added by speech-to-text engines
            const cleanTranscript = rawTranscript
              .trim()
              .replace(/[.,!?;]+$/, '');
            if (onResult) {
              onResult(cleanTranscript);
            }
          }
        }
      };

      recognition.onerror = (event) => {
        const errType = event.error;
        // Do not alert on routine non-critical events
        if (errType === 'no-speech' || errType === 'aborted') {
          setIsListening(false);
          return;
        }

        let userMsg = `Speech recognition error: ${errType}`;
        if (errType === 'not-allowed') {
          userMsg = 'Microphone permission was denied. Please allow microphone access in your browser settings to speak and search.';
          alert(userMsg);
        } else if (errType === 'network') {
          userMsg = 'Network error occurred during voice recognition.';
        }

        setError(userMsg);
        if (onError) onError(userMsg);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
        if (onEnd) onEnd();
      };

      recognition.start();
    } catch (err) {
      console.warn('Speech recognition startup error:', err);
      setIsListening(false);
      setError(err?.message || 'Failed to start microphone');
    }
  }, [isListening, currentLang, onResult, onStart, onEnd, onError, stopListening]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore abort on unmount
        }
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    toggleListening: isListening ? stopListening : startListening
  };
};
