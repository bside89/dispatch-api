import {
  toCurrencyFormatted,
  languageToCurrency,
  languageToLocale,
} from './order-functions';

describe('order-functions', () => {
  describe('toCurrencyFormatted', () => {
    it('should format BRL correctly (pt-BR)', () => {
      expect(toCurrencyFormatted(12345, 'pt-BR', 'BRL')).toBe('R$ 123,45');
    });

    it('should format USD correctly (en-US)', () => {
      expect(toCurrencyFormatted(12345, 'en-US', 'USD')).toBe('$123.45');
    });

    it('should format EUR correctly (es-ES)', () => {
      expect(toCurrencyFormatted(12345, 'es-ES', 'EUR')).toBe('123,45 €');
    });

    it('should use defaults if no locale/currency provided', () => {
      expect(toCurrencyFormatted(12345)).toBe('R$ 123,45');
    });

    it('should handle zero and negative values', () => {
      expect(toCurrencyFormatted(0, 'pt-BR', 'BRL')).toBe('R$ 0,00');
      expect(toCurrencyFormatted(-12345, 'en-US', 'USD')).toBe('-$123.45');
    });
  });

  describe('languageToCurrency', () => {
    it('should map language to correct currency', () => {
      expect(languageToCurrency('en')).toBe('USD');
      expect(languageToCurrency('pt')).toBe('BRL');
      expect(languageToCurrency('es')).toBe('EUR');
      expect(languageToCurrency('fr')).toBe('USD');
    });
  });

  describe('languageToLocale', () => {
    it('should map language to correct locale', () => {
      expect(languageToLocale('en')).toBe('en-US');
      expect(languageToLocale('pt')).toBe('pt-BR');
      expect(languageToLocale('es')).toBe('es-ES');
      expect(languageToLocale('fr')).toBe('en-US');
    });
  });
});
