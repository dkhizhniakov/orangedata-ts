export type RuleResult = string | Record<string, string> | false | null | undefined;

export type ValidationRule<TValue = unknown, TParent = Record<string, unknown>> = (
  value: TValue,
  parent: TParent,
) => RuleResult;

export type ValidationSchema = Record<string, ValidationRule | Array<ValidationRule>>;

/**
 * Объединяет массив правил валидации для одного поля: возвращает первую найденную ошибку.
 */
export function joinRules(rules: Array<ValidationRule>): ValidationRule {
  return (value, parent) => {
    for (const rule of rules) {
      const result = rule(value, parent);
      if (result) {
        if (typeof result === 'object' && Object.keys(result).length === 0) {
          continue;
        }
        return result;
      }
    }
    return false;
  };
}

/**
 * Создаёт функцию-валидатор объекта по декларативной схеме правил.
 * Возвращает плоский словарь ошибок `{ 'path.to.field': 'Текст ошибки' }`.
 */
export function createValidator(
  schema: ValidationSchema,
): (data?: unknown) => Record<string, string> {
  return (rawData?: unknown): Record<string, string> => {
    const data =
      rawData !== null && typeof rawData === 'object' ? (rawData as Record<string, unknown>) : {};
    const errors: Record<string, string> = {};

    for (const [key, ruleOrArray] of Object.entries(schema)) {
      const value = data[key];
      const result =
        typeof ruleOrArray === 'function'
          ? ruleOrArray(value, data)
          : joinRules(ruleOrArray)(value, data);

      if (!result) continue;

      if (typeof result === 'object') {
        for (const [subKey, subError] of Object.entries(result)) {
          errors[`${key}.${subKey}`] = subError;
        }
      } else {
        errors[key] = result;
      }
    }

    return errors;
  };
}

/**
 * Удаляет все ключи со значением `undefined` рекурсивно из plain-объектов и массивов,
 * сохраняя `Buffer` и другие специальные экземпляры нетронутыми.
 */
export function stripUndefined<T>(input: T): T {
  if (input === null || typeof input !== 'object') {
    return input;
  }
  if (Buffer.isBuffer(input)) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => stripUndefined(item)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    if (val !== undefined) {
      clean[key] = stripUndefined(val);
    }
  }
  return clean as T;
}
