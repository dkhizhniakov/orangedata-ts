import { describe, expect, it } from 'vitest';
import { createValidator, joinRules, stripUndefined } from '../../src/validation/engine.js';
import {
  amounts,
  arrayOf,
  boolean,
  date,
  decimal,
  email,
  equals,
  inn,
  integer,
  isEmpty,
  isIso8601,
  maxLength,
  maxPaymentsTotal,
  maxPositionsTotal,
  maxValue,
  minLength,
  minValue,
  objectOrArrayOf,
  oneOf,
  optionalObject,
  or,
  phone,
  required,
  requiredIf,
  totalPayments,
  totalPositions,
  validateNomenclatureCode,
} from '../../src/validation/rules.js';

describe('Validation engine & stripUndefined', () => {
  it('strips undefined keys recursively while preserving Buffers and arrays', () => {
    const buf = Buffer.from('abc');
    const input = {
      a: 1,
      b: undefined,
      c: { nested: 'ok', drop: undefined },
      d: [{ x: 1, y: undefined }],
      buf,
    };
    const cleaned = stripUndefined(input);
    expect(cleaned).toEqual({
      a: 1,
      c: { nested: 'ok' },
      d: [{ x: 1 }],
      buf,
    });
    expect('b' in cleaned).toBe(false);
    expect('drop' in cleaned.c).toBe(false);
  });

  it('handles non-object inputs and nested empty rule objects in joinRules', () => {
    const validator = createValidator({
      nested: [() => ({}), required],
    });
    expect(validator(null)).toEqual({ nested: 'Требует заполнения' });
    expect(joinRules([() => ({}), () => false])('ok', {})).toBe(false);
  });
});

describe('Primitive & format rules', () => {
  it('checks isEmpty and required / requiredIf', () => {
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty('')).toBe(true);
    expect(isEmpty('   ')).toBe(true);
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty(false)).toBe(false);

    expect(required('', {})).toBe('Требует заполнения');
    expect(required('val', {})).toBe(false);

    const reqIfOne = requiredIf<{ flag?: number }>((d) => d.flag === 1);
    expect(reqIfOne('', { flag: 1 })).toBe('Требует заполнения');
    expect(reqIfOne('', { flag: 0 })).toBe(false);
  });

  it('validates string lengths and numeric bounds', () => {
    expect(minLength(3)('ab', {})).toContain('не короче 3');
    expect(minLength(3)('abc', {})).toBe(false);
    expect(maxLength(3)('abcd', {})).toContain('не длиннее 3');
    expect(maxLength(3)('abc', {})).toBe(false);

    expect(minValue(5)(4, {})).toContain('больше или равно 5');
    expect(minValue(5)(Number.NaN, {})).toContain('больше или равно 5');
    expect(minValue(5)(5, {})).toBe(false);

    expect(maxValue(10)(11, {})).toContain('меньше или равно 10');
    expect(maxValue(10)(10, {})).toBe(false);
  });

  it('validates integer, decimal, boolean, equals, oneOf', () => {
    expect(integer(10, {})).toBe(false);
    expect(integer(10.5, {})).toBe('Должно быть целым числом');
    expect(integer('12a', {})).toBe('Должно быть целым числом');

    const dec2 = decimal(2);
    const dec6 = decimal(6);
    expect(dec2(100, {})).toBe(false);
    expect(dec2(100.25, {})).toBe(false);
    expect(dec2(100.255, {})).toContain('точностью до 2');
    expect(dec2(Number.POSITIVE_INFINITY, {})).toContain('точностью до 2');
    expect(dec6(0.000001, {})).toBe(false);
    expect(dec6(0.0000001, {})).toContain('точностью до 6');

    expect(boolean(true, {})).toBe(false);
    expect(boolean(false, {})).toBe(false);
    expect(boolean('true', {})).toBe('Должно быть булевым значением');

    expect(equals('none')('none', {})).toBe(false);
    expect(equals('none')('other', {})).toBe('Должно быть "none"');

    expect(oneOf([1, 2, 4])(2, {})).toBe(false);
    expect(oneOf([1, 2, 4])(3, {})).toContain('1, 2, 4');
  });

  it('validates email, phone, base64 nomenclatureCode', () => {
    expect(email('user@example.com', {})).toBe(false);
    expect(email('bad..email@domain..com', {})).toContain('эл. почты');
    expect(email('not-an-email', {})).toContain('эл. почты');
    expect(email(123, {})).toContain('эл. почты');

    expect(phone('+79991234567', {})).toBe(false);
    expect(phone('89991234567', {})).toContain('+{Ц}');
    expect(phone(79991234567, {})).toContain('+{Ц}');

    expect(validateNomenclatureCode(undefined, {})).toBe(false);
    expect(validateNomenclatureCode('RE0EMWGSYQ1yaHVzbyFOQklkWWZ0', {})).toBe(false);
    expect(validateNomenclatureCode('igQVAAADMTIzNDU2Nzg5MDEyMwAAAQ==', {})).toBe(false);
    expect(validateNomenclatureCode('not-base64!!!', {})).toContain('base64');
  });

  it('validates calendar dates (DD.MM.YYYY) and ISO 8601 dates accurately', () => {
    expect(date('29.02.2024', {})).toBe(false); // високосный год
    expect(date('29/02/2024', {})).toBe(false);
    expect(date('29.02.2025', {})).toContain('ДД.ММ.ГГГГ'); // невисокосный
    expect(date('31.04.2025', {})).toContain('ДД.ММ.ГГГГ');
    expect(date('2025-04-01', {})).toContain('ДД.ММ.ГГГГ');
    expect(date(12345, {})).toContain('ДД.ММ.ГГГГ');

    expect(isIso8601('2026-11-06', {})).toBe(false);
    expect(isIso8601('2026-11-06T15:30:00Z', {})).toBe(false);
    expect(isIso8601('2026-11-06T15:30:00.123+03:00', {})).toBe(false);
    expect(isIso8601('2025-02-29T10:00:00Z', {})).toBe('Должно быть в формате ISO8601');
    expect(isIso8601('2026-11-06T25:00:00Z', {})).toBe('Должно быть в формате ISO8601');
    expect(isIso8601('06.11.2026', {})).toBe('Должно быть в формате ISO8601');
    expect(isIso8601(123, {})).toBe('Должно быть в формате ISO8601');
  });

  it('validates 10-digit and 12-digit Russian INN checksums', () => {
    expect(inn('', {})).toBe(false);
    // Валидные 10-значные ИНН (юрлица)
    expect(inn('7725713770', {})).toBe(false);
    expect(inn('7727401209', {})).toBe(false);
    expect(inn('3123011520', {})).toBe(false);
    // Валидный 12-значный ИНН (ИП)
    expect(inn('781304608018', {})).toBe(false);

    // Ошибки контрольной суммы и длины
    expect(inn('7725713771', {})).toBe('Неверное значение ИНН.');
    expect(inn('781304608019', {})).toBe('Неверное значение ИНН.');
    expect(inn('781304608028', {})).toBe('Неверное значение ИНН.');
    expect(inn('12345', {})).toBe('ИНН должен содержать 10 или 12 цифр');
    expect(inn('772571377a', {})).toBe('ИНН должен содержать 10 или 12 цифр');
  });

  it('validates receipt totals and kopek-precise amounts without IEEE-754 float drift', () => {
    const positions = [
      { price: 0.1, quantity: 1 },
      { price: 0.2, quantity: 1 },
    ];
    expect(totalPositions(positions)).toBe(0.3);
    expect(totalPayments([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);

    // Точное совпадение и допуск 1 копейка
    expect(amounts({ payments: [{ type: 2, amount: 0.3 }] }, { positions })).toBe(false);
    expect(amounts({ payments: [{ type: 2, amount: 0.29 }] }, { positions })).toBe(false);
    expect(amounts({ payments: [{ type: 2, amount: 0.31 }] }, { positions })).toBe(false);

    // Недоплата > 1 копейки
    expect(amounts({ payments: [{ type: 2, amount: 0.28 }] }, { positions })).toContain(
      'меньше итога чека',
    );
    // Переплата безналичными > 1 копейки запрещена
    expect(amounts({ payments: [{ type: 2, amount: 0.32 }] }, { positions })).toContain(
      'больше итога чека',
    );
    // Переплата наличными (сдача, type === 1) разрешена
    expect(amounts({ payments: [{ type: 1, amount: 100 }] }, { positions })).toBe(false);

    expect(maxPositionsTotal(10)([{ price: 6, quantity: 2 }], {})).toContain('превышает');
    expect(maxPositionsTotal(20)([{ price: 6, quantity: 2 }], {})).toBe(false);
    expect(maxPaymentsTotal(10)([{ amount: 15 }], {})).toContain('превышает');
    expect(maxPaymentsTotal(20)([{ amount: 15 }], {})).toBe(false);
  });

  it('validates composite wrappers: or, arrayOf, optionalObject, objectOrArrayOf', () => {
    const contactRule = or([email, phone, equals('none')]);
    expect(contactRule('+79990001122', {})).toBe(false);
    expect(contactRule('test@mail.ru', {})).toBe(false);
    expect(contactRule('none', {})).toBe(false);
    expect(contactRule('invalid', {})).toContain('или');

    const arrRule = arrayOf([phone]);
    expect(arrRule(undefined, {})).toBe(false);
    expect(arrRule('not-array', {})).toBe('Должно быть массивом значений');
    expect(arrRule([], {})).toBe('Требует заполнения');
    expect(arrRule(['bad'], {})).toEqual({ '0': 'Должно быть телефоном в формате +{Ц}' });

    const objValidator = createValidator({ code: [required] });
    expect(optionalObject(objValidator)(null, {})).toBe(false);
    expect(optionalObject(objValidator)(['arr'], {})).toBe('Должно быть объектом');
    expect(optionalObject(objValidator)({}, {})).toEqual({ code: 'Требует заполнения' });

    const singleOrArr = objectOrArrayOf(objValidator);
    expect(singleOrArr(undefined, {})).toBe(false);
    expect(singleOrArr({ code: '1' }, {})).toBe(false);
    expect(singleOrArr([{ code: '1' }, { code: '2' }], {})).toBe(false);
    expect(singleOrArr([{}], {})).toEqual({ '0.code': 'Требует заполнения' });
  });
});
