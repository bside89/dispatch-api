export const languageToCurrency = (language: string): string => {
  if (language.startsWith('en')) return 'USD';
  if (language.startsWith('pt')) return 'BRL';
  if (language.startsWith('es')) return 'EUR';
  return 'USD'; // Default to USD if language is not recognized
};

export const languageToLocale = (language: string): string => {
  if (language.startsWith('en')) return 'en-US';
  if (language.startsWith('pt')) return 'pt-BR';
  if (language.startsWith('es')) return 'es-ES';
  return 'en-US'; // Default to en-US if language is not recognized
};

export const toCurrencyFormatted = (
  value: number,
  locale: string = 'pt-BR',
  currency: string = 'BRL',
): string => {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    value / 100,
  );
};
