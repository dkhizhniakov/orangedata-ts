/**
 * Общие фискальные реквизиты пробитого документа в ответе OrangeData API v2 (`200 OK`).
 */
export interface FiscalDocumentStatusBase {
  /** Уникальный идентификатор документа. */
  id: string;
  /** Серийный номер устройства в системе OrangeData. */
  deviceSN: string;
  /** Регистрационный номер ККТ (тег 1037). */
  deviceRN: string;
  /** Заводской номер фискального накопителя (ФН, тег 1041). */
  fsNumber: string;
  /** Наименование ОФД. */
  ofdName: string;
  /** Веб-сайт ОФД. */
  ofdWebsite: string;
  /** ИНН ОФД. */
  ofdinn: string;
  /** Веб-сайт ФНС. */
  fnsWebsite: string;
  /** ИНН пользователя ККТ. */
  companyINN: string;
  /** Наименование организации / ИП пользователя ККТ. */
  companyName: string;
  /** Порядковый номер фискального документа (ФД, тег 1040). */
  documentNumber: number;
  /** Номер смены (тег 1038). */
  shiftNumber: number;
  /** Номер чека за смену (тег 1042). */
  documentIndex: number;
  /** Дата и время пробития документа на ККТ (ISO 8601, тег 1012). */
  processedAt: string;
  /** Фискальный признак документа (ФП / ФПД, тег 1077). */
  fp: string;
  /** Итоговая сумма пробитого документа. */
  change?: number;
  /** URL callback-уведомления, если передавался. */
  callbackUrl?: string;
}

/**
 * Ответ `GET /documents/{inn}/status/{id}` при успешной фискализации (`200 OK`).
 * Если чек ещё находится в очереди (`202 Accepted`), метод возвращает `null`.
 */
export interface OrderStatusResponse extends FiscalDocumentStatusBase {
  /** Содержимое пробитого чека. */
  content: Record<string, unknown>;
}

/**
 * Ответ `GET /corrections/{inn}/status/{id}` или `GET /correction12/{inn}/status/{id}` (`200 OK`).
 * Если документ в очереди (`202 Accepted`), метод возвращает `null`.
 */
export interface CorrectionStatusResponse extends FiscalDocumentStatusBase {
  /** Содержимое пробитого чека коррекции. */
  content: Record<string, unknown>;
}

/** Результат проверки КМ в ФН / ИСМ (тег 2106). */
export interface ItemCodeCheckResult {
  /** Признак проверки КМ в ФН. */
  fsCheck: boolean;
  /** Результат проверки КП КМ в ФН. */
  fsCheckResult: boolean;
  /** Признак запроса о КМ в ИСМ. */
  ismCheck: boolean;
  /** Результат проверки КМ в ИСМ. */
  ismCheckResult: boolean;
  /** Результирующая оценка проверки КМ (сводный код тега 2106). */
  checkResultCode?: number;
}

/**
 * Ответ `GET /itemcode/{inn}/status/{id}` (`200 OK`).
 * Если проверка КМ ещё выполняется (`202 Accepted`), метод возвращает `null`.
 */
export interface ItemCodeStatusResponse {
  id: string;
  deviceSN: string;
  deviceRN: string;
  fsNumber: string;
  processedAt: string;
  content?: Record<string, unknown>;
  checkResult?: ItemCodeCheckResult;
  meta?: string;
  [key: string]: unknown;
}
