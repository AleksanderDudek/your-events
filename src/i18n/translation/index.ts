// Public surface of the translation layer. Nothing outside this directory
// should import from `./engine` or `./useTranslated` directly — this list is
// the contract the rest of the app codes against.

export { useTranslated, Translated, useTranslationStatus } from './useTranslated';
export { primeTranslator, isTranslationSupported } from './engine';
export type { TranslationStatus } from './engine';
