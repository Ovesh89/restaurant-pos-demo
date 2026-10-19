import { en } from './en.js';
import { gu } from './gu.js';
import { hi } from './hi.js';
import { ur } from './ur.js';
import { te } from './te.js';
import { ta } from './ta.js';
import { kn } from './kn.js';
import { ml } from './ml.js';

export const LOCALES = {
  en,
  gu,
  hi,
  ur,
  te,
  ta,
  kn,
  ml
};

export const getTranslation = (langCode = 'en') => {
  return LOCALES[langCode] || LOCALES.en;
};
