import { delay, col, runAndIgnoreError, ensureError, template } from './functions';

describe('functions.ts', () => {
  describe('delay', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('should resolve after 50ms', async () => {
      const promise = delay(50);

      await jest.advanceTimersByTimeAsync(50);

      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('col', () => {
    it('should return a function that formats alias and key', () => {
      type Test = { foo: string; bar: number };
      const testCol = col<Test>('alias');
      expect(testCol('foo')).toBe('alias.foo');
      expect(testCol('bar')).toBe('alias.bar');
    });
  });

  describe('runAndIgnoreError', () => {
    it('should return result if no error', async () => {
      const fn = async () => 42;
      const result = await runAndIgnoreError(fn, 'test');
      expect(result).toBe(42);
    });

    it('should return null and log if error', async () => {
      const fn = async () => {
        throw new Error('fail');
      };
      const logger = { warn: jest.fn() };
      const result = await runAndIgnoreError(fn, 'context', logger);
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('context'));
    });
  });

  describe('ensureError', () => {
    it('should return the same error if already Error', () => {
      const err = new Error('msg');
      expect(ensureError(err)).toBe(err);
    });

    it('should wrap non-Error values', () => {
      const err = ensureError('fail');
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('fail');
    });
  });

  describe('template', () => {
    it('should return an object with key and args', () => {
      const result = template('KEY', { foo: 1 });
      expect(result).toEqual({ key: 'KEY', args: { foo: 1 } });
    });

    it('should work with no args', () => {
      const result = template('KEY');
      expect(result).toEqual({ key: 'KEY', args: undefined });
    });
  });
});
