import { HashAdapter } from './hash-adapter.utils';

describe('HashUtils', () => {
  const password = 'mySecret123!';

  it('should hash and verify a password correctly', async () => {
    const hash = await HashAdapter.hash(password);
    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(password);
    const isValid = await HashAdapter.compare(hash, password);
    expect(isValid).toBe(true);
  });

  it('should not verify an incorrect password', async () => {
    const hash = await HashAdapter.hash(password);
    const isValid = await HashAdapter.compare(hash, 'wrongPassword');
    expect(isValid).toBe(false);
  });

  it('should throw if hash is invalid', async () => {
    await expect(HashAdapter.compare('invalid-hash', password)).rejects.toThrow();
  });
});
