/**
 * Справочник стандартных текстовых описаний HTTP-кодов ошибок OrangeData API v2.
 */
export const ORANGE_API_ERRORS: Readonly<Record<number, string>> = {
  400: 'Некорректный запрос',
  401: 'Клиентский сертификат не прошел проверку',
  409: 'Чек с данным идентификатором уже был создан в системе',
  503: 'Очередь документов переполнена, повторите попытку позже',
};

/**
 * Детали выполненного HTTP-запроса/ответа при ошибке API.
 */
export interface ApiErrorContext {
  statusCode: number;
  message?: string;
  errors?: string[];
  retryAfter?: number;
  sentData?: unknown;
  request?: {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  response?: {
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
  };
  cause?: unknown;
}

/**
 * Базовый класс всех ошибок библиотеки `orangedata-ts`.
 */
export class OrangeDataError extends Error {
  /** Массив детальных ошибок валидации или ответа сервера OrangeData. */
  public readonly errors?: string[];

  constructor(message: string, errors?: string[], options?: ErrorOptions) {
    super(message, options);
    this.name = 'OrangeDataError';
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}

/**
 * Ошибка клиентской предвалидации документа (`Order`, `Correction`, `ItemCode`) или опций клиента.
 */
export class OrangeDataValidationError extends OrangeDataError {
  /** Словарь ошибок вида `{ 'content.positions.0.price': 'Требует заполнения' }`. */
  public readonly validationErrors: Readonly<Record<string, string>>;

  constructor(
    validationErrors: Record<string, string>,
    message = 'Содержимое документа некорректно',
  ) {
    const flattened = Object.entries(validationErrors).map(([key, err]) => `${key}: ${err}`);
    super(message, flattened);
    this.name = 'OrangeDataValidationError';
    this.validationErrors = validationErrors;
  }
}

/**
 * Ошибка ответа сервера OrangeData API v2 (HTTP статусы 4xx / 5xx).
 */
export class OrangeDataApiError extends OrangeDataError {
  /** HTTP статус-код ответа (например, `400`, `401`, `409`, `503`). */
  public readonly statusCode: number;
  /** Рекомендуемая задержка повтора в секундах из заголовка `Retry-After` (актуально для `503`). */
  public readonly retryAfter?: number;
  /** Отправленное тело запроса. */
  public readonly sentData?: unknown;
  /** Метаданные отправленного HTTP-запроса. */
  public readonly request?: ApiErrorContext['request'];
  /** Метаданные полученного HTTP-ответа. */
  public readonly response?: ApiErrorContext['response'];

  constructor(context: ApiErrorContext) {
    const defaultMessage =
      ORANGE_API_ERRORS[context.statusCode] ??
      context.message ??
      `HTTP Error ${context.statusCode}`;
    super(defaultMessage, context.errors, context.cause ? { cause: context.cause } : undefined);
    this.name = 'OrangeDataApiError';
    this.statusCode = context.statusCode;
    this.retryAfter = context.retryAfter;
    this.sentData = context.sentData;
    this.request = context.request;
    this.response = context.response;
  }
}
