import { setTimeout as delay } from 'node:timers/promises';
import {
  OrangeDataApiError,
  OrangeDataError,
  OrangeDataValidationError,
} from '../errors/errors.js';
import { Correction } from '../models/Correction.js';
import { ItemCode } from '../models/ItemCode.js';
import { Order } from '../models/Order.js';
import type {
  OrangeDataOptions,
  PollStatusOptions,
  RequestCallOptions,
} from '../types/requests.js';
import type {
  CorrectionStatusResponse,
  ItemCodeStatusResponse,
  OrderStatusResponse,
} from '../types/responses.js';
import { validateServiceOptions } from '../validation/schemas.js';
import { HttpClient } from './HttpClient.js';

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_POLL_MAX_ATTEMPTS = 15;

function assertInnAndId(inn: string, id: string): void {
  if (!inn || !id) {
    throw new OrangeDataError('Не указан ИНН или id документа');
  }
}

/**
 * Основной клиент для взаимодействия с онлайн-кассами OrangeData API v2.
 */
export class OrangeData {
  public readonly httpClient: HttpClient;
  private readonly validateOnSend: boolean;

  constructor(options: OrangeDataOptions) {
    const errors = validateServiceOptions(options);
    if (Object.keys(errors).length > 0) {
      throw new OrangeDataValidationError(
        errors,
        'Некорректные параметры инициализации OrangeData',
      );
    }

    this.validateOnSend = options.validateOnSend ?? true;
    this.httpClient = new HttpClient(options);
  }

  /**
   * Отправляет фискальный чек (`POST /documents`).
   * При успешной постановке чека в очередь сервер возвращает `201 Created`.
   */
  public async sendOrder(order: Order, callOptions?: RequestCallOptions): Promise<void> {
    if (!(order instanceof Order)) {
      throw new OrangeDataError('Объект документа не является экземпляром класса Order');
    }
    if (this.validateOnSend) {
      order.validate();
    }
    await this.httpClient.post<null>('/documents', order, callOptions);
  }

  /**
   * Отправляет чек коррекции ФФД 1.05 (`POST /corrections`).
   */
  public async sendCorrection(
    correction: Correction,
    callOptions?: RequestCallOptions,
  ): Promise<void> {
    if (!(correction instanceof Correction)) {
      throw new OrangeDataError('Объект не является экземпляром класса Correction');
    }
    if (this.validateOnSend) {
      correction.validate();
    }
    await this.httpClient.post<null>('/corrections', correction, callOptions);
  }

  /**
   * Отправляет чек коррекции ФФД 1.2 (`POST /correction12`).
   */
  public async sendCorrection12(
    correction: Correction,
    callOptions?: RequestCallOptions,
  ): Promise<void> {
    if (!(correction instanceof Correction)) {
      throw new OrangeDataError('Объект не является экземпляром класса Correction');
    }
    if (this.validateOnSend) {
      correction.validate();
    }
    await this.httpClient.post<null>('/correction12', correction, callOptions);
  }

  /**
   * Проверяет статус ранее отправленного чека (`GET /documents/{inn}/status/{id}`).
   * Возвращает объект пробитого чека (`200 OK`) или `null`, если чек ещё в очереди (`202 Accepted`).
   */
  public async getOrderStatus(
    inn: string,
    id: string,
    callOptions?: RequestCallOptions,
  ): Promise<OrderStatusResponse | null> {
    assertInnAndId(inn, id);
    return this.httpClient.get<OrderStatusResponse | null>(
      `/documents/${encodeURIComponent(inn)}/status/${encodeURIComponent(id)}`,
      callOptions,
    );
  }

  /**
   * Проверяет статус чека коррекции ФФД 1.05 (`GET /corrections/{inn}/status/{id}`).
   */
  public async getCorrectionStatus(
    inn: string,
    id: string,
    callOptions?: RequestCallOptions,
  ): Promise<CorrectionStatusResponse | null> {
    assertInnAndId(inn, id);
    return this.httpClient.get<CorrectionStatusResponse | null>(
      `/corrections/${encodeURIComponent(inn)}/status/${encodeURIComponent(id)}`,
      callOptions,
    );
  }

  /**
   * Проверяет статус чека коррекции ФФД 1.2 (`GET /correction12/{inn}/status/{id}`).
   */
  public async getCorrection12Status(
    inn: string,
    id: string,
    callOptions?: RequestCallOptions,
  ): Promise<CorrectionStatusResponse | null> {
    assertInnAndId(inn, id);
    return this.httpClient.get<CorrectionStatusResponse | null>(
      `/correction12/${encodeURIComponent(inn)}/status/${encodeURIComponent(id)}`,
      callOptions,
    );
  }

  /**
   * Отправляет запрос на проверку кода маркировки (`POST /itemcode`, ФФД 1.2).
   */
  public async checkItemCode(itemCode: ItemCode, callOptions?: RequestCallOptions): Promise<void> {
    if (!(itemCode instanceof ItemCode)) {
      throw new OrangeDataError('Объект не является экземпляром класса ItemCode');
    }
    if (this.validateOnSend) {
      itemCode.validate();
    }
    await this.httpClient.post<null>('/itemcode', itemCode, callOptions);
  }

  /**
   * Получает результат проверки кода маркировки (`GET /itemcode/{inn}/status/{id}`).
   */
  public async getItemCodeStatus(
    inn: string,
    id: string,
    callOptions?: RequestCallOptions,
  ): Promise<ItemCodeStatusResponse | null> {
    assertInnAndId(inn, id);
    return this.httpClient.get<ItemCodeStatusResponse | null>(
      `/itemcode/${encodeURIComponent(inn)}/status/${encodeURIComponent(id)}`,
      callOptions,
    );
  }

  /**
   * Периодически опрашивает статус чека до завершения фискализации (`200 OK`)
   * или исчерпания лимита попыток (в этом случае возвращает `null`).
   */
  public async waitForOrderStatus(
    inn: string,
    id: string,
    options?: PollStatusOptions,
  ): Promise<OrderStatusResponse | null> {
    return this.pollStatus(
      () => this.getOrderStatus(inn, id, { signal: options?.signal }),
      options,
    );
  }

  /**
   * Периодически опрашивает статус чека коррекции ФФД 1.05.
   */
  public async waitForCorrectionStatus(
    inn: string,
    id: string,
    options?: PollStatusOptions,
  ): Promise<CorrectionStatusResponse | null> {
    return this.pollStatus(
      () => this.getCorrectionStatus(inn, id, { signal: options?.signal }),
      options,
    );
  }

  /**
   * Периодически опрашивает статус чека коррекции ФФД 1.2.
   */
  public async waitForCorrection12Status(
    inn: string,
    id: string,
    options?: PollStatusOptions,
  ): Promise<CorrectionStatusResponse | null> {
    return this.pollStatus(
      () => this.getCorrection12Status(inn, id, { signal: options?.signal }),
      options,
    );
  }

  /**
   * Периодически опрашивает результат проверки кода маркировки.
   */
  public async waitForItemCodeStatus(
    inn: string,
    id: string,
    options?: PollStatusOptions,
  ): Promise<ItemCodeStatusResponse | null> {
    return this.pollStatus(
      () => this.getItemCodeStatus(inn, id, { signal: options?.signal }),
      options,
    );
  }

  /**
   * Освобождает ресурсы HTTP-агента (keep-alive сокеты).
   */
  public destroy(): void {
    this.httpClient.destroy();
  }

  private async pollStatus<TResult>(
    fetcher: () => Promise<TResult | null>,
    options?: PollStatusOptions,
  ): Promise<TResult | null> {
    const intervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const maxAttempts = options?.maxAttempts ?? DEFAULT_POLL_MAX_ATTEMPTS;
    const retryOnError = options?.retryOnError ?? true;
    const signal = options?.signal;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let waitMs = intervalMs;
      try {
        const status = await fetcher();
        if (status !== null) {
          return status;
        }
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        // Нефатальные ошибки (сеть или 503) повторяем, если включён retryOnError; 400/401 пробрасываем сразу
        if (
          !retryOnError ||
          (error instanceof OrangeDataApiError && error.statusCode >= 400 && error.statusCode < 500)
        ) {
          throw error;
        }
        if (error instanceof OrangeDataApiError && error.retryAfter !== undefined) {
          waitMs = Math.max(intervalMs, error.retryAfter * 1000);
        }
        if (attempt === maxAttempts) {
          throw error;
        }
      }

      if (attempt < maxAttempts) {
        try {
          await delay(waitMs, undefined, signal ? { signal } : undefined);
        } catch (err) {
          throw new OrangeDataError(
            'Ожидание статуса документа было отменено (AbortSignal)',
            undefined,
            {
              cause: err,
            },
          );
        }
      }
    }

    return null;
  }
}
