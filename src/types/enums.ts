/**
 * Базовый URL боевого контура OrangeData API v2 по умолчанию.
 */
export const DEFAULT_PROD_API_URL = 'https://api.orangedata.ru:12003/api/v2';

/**
 * Базовый URL тестового контура OrangeData API v2 по умолчанию.
 */
export const DEFAULT_TEST_API_URL = 'https://apip.orangedata.ru:12001/api/v2';

/**
 * Версия ФФД (тег 1209).
 */
export const FfdVersion = {
  /** ФФД 1.05 */
  Ffd105: 2,
  /** ФФД 1.2 (поддержка маркировки «Честный ЗНАК») */
  Ffd12: 4,
} as const;

export type FfdVersionValue = (typeof FfdVersion)[keyof typeof FfdVersion];

/**
 * Признак расчёта (тег 1054).
 */
export const ReceiptType = {
  /** Приход */
  Income: 1,
  /** Возврат прихода */
  IncomeReturn: 2,
  /** Расход */
  Expense: 3,
  /** Возврат расхода */
  ExpenseReturn: 4,
} as const;

export type ReceiptTypeValue = (typeof ReceiptType)[keyof typeof ReceiptType];

/**
 * Тип коррекции (тег 1173).
 */
export const CorrectionType = {
  /** Самостоятельно */
  Self: 0,
  /** По предписанию налогового органа */
  ByInstruction: 1,
} as const;

export type CorrectionTypeValue = (typeof CorrectionType)[keyof typeof CorrectionType];

/**
 * Система налогообложения (тег 1055).
 */
export const TaxationSystem = {
  /** Общая система налогообложения (ОСН) */
  OSN: 0,
  /** Упрощённая (УСН доход) */
  USNIncome: 1,
  /** Упрощённая (УСН доход минус расход) */
  USNIncomeOutcome: 2,
  /** Единый налог на вменённый доход (ЕНВД — архивный) */
  ENVD: 3,
  /** Единый сельскохозяйственный налог (ЕСХН) */
  ESN: 4,
  /** Патентная система налогообложения (ПСН) */
  Patent: 5,
} as const;

export type TaxationSystemValue = (typeof TaxationSystem)[keyof typeof TaxationSystem];

/**
 * Ставка НДС предмета расчёта (тег 1199).
 *
 * С 01.01.2026 идентификатор `1` соответствует ставке **22%** (а `3` — расчётной **22/122**).
 * Для пробития возвратов/коррекций со старой ставкой 20% необходимо передать `useTax20: true` в документе.
 */
export const TaxRate = {
  /** Ставка НДС 22% (или 20% при `useTax20: true`) */
  Vat22: 1,
  /** Алиас для обратной совместимости (20% при `useTax20: true`, иначе 22%) */
  Vat20: 1,
  /** Ставка НДС 10% */
  Vat10: 2,
  /** Ставка НДС расчётная 22/122 (или 20/120 при `useTax20: true`) */
  Vat22Calculated: 3,
  /** Алиас для обратной совместимости (20/120 при `useTax20: true`, иначе 22/122) */
  Vat20Calculated: 3,
  /** Ставка НДС расчётная 10/110 */
  Vat10Calculated: 4,
  /** Ставка НДС 0% */
  Vat0: 5,
  /** НДС не облагается */
  NoVat: 6,
  /** Пониженная ставка НДС 5% (УСН) */
  Vat5: 7,
  /** Пониженная ставка НДС 7% (УСН) */
  Vat7: 8,
  /** Ставка НДС расчётная 5/105 (УСН) */
  Vat5Calculated: 9,
  /** Ставка НДС расчётная 7/107 (УСН) */
  Vat7Calculated: 10,
} as const;

export type TaxRateValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Признак способа расчёта (тег 1214).
 */
export const PaymentMethodType = {
  /** Предоплата 100% */
  FullPrepayment: 1,
  /** Частичная предоплата */
  PartialPrepayment: 2,
  /** Аванс */
  Advance: 3,
  /** Полный расчёт */
  FullPayment: 4,
  /** Частичный расчёт и кредит */
  PartialPaymentAndCredit: 5,
  /** Передача в кредит */
  TransferOnCredit: 6,
  /** Оплата кредита */
  CreditPayment: 7,
} as const;

export type PaymentMethodTypeValue = (typeof PaymentMethodType)[keyof typeof PaymentMethodType];

/**
 * Признак предмета расчёта (тег 1212).
 */
export const PaymentSubjectType = {
  /** Товар */
  Product: 1,
  /** Подакцизный товар */
  ExcisableProduct: 2,
  /** Работа */
  Work: 3,
  /** Услуга */
  Service: 4,
  /** Ставка азартной игры */
  GamblingBet: 5,
  /** Выигрыш азартной игры */
  GamblingWin: 6,
  /** Лотерейный билет */
  LotteryTicket: 7,
  /** Выигрыш лотереи */
  LotteryWin: 8,
  /** Предоставление РИД */
  IntellectualProperty: 9,
  /** Платёж */
  Payment: 10,
  /** Агентское вознаграждение */
  AgentCommission: 11,
  /** Выплата / Составной предмет расчёта */
  Composite: 12,
  /** Иной предмет расчёта */
  Other: 13,
  /** Имущественное право */
  PropertyRight: 14,
  /** Внереализационный доход */
  NonOperatingIncome: 15,
  /** Иные платежи и взносы / Страховые взносы */
  InsuranceContributions: 16,
  /** Торговый сбор */
  TradeFee: 17,
  /** Курортный сбор */
  ResortFee: 18,
  /** Залог */
  Pledge: 19,
  /** Расход */
  Expense: 20,
  /** Взносы на ОПС ИП */
  PensionInsuranceIP: 21,
  /** Взносы на ОПС */
  PensionInsurance: 22,
  /** Взносы на ОМС ИП */
  MedicalInsuranceIP: 23,
  /** Взносы на ОМС */
  MedicalInsurance: 24,
  /** Взносы на ОСС */
  SocialInsurance: 25,
  /** Платёж казино */
  CasinoPayment: 26,
  /** Выдача денежных средств */
  CashWithdrawal: 27,
  /** АТНМ (подакцизный товар, подлежащий маркировке, без кода маркировки — ФФД 1.2) */
  ExciseMarkedWithoutCode: 30,
  /** АТМ (подакцизный товар, подлежащий маркировке, с кодом маркировки — ФФД 1.2) */
  ExciseMarkedWithCode: 31,
  /** ТНМ (товар, подлежащий маркировке, без кода маркировки — ФФД 1.2) */
  MarkedWithoutCode: 32,
  /** ТМ (товар, подлежащий маркировке, с кодом маркировки — ФФД 1.2) */
  MarkedWithCode: 33,
} as const;

export type PaymentSubjectTypeValue = (typeof PaymentSubjectType)[keyof typeof PaymentSubjectType];

/**
 * Тип оплаты в закрытии чека (`checkClose.payments[].type`).
 */
export const PaymentType = {
  /** Сумма по чеку наличными (тег 1031) */
  Cash: 1,
  /** Сумма по чеку безналичными (тег 1081) */
  Cashless: 2,
  /** Сумма по чеку предоплатой (зачёт аванса и/или предыдущих платежей, тег 1215) */
  Prepayment: 14,
  /** Сумма по чеку постоплатой (в кредит, тег 1216) */
  Credit: 15,
  /** Сумма по чеку встречным предоставлением (тег 1217) */
  CounterProvision: 16,
} as const;

export type PaymentTypeValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

/**
 * Битовые флаги признака агента (тег 1057 / 1222).
 * Допускается побитовое сложение флагов (значение от 1 до 127).
 */
export const AgentFlag = {
  /** Банковский платёжный агент */
  BankPaymentAgent: 1,
  /** Банковский платёжный субагент */
  BankPaymentSubagent: 2,
  /** Платёжный агент */
  PaymentAgent: 4,
  /** Платёжный субагент */
  PaymentSubagent: 8,
  /** Поверенный */
  Attorney: 16,
  /** Комиссионер */
  Commissioner: 32,
  /** Агент */
  OtherAgent: 64,
} as const;

/**
 * Планируемый статус товара ФФД 1.2 (тег 2003).
 */
export const PlannedStatus = {
  /** Штучный товар реализован */
  PieceSold: 1,
  /** Мерный товар в стадии реализации */
  MeasuredSold: 2,
  /** Штучный товар возвращён */
  PieceReturned: 3,
  /** Часть товара возвращена */
  MeasuredReturned: 4,
  /** Статус товара не изменился */
  Unchanged: 255,
} as const;
