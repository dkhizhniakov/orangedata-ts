import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { deflateSync, gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildRequestUrl,
  Correction,
  CorrectionType,
  DEFAULT_PROD_API_URL,
  DEFAULT_TEST_API_URL,
  FfdVersion,
  ItemCode,
  OrangeData,
  OrangeDataApiError,
  OrangeDataError,
  OrangeDataValidationError,
  Order,
  PaymentType,
  PlannedStatus,
  ReceiptType,
  resolveBaseApiUrl,
  TaxationSystem,
  TaxRate,
} from '../../src/index.js';
import { generateTestMtlsBundle, type TestMtlsBundle } from '../helpers/x509.js';

describe('mTLS HttpClient & OrangeData Integration Suite', () => {
  let certs: TestMtlsBundle;
  let server: https.Server;
  let apiUrl: string;

  type RouteHandler = (
    req: IncomingMessage,
    res: ServerResponse,
    rawBody: string,
  ) => void | Promise<void>;
  let currentHandler: RouteHandler;

  beforeAll(async () => {
    certs = generateTestMtlsBundle();

    server = https.createServer(
      {
        key: certs.serverKey,
        cert: certs.serverCert,
        ca: certs.caCert,
        requestCert: true,
        rejectUnauthorized: true,
      },
      (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          if (req.method === 'POST') {
            const sig = req.headers['x-signature'];
            if (typeof sig !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ errors: ['Missing X-Signature'] }));
              return;
            }
            const verifier = crypto.createVerify('RSA-SHA256');
            verifier.update(rawBody);
            verifier.end();
            if (!verifier.verify(certs.signingPublicKey, sig, 'base64')) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ errors: ['Invalid X-Signature'] }));
              return;
            }
          } else {
            // На GET-запросах заголовок X-Signature должен отсутствовать
            if ('x-signature' in req.headers) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ errors: ['Unexpected X-Signature on GET'] }));
              return;
            }
          }
          void currentHandler(req, res, rawBody);
        });
      },
    );

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const port = (server.address() as AddressInfo).port;
    apiUrl = `https://localhost:${port}/api/v2`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function createClient(overrides: Partial<ConstructorParameters<typeof OrangeData>[0]> = {}) {
    return new OrangeData({
      apiUrl,
      ca: certs.caCert,
      cert: certs.clientCert,
      key: certs.clientEncryptedKey,
      passphrase: certs.clientPassphrase,
      privateKey: certs.signingPrivateKey,
      ...overrides,
    });
  }

  function sampleOrder(id = 'order_1') {
    return new Order({
      id,
      inn: '781304608018',
      ffdVersion: FfdVersion.Ffd12,
      type: ReceiptType.Income,
      taxationSystem: TaxationSystem.USNIncome,
      customerContact: '+79991234567',
    })
      .addPosition({
        text: 'Товар',
        quantity: 1,
        price: 100,
        tax: TaxRate.NoVat,
      })
      .addPayment({ type: PaymentType.Cashless, amount: 100 });
  }

  it('resolves base URLs and query parameters without losing /api/v2 prefix', () => {
    expect(resolveBaseApiUrl({ apiUrl: 'https://api.orangedata.ru:12003/api/v2/' })).toBe(
      'https://api.orangedata.ru:12003/api/v2',
    );
    expect(resolveBaseApiUrl({ host: 'custom.host', port: 2443, baseUrl: '/api/v2/' })).toBe(
      'https://custom.host:2443/api/v2',
    );

    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(resolveBaseApiUrl({})).toBe(DEFAULT_PROD_API_URL);
    process.env.NODE_ENV = 'development';
    expect(resolveBaseApiUrl({})).toBe(DEFAULT_TEST_API_URL);
    process.env.NODE_ENV = prevEnv;

    const built = buildRequestUrl('https://localhost:12001/api/v2/', '/documents', {
      page: 1,
      skip: undefined,
    });
    expect(built.toString()).toBe('https://localhost:12001/api/v2/documents?page=1');
  });

  it('validates client options and rejects untrusted mTLS client certificates', async () => {
    expect(
      () =>
        new OrangeData({
          ca: '',
          cert: '',
          key: '',
          passphrase: '',
          privateKey: '',
        }),
    ).toThrowError(OrangeDataValidationError);

    const rogueClient = createClient({
      cert: certs.untrustedClientCert,
      key: certs.untrustedClientKey,
      passphrase: 'none',
    });

    currentHandler = (_req, res) => {
      res.writeHead(200);
      res.end();
    };

    await expect(rogueClient.getOrderStatus('781304608018', '1')).rejects.toThrowError(
      OrangeDataError,
    );
    rogueClient.destroy();
  });

  it('sends Order, Correction, Correction12, and ItemCode with verified RSA-SHA256 signatures', async () => {
    const client = createClient();
    const receivedPaths: string[] = [];

    currentHandler = (req, res) => {
      receivedPaths.push(`${req.method} ${req.url}`);
      res.writeHead(201);
      res.end();
    };

    await client.sendOrder(sampleOrder('o1'));

    const corr105 = new Correction({
      id: 'c1',
      inn: '781304608018',
      type: ReceiptType.Income,
      taxationSystem: TaxationSystem.USNIncome,
      correctionType: CorrectionType.Self,
      causeDocumentDate: '2026-11-01',
      totalSum: 100,
      eCashSum: 100,
    });
    await client.sendCorrection(corr105);

    const corr12 = new Correction({
      id: 'c12',
      inn: '781304608018',
      ffdVersion: FfdVersion.Ffd12,
      type: ReceiptType.Income,
      taxationSystem: TaxationSystem.USNIncome,
      correctionType: CorrectionType.Self,
      causeDocumentDate: '2026-11-01',
    })
      .addPosition({ text: 'Позиция', quantity: 1, price: 100, tax: TaxRate.NoVat })
      .addPayment({ type: PaymentType.Cashless, amount: 100 });
    await client.sendCorrection12(corr12);

    const ic = new ItemCode({
      id: 'ic1',
      inn: '781304608018',
      plannedStatus: PlannedStatus.PieceSold,
      itemCode: '010460000000000021test',
    });
    await client.checkItemCode(ic);

    expect(receivedPaths).toEqual([
      'POST /api/v2/documents',
      'POST /api/v2/corrections',
      'POST /api/v2/correction12',
      'POST /api/v2/itemcode',
    ]);

    // Проверка защитных проверок типов аргументов
    await expect(client.sendOrder({} as Order)).rejects.toThrow('Order');
    await expect(client.sendCorrection({} as Correction)).rejects.toThrow('Correction');
    await expect(client.sendCorrection12({} as Correction)).rejects.toThrow('Correction');
    await expect(client.checkItemCode({} as ItemCode)).rejects.toThrow('ItemCode');
    await expect(client.getOrderStatus('', '1')).rejects.toThrow('ИНН или id');

    client.destroy();
  });

  it('handles 202 queued, 200 OK with gzip/deflate decompression, and all status endpoints', async () => {
    const client = createClient();
    let callCount = 0;

    currentHandler = (req, res) => {
      callCount++;
      if (callCount === 1) {
        res.writeHead(202);
        res.end();
        return;
      }
      const payload = JSON.stringify({
        id: 'doc_1',
        fp: '1234567890',
        url: req.url,
      });
      if (callCount === 2) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
        });
        res.end(gzipSync(Buffer.from(payload)));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'deflate',
      });
      res.end(deflateSync(Buffer.from(payload)));
    };

    const queued = await client.getOrderStatus('781304608018', 'doc_1');
    expect(queued).toBeNull();

    const doneOrder = await client.getOrderStatus('781304608018', 'doc_1');
    expect(doneOrder?.fp).toBe('1234567890');

    const doneCorr = await client.getCorrectionStatus('781304608018', 'c1');
    expect(doneCorr?.fp).toBe('1234567890');

    const doneCorr12 = await client.getCorrection12Status('781304608018', 'c12');
    expect(doneCorr12?.fp).toBe('1234567890');

    const doneIc = await client.getItemCodeStatus('781304608018', 'ic1');
    expect(doneIc?.id).toBe('doc_1');

    client.destroy();
  });

  it('handles 400, 401, 409, 503 (Retry-After) and polling via waitFor* helpers', async () => {
    const client = createClient();

    // Проверка 400 с массивом errors
    currentHandler = (_req, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: ['Некорректный ИНН ККТ'] }));
    };

    await expect(client.sendOrder(sampleOrder('err_400'))).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(OrangeDataApiError);
      const apiErr = err as OrangeDataApiError;
      expect(apiErr.statusCode).toBe(400);
      expect(apiErr.errors).toEqual(['Некорректный ИНН ККТ']);
      expect(apiErr.sentData).toMatchObject({ id: 'err_400' });
      return true;
    });

    // Поллинг: 202 -> 503 (Retry-After: 0) -> 200 OK
    let pollStep = 0;
    currentHandler = (_req, res) => {
      pollStep++;
      if (pollStep === 1) {
        res.writeHead(202);
        res.end();
        return;
      }
      if (pollStep === 2) {
        res.writeHead(503, { 'Retry-After': '0', 'Content-Type': 'text/plain' });
        res.end('Busy');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'polled_1', fp: '999888' }));
    };

    const polled = await client.waitForOrderStatus('781304608018', 'polled_1', {
      intervalMs: 10,
      maxAttempts: 5,
    });
    expect(polled?.fp).toBe('999888');
    expect(pollStep).toBe(3);

    // Поллинг остальных waitFor* и исчерпание попыток (возвращает null)
    currentHandler = (_req, res) => {
      res.writeHead(202);
      res.end();
    };
    const exhausted = await client.waitForCorrectionStatus('781304608018', 'c1', {
      intervalMs: 5,
      maxAttempts: 2,
    });
    expect(exhausted).toBeNull();

    currentHandler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'ok' }));
    };
    expect(
      (await client.waitForCorrection12Status('781304608018', 'c12', { maxAttempts: 1 }))?.id,
    ).toBe('ok');
    expect(
      (await client.waitForItemCodeStatus('781304608018', 'ic1', { maxAttempts: 1 }))?.id,
    ).toBe('ok');

    // Поллинг пробрасывает 401 сразу без повторов
    let authCalls = 0;
    currentHandler = (_req, res) => {
      authCalls++;
      res.writeHead(401);
      res.end();
    };
    await expect(
      client.waitForOrderStatus('781304608018', 'x', { intervalMs: 5, maxAttempts: 4 }),
    ).rejects.toThrowError(OrangeDataApiError);
    expect(authCalls).toBe(1);

    client.destroy();
  });

  it('enforces request timeouts and AbortSignal cancellation', async () => {
    const client = createClient({ timeout: 50 });

    currentHandler = (_req, res) => {
      const timer = setTimeout(() => {
        res.writeHead(200);
        res.end('{}');
      }, 300);
      timer.unref();
    };

    await expect(client.getOrderStatus('781304608018', 'slow')).rejects.toThrow(
      'Превышено время ожидания',
    );

    // Уже отменённый AbortSignal
    const preAborted = new AbortController();
    preAborted.abort('cancelled');
    await expect(
      client.getOrderStatus('781304608018', 'aborted', {
        signal: preAborted.signal,
        timeout: 1000,
      }),
    ).rejects.toThrow('AbortSignal');

    // Отмена во время активного HTTP-запроса (mid-flight abort)
    currentHandler = (_req, res) => {
      const timer = setTimeout(() => {
        res.writeHead(200);
        res.end('{}');
      }, 500);
      timer.unref();
    };
    const midFlightAbort = new AbortController();
    setTimeout(() => midFlightAbort.abort('stop'), 20);
    await expect(
      client.getOrderStatus('781304608018', 'mid_abort', {
        signal: midFlightAbort.signal,
        timeout: 2000,
      }),
    ).rejects.toThrow('AbortSignal');

    // Отмена во время поллинга
    currentHandler = (_req, res) => {
      res.writeHead(202);
      res.end();
    };
    const pollAbort = new AbortController();
    setTimeout(() => pollAbort.abort(), 20);
    await expect(
      client.waitForOrderStatus('781304608018', 'poll_abort', {
        intervalMs: 200,
        maxAttempts: 5,
        signal: pollAbort.signal,
      }),
    ).rejects.toThrow('AbortSignal');

    // Поллинг с исчерпанием попыток на ошибке 503 (проброс ошибки на последней попытке)
    currentHandler = (_req, res) => {
      res.writeHead(503, { 'Retry-After': '0' });
      res.end();
    };
    await expect(
      client.waitForOrderStatus('781304608018', 'fail_503', {
        intervalMs: 5,
        maxAttempts: 2,
      }),
    ).rejects.toThrowError(OrangeDataApiError);

    // Повреждённый gzip-ответ
    currentHandler = (_req, res) => {
      res.writeHead(200, { 'Content-Encoding': 'gzip' });
      res.end(Buffer.from('not-valid-gzip-stream'));
    };
    await expect(client.getOrderStatus('781304608018', 'bad_gzip')).rejects.toThrow(
      'Ошибка декодирования ответа',
    );

    // Ошибка сериализации циклического объекта и validateOnSend: false
    const noValidateClient = createClient({ validateOnSend: false });
    currentHandler = (_req, res) => {
      res.writeHead(201);
      res.end();
    };
    await noValidateClient.sendOrder(
      new Order({
        id: '',
        inn: 'bad',
        type: ReceiptType.Income,
        taxationSystem: TaxationSystem.OSN,
      }),
    );

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(noValidateClient.httpClient.post('/documents', circular)).rejects.toThrow(
      'сериализовать',
    );
    noValidateClient.destroy();

    // Переменные окружения OD_HOST / OD_PORT / OD_BASE_URL
    process.env.OD_HOST = 'env.orangedata.local';
    process.env.OD_PORT = '14443';
    process.env.OD_BASE_URL = 'api/v2';
    expect(resolveBaseApiUrl({})).toBe('https://env.orangedata.local:14443/api/v2');
    delete process.env.OD_HOST;
    delete process.env.OD_PORT;
    delete process.env.OD_BASE_URL;

    client.destroy();
  });
});
