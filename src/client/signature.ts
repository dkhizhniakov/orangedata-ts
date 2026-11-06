import { createSign, type KeyObject } from 'node:crypto';
import { OrangeDataError } from '../errors/errors.js';

/**
 * Подписывает строковое или бинарное тело документа алгоритмом `RSA-SHA256`
 * и возвращает подпись в кодировке `base64` для заголовка `X-Signature`.
 */
export function signPayload(
  payload: string | Buffer,
  privateKey: string | Buffer | KeyObject,
): string {
  try {
    const signer = createSign('RSA-SHA256');
    signer.update(payload);
    signer.end();
    return signer.sign(privateKey, 'base64');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new OrangeDataError(
      `Не удалось подписать документ приватным RSA-ключом (${message}). Проверьте корректность PEM-формата приватного ключа (ожидается PKCS#8 "-----BEGIN PRIVATE KEY-----" или PKCS#1 "-----BEGIN RSA PRIVATE KEY-----").`,
      undefined,
      { cause: error },
    );
  }
}
