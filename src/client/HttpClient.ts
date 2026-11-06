import type { IncomingHttpHeaders } from 'node:http';
import https from 'node:https';
import { gunzipSync, inflateSync } from 'node:zlib';
import { OrangeDataApiError, OrangeDataError } from '../errors/errors.js';
import { DEFAULT_PROD_API_URL, DEFAULT_TEST_API_URL } from '../types/enums.js';
import type { OrangeDataOptions, RequestCallOptions } from '../types/requests.js';
import { signPayload } from './signature.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Формирует базовый URL API из явных опций или переменных окружения.
 */
export function resolveBaseApiUrl(
  options: Pick<OrangeDataOptions, 'apiUrl' | 'host' | 'port' | 'baseUrl'>,
): string {
  if (options.apiUrl) {
    return options.apiUrl.replace(/\/+$/, '');
  }

  const isProd = process.env.NODE_ENV === 'production';
  const envHost = process.env.OD_HOST;
  const envPort = process.env.OD_PORT;
  const envBase = process.env.OD_BASE_URL;

  if (!options.host && !options.port && !options.baseUrl && !envHost && !envPort && !envBase) {
    return isProd ? DEFAULT_PROD_API_URL : DEFAULT_TEST_API_URL;
  }

  const host = options.host ?? envHost ?? (isProd ? 'api.orangedata.ru' : 'apip.orangedata.ru');
  const port = options.port ?? envPort ?? (isProd ? 12003 : 12001);
  const basePath = (options.baseUrl ?? envBase ?? 'api/v2').replace(/^\/+|\/+$/g, '');

  return `https://${host}:${port}/${basePath}`;
}

/**
 * Безопасно склеивает базовый URL с относительным путём и query-параметрами,
 * не теряя префикс пути (`/api/v2`).
 */
export function buildRequestUrl(
  baseUrl: string,
  relativePath: string,
  params?: Record<string, string | number | boolean | undefined>,
): URL {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanRel = relativePath.replace(/^\/+/, '');
  const url = new URL(`${cleanBase}/${cleanRel}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }
  }

  return url;
}

function decompressBody(buffer: Buffer, encodingHeader: string | undefined): Buffer {
  if (buffer.length === 0 || !encodingHeader) return buffer;
  const encoding = encodingHeader.toLowerCase().trim();
  if (encoding === 'gzip' || encoding === 'x-gzip') {
    return gunzipSync(buffer);
  }
  if (encoding === 'deflate') {
    return inflateSync(buffer);
  }
  return buffer;
}

function parseRetryAfterSeconds(header: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return undefined;
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds;
  }
  return undefined;
}

function parseResponseBody(rawText: string): unknown {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return rawText;
  }
}

/**
 * Низкоуровневый mTLS HTTP-клиент для OrangeData API v2 без внешних зависимостей.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly agent: https.Agent;
  private readonly privateKey: OrangeDataOptions['privateKey'];
  private readonly defaultTimeout: number;

  constructor(options: OrangeDataOptions) {
    this.baseUrl = resolveBaseApiUrl(options);
    this.privateKey = options.privateKey;
    this.defaultTimeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

    this.agent = new https.Agent({
      keepAlive: true,
      ca: options.ca,
      cert: options.cert,
      key: options.key,
      passphrase: options.passphrase,
      rejectUnauthorized: options.strictSSL ?? true,
    });
  }

  public get<TResponse = unknown>(
    path: string,
    callOptions?: RequestCallOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>('GET', path, undefined, callOptions);
  }

  public post<TResponse = unknown>(
    path: string,
    data?: unknown,
    callOptions?: RequestCallOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>('POST', path, data, callOptions);
  }

  public request<TResponse = unknown>(
    method: HttpMethod,
    path: string,
    data?: unknown,
    callOptions?: RequestCallOptions,
  ): Promise<TResponse> {
    const url = buildRequestUrl(this.baseUrl, path, callOptions?.params);
    const timeoutMs = callOptions?.timeout ?? this.defaultTimeout;
    const signal = callOptions?.signal;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Cache-Control': 'no-cache',
      'User-Agent': 'orangedata-ts/2.0.0',
    };

    let bodyBuffer: Buffer | undefined;
    let serializedData: unknown;

    if (data !== undefined) {
      let jsonBody: string;
      try {
        jsonBody = JSON.stringify(data);
        serializedData = JSON.parse(jsonBody);
      } catch (err) {
        return Promise.reject(
          new OrangeDataError('Не удалось сериализовать тело запроса в JSON', undefined, {
            cause: err,
          }),
        );
      }

      let signature: string;
      try {
        signature = signPayload(jsonBody, this.privateKey);
      } catch (err) {
        return Promise.reject(err);
      }

      bodyBuffer = Buffer.from(jsonBody, 'utf8');
      headers['Content-Type'] = 'application/json; charset=utf-8';
      headers['Content-Length'] = String(bodyBuffer.byteLength);
      headers['X-Signature'] = signature;
    }

    return new Promise<TResponse>((resolve, reject) => {
      if (signal?.aborted) {
        reject(
          new OrangeDataError('Запрос к OrangeData был отменён (AbortSignal)', undefined, {
            cause: signal.reason,
          }),
        );
        return;
      }

      let settled = false;
      const finishResolve = (val: TResponse) => {
        if (!settled) {
          settled = true;
          cleanupAbort();
          resolve(val);
        }
      };
      const finishReject = (err: unknown) => {
        if (!settled) {
          settled = true;
          cleanupAbort();
          reject(err);
        }
      };

      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          method,
          headers,
          agent: this.agent,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });

          res.on('error', (err) => {
            finishReject(
              new OrangeDataError(`Ошибка чтения ответа от OrangeData: ${err.message}`, undefined, {
                cause: err,
              }),
            );
          });

          res.on('end', () => {
            try {
              const rawBuffer = Buffer.concat(chunks);
              const contentEncoding = res.headers['content-encoding'];
              const decodedBuffer = decompressBody(rawBuffer, contentEncoding);
              const rawText = decodedBuffer.toString('utf8');
              const parsedBody = parseResponseBody(rawText);
              const statusCode = res.statusCode ?? 0;

              if (statusCode >= 200 && statusCode < 300) {
                if (statusCode === 202 || parsedBody === null) {
                  finishResolve(null as TResponse);
                  return;
                }
                finishResolve(parsedBody as TResponse);
                return;
              }

              const apiErrors =
                parsedBody !== null &&
                typeof parsedBody === 'object' &&
                'errors' in parsedBody &&
                Array.isArray((parsedBody as { errors?: unknown }).errors)
                  ? (parsedBody as { errors: unknown[] }).errors.map((e) => String(e))
                  : undefined;

              const retryAfter = parseRetryAfterSeconds(res.headers['retry-after']);

              finishReject(
                new OrangeDataApiError({
                  statusCode,
                  message: res.statusMessage,
                  errors: apiErrors,
                  retryAfter,
                  sentData: serializedData,
                  request: {
                    method,
                    url: url.toString(),
                    headers,
                  },
                  response: {
                    statusCode,
                    headers: res.headers as IncomingHttpHeaders,
                    body: parsedBody,
                  },
                }),
              );
            } catch (err) {
              finishReject(
                new OrangeDataError(
                  `Ошибка декодирования ответа от OrangeData: ${err instanceof Error ? err.message : String(err)}`,
                  undefined,
                  { cause: err },
                ),
              );
            }
          });
        },
      );

      const onAbort = () => {
        req.destroy();
        finishReject(
          new OrangeDataError('Запрос к OrangeData был отменён (AbortSignal)', undefined, {
            cause: signal?.reason,
          }),
        );
      };

      const cleanupAbort = () => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      if (timeoutMs > 0) {
        req.setTimeout(timeoutMs, () => {
          req.destroy();
          finishReject(
            new OrangeDataError(`Превышено время ожидания ответа от OrangeData (${timeoutMs} мс)`),
          );
        });
      }

      req.on('error', (err) => {
        finishReject(
          new OrangeDataError(
            `Сетевая ошибка при обращении к OrangeData: ${err.message}`,
            undefined,
            {
              cause: err,
            },
          ),
        );
      });

      if (bodyBuffer) {
        req.write(bodyBuffer);
      }
      req.end();
    });
  }

  /**
   * Закрывает открытые keep-alive соединения `https.Agent`.
   */
  public destroy(): void {
    this.agent.destroy();
  }
}
