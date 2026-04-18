import { HashUtils } from './hash.utils';

describe('HashUtils', () => {
  const password = 'mySecret123!';

  it('should hash and verify a password correctly', async () => {
    const hash = await HashUtils.hash(password);
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(password);
    const isValid = await HashUtils.compare(hash, password);
    expect(isValid).toBe(true);
  });

  it('should not verify an incorrect password', async () => {
    const hash = await HashUtils.hash(password);
    const isValid = await HashUtils.compare(hash, 'wrongPassword');
    expect(isValid).toBe(false);
  });

  it('should throw if hash is invalid', async () => {
    await expect(HashUtils.compare('invalid-hash', password)).rejects.toThrow();
  });
});
