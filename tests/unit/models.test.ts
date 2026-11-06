import { describe, expect, it } from 'vitest';
import {
  AgentFlag,
  Correction,
  CorrectionType,
  FfdVersion,
  ItemCode,
  OrangeDataApiError,
  OrangeDataError,
  OrangeDataValidationError,
  Order,
  PaymentMethodType,
  PaymentSubjectType,
  PaymentType,
  PlannedStatus,
  ReceiptType,
  TaxationSystem,
  TaxRate,
} from '../../src/index.js';

describe('Document Models: Order, Correction, ItemCode & Errors', () => {
  it('builds a clean FFD 1.2 Order, preserves constructor agentType, and normalizes supplierINN', () => {
    const order = new Order({
      id: 'ord_100',
      inn: '781304608018',
      ffdVersion: FfdVersion.Ffd12,
      type: ReceiptType.Income,
      taxationSystem: TaxationSystem.USNIncome,
      agentType: AgentFlag.BankPaymentAgent | AgentFlag.PaymentAgent, // 5
      customerContact: '+79991234567',
      senderEmail: 'info@fansdream.ru',
      group: 'main_2',
      key: '781304608018',
      callbackUrl: 'https://fansdream.ru/api/webhook',
      ignoreItemCodeCheck: true,
      useTax20: false,
    });

    order
      .addPosition({
        text: 'Джерси игровая',
        quantity: 1,
        price: 15000,
        tax: TaxRate.NoVat,
        paymentMethodType: PaymentMethodType.FullPrepayment,
        paymentSubjectType: PaymentSubjectType.Product,
        quantityMeasurementUnit: 0,
        supplierInfo: {
          name: 'ИП Забежинский Димитрий Ильич',
          phoneNumbers: ['+79037382012'],
          inn: '781304608018',
        },
      })
      .addPayment({
        type: PaymentType.Cashless,
        amount: 15000,
      })
      .addElectronicPayment({
        amount: 15000,
        type: 1,
        id: 'tbank_tx_999',
        additionalInfo: 'SBP',
      })
      .addUserAttribute({
        name: 'Номер заказа',
        value: 'ord_100',
      });

    expect(() => order.validate()).not.toThrow();

    const json = order.toJSON() as { content: Order['content'] };
    expect(json.content.agentType).toBe(5);
    expect(json.content.positions[0]?.supplierINN).toBe('781304608018');
    expect(json.content.positions[0]?.supplierInfo).toEqual({
      name: 'ИП Забежинский Димитрий Ильич',
      phoneNumbers: ['+79037382012'],
    });
    expect(json.content.positions[0]?.quantityMeasurementUnit).toBe(0);
    expect(json.content.checkClose.electronicPaymentsInfo?.payments).toHaveLength(1);
    expect('vat1Sum' in json.content).toBe(false);
  });

  it('supports Order.addAgent, new USN VAT rates (5% / 7%), and strips quantityMeasurementUnit in FFD 1.05', () => {
    const order = new Order({
      id: 'ord_ffd105',
      inn: '7725713770',
      type: ReceiptType.Income,
      taxationSystem: TaxationSystem.USNIncome,
      customerContact: 'none',
    });

    order
      .addPosition({
        text: 'Услуга доставки',
        quantity: 1,
        price: 500,
        tax: TaxRate.Vat5, // ставка 5% УСН (id 7)
        quantityMeasurementUnit: 0, // должно быть проигнорировано в ФФД 1.05
      })
      .addPayment({ type: PaymentType.Cashless, amount: 500 })
      .addAgent({
        agentType: AgentFlag.OtherAgent,
        supplierPhoneNumbers: ['+79998887766'],
      });

    expect(() => order.validate()).not.toThrow();
    expect(order.content.ffdVersion).toBe(FfdVersion.Ffd105);
    expect(order.content.positions[0]?.quantityMeasurementUnit).toBeUndefined();
    expect(order.content.agentType).toBe(64);
  });

  it('throws OrangeDataValidationError with detailed paths when Order is invalid', () => {
    const invalidOrder = new Order({
      id: '',
      inn: '123',
      type: ReceiptType.Income,
      taxationSystem: TaxationSystem.OSN,
    });

    expect(() => invalidOrder.validate()).toThrowError(OrangeDataValidationError);
    try {
      invalidOrder.validate();
    } catch (err) {
      expect(err).toBeInstanceOf(OrangeDataError);
      expect(err).toBeInstanceOf(OrangeDataValidationError);
      const valErr = err as OrangeDataValidationError;
      expect(valErr.validationErrors.id).toBe('Требует заполнения');
      expect(valErr.validationErrors.inn).toContain('10 или 12');
      expect(valErr.validationErrors['content.positions']).toBe('Требует заполнения');
      expect(valErr.errors?.length).toBeGreaterThan(2);
    }
  });

  it('validates Correction for both FFD 1.05 and FFD 1.2', () => {
    // ФФД 1.05 — самостоятельная коррекция (causeDocumentNumber не обязателен)
    const corr105 = new Correction({
      id: 'corr_1',
      inn: '7725713770',
      group: 'Main',
      key: 'key1',
      callbackUrl: 'https://example.com/cb',
      ignoreItemCodeCheck: false,
      type: ReceiptType.Income,
      taxationSystem: TaxationSystem.OSN,
      correctionType: CorrectionType.Self,
      causeDocumentDate: '2026-10-01T00:00:00Z',
      totalSum: 1000,
      eCashSum: 1000,
      useTax20: true,
    });
    expect(() => corr105.validate()).not.toThrow();
    expect(corr105.toJSON()).toMatchObject({ id: 'corr_1', inn: '7725713770' });

    // ФФД 1.05 — по предписанию без номера документа должно упасть
    const corrMissingDocNum = new Correction({
      id: 'corr_bad',
      inn: '7725713770',
      type: ReceiptType.Income,
      taxationSystem: TaxationSystem.OSN,
      correctionType: CorrectionType.ByInstruction,
      causeDocumentDate: '2026-10-01',
      totalSum: 100,
    });
    expect(() => corrMissingDocNum.validate()).toThrowError(OrangeDataValidationError);

    // ФФД 1.2 — чек коррекции с позициями
    const corr12 = new Correction({
      id: 'corr_12',
      inn: '781304608018',
      ffdVersion: FfdVersion.Ffd12,
      type: ReceiptType.IncomeReturn,
      taxationSystem: TaxationSystem.USNIncome,
      correctionType: CorrectionType.ByInstruction,
      causeDocumentDate: '2026-11-01',
      causeDocumentNumber: 'ПРЕДП-42',
    });
    corr12
      .addPosition({
        text: 'Корректируемая позиция',
        quantity: 2,
        price: 250,
        tax: TaxRate.NoVat,
        quantityMeasurementUnit: 0,
        supplierInfo: { inn: '781304608018', name: 'Поставщик' },
      })
      .addPayment({ type: PaymentType.Cashless, amount: 500 })
      .addUserAttribute({ name: 'Причина', value: 'Возврат' });

    expect(() => corr12.validate()).not.toThrow();
    expect(corr12.content.positions?.[0]?.supplierINN).toBe('781304608018');
  });

  it('validates ItemCode model', () => {
    const ic = new ItemCode({
      id: 'ic_1',
      inn: '781304608018',
      group: 'Main',
      key: 'k1',
      callbackUrl: 'https://example.com',
      meta: 'test-meta',
      ignoreItemCodeCheck: false,
      plannedStatus: PlannedStatus.PieceSold,
      itemCode: '010460000000000021abcDEF1234567\u001d91EE06\u001d92xyz==',
      quantityMeasurementUnit: 0,
      quantity: 1,
      fractionalQuantity: { numerator: 1, denominator: 2 },
    });

    expect(() => ic.validate()).not.toThrow();
    expect(ic.toJSON()).toMatchObject({ id: 'ic_1', meta: 'test-meta' });

    const badIc = new ItemCode({
      id: '',
      inn: 'bad',
      plannedStatus: 999,
      itemCode: '',
    });
    expect(() => badIc.validate()).toThrowError(OrangeDataValidationError);
  });

  it('maintains proper Error prototype chain and metadata on OrangeDataApiError', () => {
    const apiErr = new OrangeDataApiError({
      statusCode: 503,
      retryAfter: 10,
      errors: ['Queue is full'],
      sentData: { id: '1' },
    });
    expect(apiErr).toBeInstanceOf(Error);
    expect(apiErr).toBeInstanceOf(OrangeDataError);
    expect(apiErr).toBeInstanceOf(OrangeDataApiError);
    expect(apiErr.statusCode).toBe(503);
    expect(apiErr.retryAfter).toBe(10);
    expect(apiErr.message).toContain('Очередь документов переполнена');

    const unknownStatusErr = new OrangeDataApiError({ statusCode: 502 });
    expect(unknownStatusErr.message).toBe('HTTP Error 502');
  });
});
