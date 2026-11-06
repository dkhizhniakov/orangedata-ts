import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signPayload } from '../../src/client/signature.js';
import { OrangeDataError } from '../../src/errors/errors.js';

describe('RSA-SHA256 signature (X-Signature)', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pkcs8Pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const pkcs1Buffer = Buffer.from(privateKey.export({ type: 'pkcs1', format: 'pem' }));

  it('signs UTF-8 JSON payload and passes public key verification across key formats', () => {
    const payload = JSON.stringify({
      id: 'order-42',
      inn: '781304608018',
      content: { text: 'Футболка с автографом игрока' },
    });

    const sigFromPem = signPayload(payload, pkcs8Pem);
    const sigFromBuf = signPayload(Buffer.from(payload, 'utf8'), pkcs1Buffer);
    const sigFromKeyObj = signPayload(payload, privateKey);

    expect(sigFromPem).toBe(sigFromBuf);
    expect(sigFromPem).toBe(sigFromKeyObj);

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(payload);
    verifier.end();
    expect(verifier.verify(publicKey, sigFromPem, 'base64')).toBe(true);
  });

  it('throws descriptive OrangeDataError with cause on malformed PEM key', () => {
    expect(() => signPayload('{"id":"1"}', 'not-a-valid-pem-key')).toThrowError(OrangeDataError);
    try {
      signPayload('{"id":"1"}', '<RSAKeyValue>xml</RSAKeyValue>');
    } catch (err) {
      expect(err).toBeInstanceOf(OrangeDataError);
      expect((err as OrangeDataError).message).toContain('PEM-формата');
      expect((err as OrangeDataError).cause).toBeDefined();
    }
  });
});
