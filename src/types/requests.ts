import type { KeyObject } from 'node:crypto';
import type {
  CorrectionTypeValue,
  FfdVersionValue,
  PaymentMethodTypeValue,
  PaymentSubjectTypeValue,
  PaymentTypeValue,
  ReceiptTypeValue,
  TaxationSystemValue,
  TaxRateValue,
} from './enums.js';

/**
 * Параметры инициализации клиента `OrangeData`.
 */
export interface OrangeDataOptions {
  /**
   * Полный базовый URL API (например, `https://api.orangedata.ru:12003/api/v2`).
   * Если не указан, формируется из `host`, `port`, `baseUrl` или `NODE_ENV`.
   */
  apiUrl?: string;
  /** Хост API (по умолчанию из `OD_HOST` или контура `NODE_ENV`). */
  host?: string;
  /** Порт API (по умолчанию из `OD_PORT`, `12003` для prod, `12001` для dev). */
  port?: number | string;
  /** Путь базового API (по умолчанию `api/v2`). */
  baseUrl?: string;
  /** Корневой сертификат УЦ (`cacert.pem`). */
  ca: string | Buffer | Array<string | Buffer>;
  /** Клиентский TLS-сертификат (`client.crt`). */
  cert: string | Buffer;
  /** Приватный ключ клиентского TLS-сертификата (`client.key`). */
  key: string | Buffer;
  /** Пароль к клиентскому TLS-ключу (`passphrase`). */
  passphrase: string;
  /** Приватный RSA-ключ для подписи заголовка `X-Signature` (PEM строка, Buffer или `KeyObject`). */
  privateKey: string | Buffer | KeyObject;
  /** Проверять ли цепочку серверного TLS-сертификата (по умолчанию `true`). */
  strictSSL?: boolean;
  /** Таймаут HTTP-запроса в миллисекундах (по умолчанию `30000`). */
  timeout?: number;
  /** Валидировать ли документ перед отправкой на стороне клиента (по умолчанию `true`). */
  validateOnSend?: boolean;
}

/**
 * Дополнительные опции выполнения отдельного HTTP-запроса.
 */
export interface RequestCallOptions {
  /** Сигнал отмены запроса (`AbortSignal`). */
  signal?: AbortSignal;
  /** Индивидуальный таймаут запроса в миллисекундах. */
  timeout?: number;
  /** Query-параметры URL. */
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Параметры ожидания (поллинга) обработки документа в очереди ККТ.
 */
export interface PollStatusOptions {
  /** Интервал между опросами в мс (по умолчанию `2000`). При `503 Retry-After` берётся большее значение. */
  intervalMs?: number;
  /** Максимальное число попыток опроса (по умолчанию `15`). */
  maxAttempts?: number;
  /** Повторять ли попытки при временных сетевых ошибках и `503` (по умолчанию `true`). */
  retryOnError?: boolean;
  /** Сигнал отмены ожидания (`AbortSignal`). */
  signal?: AbortSignal;
}

/** Данные поставщика позиции (тег 1224). */
export interface SupplierInfo {
  /** Телефоны поставщика в формате `+{Ц}` (тег 1171). */
  phoneNumbers?: string[];
  /** Наименование поставщика (тег 1225, до 239 символов). */
  name?: string;
  /**
   * ИНН поставщика (тег 1226).
   * Примечание: если указан здесь и не указан на уровне позиции `supplierINN`,
   * конструктор позиции автоматически продублирует его в `supplierINN`.
   */
  inn?: string;
}

/** Данные платёжного агента на уровне позиции (тег 1223). */
export interface PositionAgentInfo {
  /** Операция платёжного агента (тег 1044, до 24 символов). */
  paymentAgentOperation?: string;
  /** Телефоны платёжного агента (тег 1073). */
  paymentAgentPhoneNumbers?: string[];
  /** Телефоны оператора по приёму платежей (тег 1074). */
  paymentOperatorPhoneNumbers?: string[];
  /** Наименование оператора перевода (тег 1026, до 64 символов). */
  paymentOperatorName?: string;
  /** Адрес оператора перевода (тег 1005, до 243 символов). */
  paymentOperatorAddress?: string;
  /** ИНН оператора перевода (тег 1016, 10 или 12 цифр). */
  paymentOperatorINN?: string;
  /** Телефоны оператора перевода (тег 1075). */
  paymentTransferOperatorPhoneNumbers?: string[];
}

/** Данные агента на уровне всего чека. */
export interface OrderAgentInput {
  /** Битовая маска признака агента от 1 до 127 (тег 1057). */
  agentType?: number;
  /** Телефоны оператора перевода (тег 1075). */
  paymentTransferOperatorPhoneNumbers?: string[];
  /** Операция платёжного агента (тег 1044, до 24 символов). */
  paymentAgentOperation?: string;
  /** Телефоны платёжного агента (тег 1073). */
  paymentAgentPhoneNumbers?: string[];
  /** Телефоны оператора по приёму платежей (тег 1074). */
  paymentOperatorPhoneNumbers?: string[];
  /** Наименование оператора перевода (тег 1026, до 64 символов). */
  paymentOperatorName?: string;
  /** Адрес оператора перевода (тег 1005, до 244 символов). */
  paymentOperatorAddress?: string;
  /** ИНН оператора перевода (тег 1016). */
  paymentOperatorINN?: string;
  /** Телефоны поставщика (тег 1171). */
  supplierPhoneNumbers?: string[];
}

/** Дробное количество маркированного товара (тег 1291, ФФД 1.2). */
export interface FractionalQuantity {
  /** Числитель (тег 1293). */
  numerator: number;
  /** Знаменатель (тег 1294). */
  denominator: number;
}

/** Отраслевой реквизит предмета расчёта или чека (теги 1260 / 1261). */
export interface IndustryAttribute {
  /** Идентификатор ФОИВ (тег 1262, до 3 символов). */
  foivId?: string;
  /** Дата документа основания в формате `ДД.ММ.ГГГГ` (тег 1263). */
  causeDocumentDate?: string;
  /** Номер документа основания (тег 1264, до 32 символов). */
  causeDocumentNumber?: string;
  /** Значение отраслевого реквизита (тег 1265, до 239 символов). */
  value?: string;
}

/** Операционный реквизит чека (тег 1270, ФФД 1.2). */
export interface OperationalAttribute {
  /** Дата и время операции в формате ISO 8601 (тег 1273). */
  date?: string;
  /** Идентификатор операции 0..255 (тег 1271). */
  id?: number;
  /** Данные операции (тег 1272, до 64 символов). */
  value?: string;
}

/** Сведения о покупателе (клиенте) (тег 1256, ФФД 1.2). */
export interface CustomerInfo {
  /** Наименование или ФИО покупателя (тег 1227, до 239 символов). */
  name?: string;
  /** ИНН покупателя (тег 1228). */
  inn?: string;
  /** Дата рождения `ДД.ММ.ГГГГ` (тег 1243). */
  birthDate?: string;
  /** Числовой код гражданства 1..999 (тег 1244). */
  citizenship?: number;
  /** Код вида документа, удостоверяющего личность 1..99 (тег 1245). */
  identityDocumentCode?: number;
  /** Данные документа, удостоверяющего личность (тег 1246, до 64 символов). */
  identityDocumentData?: string;
  /** Адрес покупателя (клиента) (тег 1254, до 256 символов). */
  address?: string;
}

/** Штрихкоды товара (ФФД 1.2). */
export interface ItemBarcodes {
  ean8?: string;
  ean13?: string;
  itf14?: string;
  gs1?: string;
  mi?: string;
  egais20?: string;
  egais30?: string;
  f1?: string;
  f2?: string;
  f3?: string;
  f4?: string;
  f5?: string;
  f6?: string;
}

/** Дополнительный реквизит пользователя (тег 1084). */
export interface UserAttributeInput {
  /** Наименование дополнительного реквизита (тег 1085, до 64 символов). */
  name: string;
  /** Значение дополнительного реквизита (тег 1086, до 234 символов). */
  value: string;
}

/** Позиция чека (предмет расчёта, тег 1059). */
export interface OrderPositionInput {
  /** Количество предмета расчёта (тег 1023, до 6 знаков после точки). */
  quantity: number;
  /** Цена за единицу предмета расчёта с учётом скидок и наценок (тег 1079, до 2 знаков). */
  price: number;
  /** Ставка НДС (тег 1199: `1..10`). */
  tax: TaxRateValue;
  /** Сумма НДС за предмет расчёта (тег 1200, до 2 знаков). */
  taxSum?: number;
  /** Наименование предмета расчёта (тег 1030, до 128 символов). */
  text: string;
  /** Признак способа расчёта (тег 1214: `1..7`). */
  paymentMethodType?: PaymentMethodTypeValue;
  /** Признак предмета расчёта (тег 1212: `1..27, 30..33`). */
  paymentSubjectType?: PaymentSubjectTypeValue;
  /** Код товара в base64 (тег 1162, ФФД 1.05). */
  nomenclatureCode?: string;
  /** ИНН поставщика (тег 1226). */
  supplierINN?: string;
  /** Данные поставщика (тег 1224). */
  supplierInfo?: SupplierInfo;
  /** Признак агента по предмету расчёта 1..127 (тег 1222). */
  agentType?: number;
  /** Данные агента по предмету расчёта (тег 1223). */
  agentInfo?: PositionAgentInfo;
  /** Единица измерения предмета расчёта (тег 1197, ФФД 1.05, до 16 символов). */
  unitOfMeasurement?: string;
  /** Дополнительный реквизит предмета расчёта (тег 1191, до 64 символов). */
  additionalAttribute?: string;
  /** Цифровой код страны происхождения товара (тег 1230, до 3 символов). */
  manufacturerCountryCode?: string;
  /** Номер таможенной декларации (тег 1231, до 32 символов). */
  customsDeclarationNumber?: string;
  /** Акциз (тег 1229, до 2 знаков). */
  excise?: number;
  /** Сумма налога на единицу (до 2 знаков). */
  unitTaxSum?: number;
  /** Мера количества предмета расчёта 0..255 (тег 2108, только для ФФД 1.2). */
  quantityMeasurementUnit?: number;
  /** Код маркировки товара (тег 2000, ФФД 1.2, до 223 символов). */
  itemCode?: string;
  /** Дробное количество маркированного товара (тег 1291, ФФД 1.2). */
  fractionalQuantity?: FractionalQuantity;
  /** Отраслевой реквизит предмета расчёта (тег 1260). */
  industryAttribute?: IndustryAttribute | IndustryAttribute[];
  /** Штрихкоды позиции (ФФД 1.2). */
  barcodes?: ItemBarcodes;
  /** Планируемый статус товара (тег 2003, ФФД 1.2). */
  plannedStatus?: number;
}

/** Оплата по чеку. */
export interface OrderPaymentInput {
  /** Тип оплаты (`1` — наличные, `2` — безналичные, `14` — предоплата, `15` — постоплата, `16` — встречное предоставление). */
  type: PaymentTypeValue;
  /** Сумма оплаты в рублях (до 2 знаков после точки). */
  amount: number;
}

/** Сведения об оплате безналичными (Приказ ФНС от 26.03.2025 № ЕД-7-20/236@, тег 1235). */
export interface CashlessPaymentItem {
  /** Сумма оплаты безналичными (тег 1082, до 2 знаков). */
  amount: number;
  /** Признак способа оплаты безналичными 0..255 (тег 1236). */
  type: number;
  /** Идентификаторы безналичной оплаты (тег 1237, 1..256 символов). */
  id: string;
  /** Дополнительные сведения о безналичной оплате (тег 1238, 1..256 символов). */
  additionalInfo?: string;
}

/** Контейнер сведений о безналичных платежах (тег 1234). */
export interface ElectronicPaymentsInfo {
  payments: CashlessPaymentItem[];
}

/** Секция закрытия чека (`checkClose`). */
export interface CheckClose {
  taxationSystem: TaxationSystemValue;
  payments: OrderPaymentInput[];
  electronicPaymentsInfo?: ElectronicPaymentsInfo;
}

/**
 * Входные параметры конструктора `Order` (фискальный чек).
 */
export interface OrderInput extends OrderAgentInput {
  /** Уникальный идентификатор документа в вашей системе (до 64 символов). */
  id: string;
  /** ИНН организации или ИП (10 или 12 цифр). */
  inn: string;
  /** Группа устройств ККТ (по умолчанию `'Main'`, до 32 символов). */
  group?: string;
  /** Имя ключа для проверки подписи на стороне OrangeData (до 32 символов). */
  key?: string;
  /** URL для вебхук-уведомления о фискализации чека (до 1024 символов). */
  callbackUrl?: string;
  /** Игнорировать ошибку проверки кода маркировки. */
  ignoreItemCodeCheck?: boolean;
  /** Версия ФФД (`2` — ФФД 1.05 по умолчанию, `4` — ФФД 1.2). */
  ffdVersion?: FfdVersionValue;
  /** Признак расчёта (`1` — приход, `2` — возврат прихода, `3` — расход, `4` — возврат расхода). */
  type: ReceiptTypeValue;
  /** Система налогообложения (`0..5`). */
  taxationSystem: TaxationSystemValue;
  /** Сведения о безналичной оплате (тег 1234). */
  electronicPaymentsInfo?: ElectronicPaymentsInfo;
  /** Телефон `+{Ц}`, email покупателя или `'none'` (тег 1008, до 64 символов). */
  customerContact?: string;
  /** Покупатель — наименование / ФИО (тег 1227, ФФД 1.05, до 243 символов). */
  customer?: string;
  /** ИНН покупателя (тег 1228, ФФД 1.05). */
  customerINN?: string;
  /** Заводской номер автомата (тег 1036, до 20 символов). */
  automatNumber?: string;
  /** Адрес расчётов (тег 1009, до 243 символов). */
  settlementAddress?: string;
  /** Место расчётов — сайт или торговая точка (тег 1187, до 243 символов). */
  settlementPlace?: string;
  /** Дополнительный реквизит чека (тег 1192, до 16 символов). */
  additionalAttribute?: string;
  /** Должность и ФИО кассира (тег 1021, до 64 символов). */
  cashier?: string;
  /** ИНН кассира (тег 1203, 12 цифр). */
  cashierINN?: string;
  /** Email отправителя чека (тег 1117, до 64 символов). */
  senderEmail?: string;
  /** Итоговая сумма чека (тег 1020, до 2 знаков). */
  totalSum?: number;
  vat1Sum?: number;
  vat2Sum?: number;
  vat3Sum?: number;
  vat4Sum?: number;
  vat5Sum?: number;
  vat6Sum?: number;
  vat7Sum?: number;
  vat8Sum?: number;
  vat9Sum?: number;
  vat10Sum?: number;
  /** Принудительно использовать ставку НДС 20% вместо 22% для `tax: 1 | 3`. */
  useTax20?: boolean;
  /** Расширенные сведения о покупателе (тег 1256, ФФД 1.2). */
  customerInfo?: CustomerInfo;
  /** Операционный реквизит чека (тег 1270, ФФД 1.2). */
  operationalAttribute?: OperationalAttribute;
  /** Отраслевой реквизит чека (тег 1261). */
  industryAttribute?: IndustryAttribute | IndustryAttribute[];
}

/**
 * Входные параметры конструктора `Correction` (чек коррекции ФФД 1.05 или ФФД 1.2).
 */
export interface CorrectionInput {
  /** Уникальный идентификатор документа коррекции (до 64 символов). */
  id: string;
  /** ИНН организации или ИП (10 или 12 цифр). */
  inn: string;
  /** Группа устройств ККТ (до 32 символов). */
  group?: string;
  /** Имя ключа подписи (до 32 символов). */
  key?: string;
  /** URL для callback-уведомления (до 1024 символов). */
  callbackUrl?: string;
  /** Игнорировать ошибку проверки кода маркировки. */
  ignoreItemCodeCheck?: boolean;
  /** Версия ФФД (`2` — ФФД 1.05 по умолчанию, `4` — ФФД 1.2). */
  ffdVersion?: FfdVersionValue;
  /** Признак расчёта (`1` или `3` для ФФД 1.05; `1..4` для ФФД 1.2). */
  type: ReceiptTypeValue;
  /** Система налогообложения (для ФФД 1.05 передаётся на верхнем уровне, для ФФД 1.2 — в `checkClose`). */
  taxationSystem?: TaxationSystemValue;
  /** Тип коррекции (`0` — самостоятельно, `1` — по предписанию). */
  correctionType: CorrectionTypeValue;
  /** Дата документа основания (ISO 8601). */
  causeDocumentDate: string;
  /** Номер документа основания (обязателен при `correctionType === 1`, до 32 символов). */
  causeDocumentNumber?: string;
  /** Общая сумма чека коррекции (обязательна для ФФД 1.05). */
  totalSum?: number;
  cashSum?: number;
  eCashSum?: number;
  prepaymentSum?: number;
  postpaymentSum?: number;
  otherPaymentTypeSum?: number;
  tax1Sum?: number;
  tax2Sum?: number;
  tax3Sum?: number;
  tax4Sum?: number;
  tax5Sum?: number;
  tax6Sum?: number;
  tax7Sum?: number;
  tax8Sum?: number;
  tax9Sum?: number;
  tax10Sum?: number;
  vat1Sum?: number;
  vat2Sum?: number;
  vat3Sum?: number;
  vat4Sum?: number;
  vat5Sum?: number;
  vat6Sum?: number;
  vat7Sum?: number;
  vat8Sum?: number;
  vat9Sum?: number;
  vat10Sum?: number;
  /** Принудительно использовать ставку НДС 20% вместо 22%. */
  useTax20?: boolean;
  automatNumber?: string;
  settlementAddress?: string;
  settlementPlace?: string;
  /** Позиции коррекции (для ФФД 1.2). */
  positions?: OrderPositionInput[];
  /** Закрытие чека коррекции (для ФФД 1.2). */
  checkClose?: CheckClose;
  customerContact?: string;
  additionalUserAttribute?: UserAttributeInput;
  additionalAttribute?: string;
  cashier?: string;
  cashierINN?: string;
  senderEmail?: string;
  customerInfo?: CustomerInfo;
  operationalAttribute?: OperationalAttribute;
  industryAttribute?: IndustryAttribute | IndustryAttribute[];
}

/**
 * Входные параметры конструктора `ItemCode` (проверка кода маркировки, ФФД 1.2).
 */
export interface ItemCodeInput {
  /** Уникальный идентификатор запроса (до 64 символов). */
  id: string;
  /** ИНН организации или ИП (10 или 12 цифр). */
  inn: string;
  /** Группа устройств ККТ (до 32 символов). */
  group?: string;
  /** Имя ключа подписи (до 32 символов). */
  key?: string;
  /** URL для callback-уведомления (до 1024 символов). */
  callbackUrl?: string;
  /** Произвольные метаданные запроса (до 128 символов). */
  meta?: string;
  /** Игнорировать ошибку проверки КМ. */
  ignoreItemCodeCheck?: boolean;
  /** Планируемый статус товара 0..256 (тег 2003). */
  plannedStatus: number;
  /** Строка кода маркировки (тег 2000, до 223 символов). */
  itemCode: string;
  /** Мера количества предмета расчёта 0..255 (тег 2108). */
  quantityMeasurementUnit?: number;
  /** Количество предмета расчёта (до 6 знаков). */
  quantity?: number;
  /** Дробное количество (тег 1291). */
  fractionalQuantity?: FractionalQuantity;
}
