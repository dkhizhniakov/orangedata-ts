import { createValidator, type ValidationRule } from './engine.js';

/** Допустимое расхождение округления сумм в копейках (1 копейка = 0.01 руб.). */
const MAX_DIFF_KOPEKS = 1;

export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'string' && value.trim().length === 0) return true;
  return false;
}

/** Перевод суммы позиции `price * quantity` в целые копейки со стандартным математическим округлением. */
export function positionTotalKopeks(price: number, quantity: number): number {
  const product = Number((price * quantity).toFixed(10));
  return Math.round((product + Number.EPSILON) * 100);
}

/** Итоговая сумма всех позиций в рублях (точность до 2 знаков). */
export function totalPositions(positions: Array<{ price: number; quantity: number }> = []): number {
  const kopeks = positions.reduce(
    (sum, pos) => sum + positionTotalKopeks(pos.price, pos.quantity),
    0,
  );
  return kopeks / 100;
}

/** Итоговая сумма оплат в целых копейках. */
export function totalPaymentsKopeks(payments: Array<{ amount: number }> = []): number {
  return payments.reduce(
    (sum, payment) => sum + Math.round((Number(payment.amount) + Number.EPSILON) * 100),
    0,
  );
}

/** Итоговая сумма оплат в рублях (точность до 2 знаков). */
export function totalPayments(payments: Array<{ amount: number }> = []): number {
  return totalPaymentsKopeks(payments) / 100;
}

export const required: ValidationRule = (value) => {
  if (isEmpty(value)) return 'Требует заполнения';
  return false;
};

export function requiredIf<TParent = Record<string, unknown>>(
  predicate: (data: TParent, value: unknown) => boolean,
): ValidationRule {
  return (value, data) => {
    if (predicate(data as TParent, value) && isEmpty(value)) {
      return 'Требует заполнения';
    }
    return false;
  };
}

export function minLength(min: number): ValidationRule {
  return (value) => {
    if (!isEmpty(value) && typeof value === 'string' && value.length < min) {
      return `Должно быть не короче ${min} символов`;
    }
    return false;
  };
}

export function maxLength(max: number): ValidationRule {
  return (value) => {
    if (!isEmpty(value) && typeof value === 'string' && value.length > max) {
      return `Должно быть не длиннее ${max} символов`;
    }
    return false;
  };
}

export function minValue(min: number): ValidationRule {
  return (value) => {
    if (!isEmpty(value) && (typeof value !== 'number' || Number.isNaN(value) || value < min)) {
      return `Должно быть больше или равно ${min}`;
    }
    return false;
  };
}

export function maxValue(max: number): ValidationRule {
  return (value) => {
    if (!isEmpty(value) && (typeof value !== 'number' || Number.isNaN(value) || value > max)) {
      return `Должно быть меньше или равно ${max}`;
    }
    return false;
  };
}

export const integer: ValidationRule = (value) => {
  if (isEmpty(value)) return false;
  const str = String(value);
  if ((typeof value === 'number' && !Number.isInteger(value)) || !/^[+-]?\d+$/.test(str)) {
    return 'Должно быть целым числом';
  }
  return false;
};

export function decimal(maxFractionDigits = 2): ValidationRule {
  const pattern = new RegExp(`^[+-]?\\d+(?:\\.\\d{1,${maxFractionDigits}})?$`);
  return (value) => {
    if (isEmpty(value)) return false;
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return `Должно быть числом с точностью до ${maxFractionDigits} символов после точки`;
    }
    const str = String(value);
    if (!pattern.test(str)) {
      return `Должно быть числом с точностью до ${maxFractionDigits} символов после точки`;
    }
    return false;
  };
}

export const boolean: ValidationRule = (value) => {
  if (!isEmpty(value) && typeof value !== 'boolean') {
    return 'Должно быть булевым значением';
  }
  return false;
};

export function equals(expected: unknown): ValidationRule {
  return (value) => {
    if (!isEmpty(value) && value !== expected) {
      return `Должно быть "${String(expected)}"`;
    }
    return false;
  };
}

export function oneOf(allowed: readonly unknown[]): ValidationRule {
  return (value) => {
    if (!isEmpty(value) && !allowed.includes(value)) {
      return `Должно быть одним из: ${allowed.join(', ')}`;
    }
    return false;
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const email: ValidationRule = (value) => {
  if (isEmpty(value)) return false;
  if (
    typeof value !== 'string' ||
    value.length > 254 ||
    value.includes('..') ||
    !EMAIL_REGEX.test(value)
  ) {
    return 'Должно быть корректным адресом эл. почты';
  }
  return false;
};

export const phone: ValidationRule = (value) => {
  if (isEmpty(value)) return false;
  if (typeof value !== 'string' || !/^\+\d+$/.test(value)) {
    return 'Должно быть телефоном в формате +{Ц}';
  }
  return false;
};

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2999) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

/** Проверка даты в формате `ДД.ММ.ГГГГ` (допускается разделитель `.` или `/`). */
export const date: ValidationRule = (value) => {
  if (isEmpty(value)) return false;
  if (typeof value !== 'string') {
    return 'Должно быть строкой в формате ДД.ММ.ГГГГ';
  }
  const match = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(value);
  if (!match) {
    return 'Должно быть строкой в формате ДД.ММ.ГГГГ';
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) {
    return 'Должно быть строкой в формате ДД.ММ.ГГГГ';
  }
  return false;
};

const ISO_8601_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Проверка даты/времени в формате ISO 8601. */
export const isIso8601: ValidationRule = (value) => {
  if (isEmpty(value)) return false;
  if (typeof value !== 'string') {
    return 'Должно быть в формате ISO8601';
  }
  const match = ISO_8601_REGEX.exec(value);
  if (!match) {
    return 'Должно быть в формате ISO8601';
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) {
    return 'Должно быть в формате ISO8601';
  }
  if (match[4] !== undefined) {
    const hours = Number(match[4]);
    const minutes = Number(match[5]);
    const seconds = match[6] !== undefined ? Number(match[6]) : 0;
    if (hours > 23 || minutes > 59 || seconds > 59) {
      return 'Должно быть в формате ISO8601';
    }
  }
  return false;
};

/** Проверка ИНН юридического лица (10 цифр) или ИП/физлица (12 цифр) по контрольным числам ФНС. */
export const inn: ValidationRule = (value) => {
  if (isEmpty(value)) return false;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return 'ИНН должен содержать 10 или 12 цифр';
  }

  const ratios9 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  if (value.length === 10) {
    const checksum = (ratios9.reduce((sum, r, i) => sum + Number(value[i]) * r, 0) % 11) % 10;
    if (checksum !== Number(value[9])) {
      return 'Неверное значение ИНН.';
    }
    return false;
  }

  if (value.length === 12) {
    const ratios10 = [7, ...ratios9];
    const ratios11 = [3, ...ratios10];
    const n11 = (ratios10.reduce((sum, r, i) => sum + Number(value[i]) * r, 0) % 11) % 10;
    const n12 = (ratios11.reduce((sum, r, i) => sum + Number(value[i]) * r, 0) % 11) % 10;
    if (n11 !== Number(value[10]) || n12 !== Number(value[11])) {
      return 'Неверное значение ИНН.';
    }
    return false;
  }

  return 'ИНН должен содержать 10 или 12 цифр';
};

/** Максимальная сумма позиций чека в рублях. */
export function maxPositionsTotal(maxRubles: number): ValidationRule {
  return (positions) => {
    if (!Array.isArray(positions) || positions.length === 0) return false;
    if (totalPositions(positions) > maxRubles) {
      return `Итоговая сумма чека превышает максимально допустимую ${maxRubles} рублей.`;
    }
    return false;
  };
}

/** Максимальная сумма оплат чека в рублях. */
export function maxPaymentsTotal(maxRubles: number): ValidationRule {
  return (payments) => {
    if (!Array.isArray(payments) || payments.length === 0) return false;
    if (totalPayments(payments) > maxRubles) {
      return `Сумма оплаты превышает максимальную ${maxRubles} рублей.`;
    }
    return false;
  };
}

/** Сверка суммы позиций и суммы оплат (с учётом сдачи по наличным и допуска 1 коп.). */
export const amounts: ValidationRule = (rawCheckClose, rawContent) => {
  const checkClose = rawCheckClose as
    | { payments?: Array<{ type: number; amount: number }> }
    | undefined;
  const content = rawContent as
    | { positions?: Array<{ price: number; quantity: number }> }
    | undefined;
  const payments = checkClose?.payments ?? [];
  const positions = content?.positions ?? [];
  if (!Array.isArray(payments) || !Array.isArray(positions)) return false;

  const posKopeks = positions.reduce(
    (sum, p) => sum + positionTotalKopeks(Number(p?.price ?? 0), Number(p?.quantity ?? 0)),
    0,
  );
  const allPayKopeks = totalPaymentsKopeks(payments);
  const cashlessKopeks = totalPaymentsKopeks(payments.filter((p) => p?.type !== 1));

  if (posKopeks - allPayKopeks > MAX_DIFF_KOPEKS) {
    return 'Сумма всех типов оплаты меньше итога чека.';
  }
  if (cashlessKopeks - posKopeks > MAX_DIFF_KOPEKS) {
    return 'Вносимая безналичной оплатой сумма больше итога чека.';
  }
  return false;
};

const BASE64_REGEX = /^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;

export const validateNomenclatureCode: ValidationRule = (value) => {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value !== 'string' || !BASE64_REGEX.test(value)) {
    return 'Должно быть строкой, содержащий base64 кодированный массив';
  }
  return false;
};

export function or(rules: Array<ValidationRule>): ValidationRule {
  return (value, data) => {
    const errors = rules.map((rule) => rule(value, data));
    if (errors.every((err) => Boolean(err))) {
      return errors.filter((e): e is string => typeof e === 'string').join(' или ');
    }
    return false;
  };
}

export function arrayOf(itemRule: ValidationRule | Array<ValidationRule>): ValidationRule {
  return (values) => {
    if (values === undefined || values === null) return false;
    if (!Array.isArray(values)) return 'Должно быть массивом значений';
    if (values.length === 0) return 'Требует заполнения';

    const schema: Record<string, typeof itemRule> = {};
    for (let i = 0; i < values.length; i++) {
      schema[String(i)] = itemRule;
    }
    const result = createValidator(schema)(values as unknown as Record<string, unknown>);
    return Object.keys(result).length > 0 ? result : false;
  };
}

export function optionalObject(
  validator: (data?: unknown) => Record<string, string>,
): ValidationRule {
  return (value) => {
    if (value === undefined || value === null) return false;
    if (typeof value !== 'object' || Array.isArray(value)) {
      return 'Должно быть объектом';
    }
    const result = validator(value);
    return Object.keys(result).length > 0 ? result : false;
  };
}

export function objectOrArrayOf(
  validator: (data?: unknown) => Record<string, string>,
): ValidationRule {
  const single = optionalObject(validator);
  const multiple = arrayOf(optionalObject(validator));
  return (value, data) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return multiple(value, data);
    return single(value, data);
  };
}
