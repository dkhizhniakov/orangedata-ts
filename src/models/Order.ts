import { OrangeDataValidationError } from '../errors/errors.js';
import { FfdVersion, type FfdVersionValue } from '../types/enums.js';
import type {
  CashlessPaymentItem,
  CheckClose,
  CustomerInfo,
  IndustryAttribute,
  OperationalAttribute,
  OrderAgentInput,
  OrderInput,
  OrderPaymentInput,
  OrderPositionInput,
  UserAttributeInput,
} from '../types/requests.js';
import { stripUndefined } from '../validation/engine.js';
import { validateOrder } from '../validation/schemas.js';

export interface OrderContent extends OrderAgentInput {
  ffdVersion: FfdVersionValue;
  type: OrderInput['type'];
  positions: OrderPositionInput[];
  checkClose: CheckClose;
  customerContact?: string;
  customer?: string;
  customerINN?: string;
  additionalUserAttribute?: UserAttributeInput;
  automatNumber?: string;
  settlementAddress?: string;
  settlementPlace?: string;
  additionalAttribute?: string;
  cashier?: string;
  cashierINN?: string;
  senderEmail?: string;
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
  useTax20?: boolean;
  customerInfo?: CustomerInfo;
  operationalAttribute?: OperationalAttribute;
  industryAttribute?: IndustryAttribute | IndustryAttribute[];
}

/**
 * Модель фискального чека (`POST /api/v2/documents`).
 * Поддерживает ФФД 1.05 (`ffdVersion: 2`) и ФФД 1.2 (`ffdVersion: 4`).
 */
export class Order {
  public readonly id: string;
  public readonly inn: string;
  public readonly group?: string;
  public readonly key?: string;
  public readonly callbackUrl?: string;
  public readonly ignoreItemCodeCheck?: boolean;
  public readonly content: OrderContent;

  constructor(order: OrderInput) {
    this.id = order.id;
    this.inn = order.inn;
    if (order.group !== undefined) this.group = order.group;
    if (order.key !== undefined) this.key = order.key;
    if (order.callbackUrl !== undefined) this.callbackUrl = order.callbackUrl;
    if (order.ignoreItemCodeCheck !== undefined) {
      this.ignoreItemCodeCheck = order.ignoreItemCodeCheck;
    }

    this.content = stripUndefined<OrderContent>({
      ffdVersion: order.ffdVersion ?? FfdVersion.Ffd105,
      type: order.type,
      positions: [],
      checkClose: {
        taxationSystem: order.taxationSystem,
        payments: [],
        ...(order.electronicPaymentsInfo
          ? { electronicPaymentsInfo: order.electronicPaymentsInfo }
          : {}),
      },
      customerContact: order.customerContact,
      customer: order.customer,
      customerINN: order.customerINN,
      automatNumber: order.automatNumber,
      settlementAddress: order.settlementAddress,
      settlementPlace: order.settlementPlace,
      additionalAttribute: order.additionalAttribute,
      cashier: order.cashier,
      cashierINN: order.cashierINN,
      senderEmail: order.senderEmail,
      totalSum: order.totalSum,
      vat1Sum: order.vat1Sum,
      vat2Sum: order.vat2Sum,
      vat3Sum: order.vat3Sum,
      vat4Sum: order.vat4Sum,
      vat5Sum: order.vat5Sum,
      vat6Sum: order.vat6Sum,
      vat7Sum: order.vat7Sum,
      vat8Sum: order.vat8Sum,
      vat9Sum: order.vat9Sum,
      vat10Sum: order.vat10Sum,
      useTax20: order.useTax20,
      customerInfo: order.customerInfo,
      operationalAttribute: order.operationalAttribute,
      industryAttribute: order.industryAttribute,
      agentType: order.agentType,
      paymentTransferOperatorPhoneNumbers: order.paymentTransferOperatorPhoneNumbers,
      paymentAgentOperation: order.paymentAgentOperation,
      paymentAgentPhoneNumbers: order.paymentAgentPhoneNumbers,
      paymentOperatorPhoneNumbers: order.paymentOperatorPhoneNumbers,
      paymentOperatorName: order.paymentOperatorName,
      paymentOperatorAddress: order.paymentOperatorAddress,
      paymentOperatorINN: order.paymentOperatorINN,
      supplierPhoneNumbers: order.supplierPhoneNumbers,
    });
  }

  /**
   * Добавляет товарную позицию (предмет расчёта, тег 1059) в чек.
   */
  public addPosition(pos: OrderPositionInput): this {
    const resolvedSupplierINN = pos.supplierINN ?? pos.supplierInfo?.inn;
    const cleanSupplierInfo = pos.supplierInfo
      ? stripUndefined({
          phoneNumbers: pos.supplierInfo.phoneNumbers,
          name: pos.supplierInfo.name,
        })
      : undefined;

    const normalized = stripUndefined<OrderPositionInput>({
      quantity: pos.quantity,
      price: pos.price,
      tax: pos.tax,
      taxSum: pos.taxSum,
      text: pos.text,
      paymentMethodType: pos.paymentMethodType,
      paymentSubjectType: pos.paymentSubjectType,
      nomenclatureCode: pos.nomenclatureCode,
      supplierINN: resolvedSupplierINN,
      supplierInfo:
        cleanSupplierInfo && Object.keys(cleanSupplierInfo).length > 0
          ? cleanSupplierInfo
          : undefined,
      agentType: pos.agentType,
      agentInfo: pos.agentInfo,
      unitOfMeasurement: pos.unitOfMeasurement,
      additionalAttribute: pos.additionalAttribute,
      manufacturerCountryCode: pos.manufacturerCountryCode,
      customsDeclarationNumber: pos.customsDeclarationNumber,
      excise: pos.excise,
      unitTaxSum: pos.unitTaxSum,
      quantityMeasurementUnit:
        this.content.ffdVersion === FfdVersion.Ffd12 ? pos.quantityMeasurementUnit : undefined,
      itemCode: pos.itemCode,
      fractionalQuantity: pos.fractionalQuantity,
      industryAttribute: pos.industryAttribute,
      barcodes: pos.barcodes,
      plannedStatus: pos.plannedStatus,
    });

    this.content.positions.push(normalized);
    return this;
  }

  /**
   * Добавляет оплату в закрытие чека (`checkClose.payments`).
   */
  public addPayment(payment: OrderPaymentInput): this {
    this.content.checkClose.payments.push({
      type: payment.type,
      amount: payment.amount,
    });
    return this;
  }

  /**
   * Добавляет сведения об оплате безналичными (тег 1235, Приказ ФНС № ЕД-7-20/236@).
   */
  public addElectronicPayment(payment: CashlessPaymentItem): this {
    if (!this.content.checkClose.electronicPaymentsInfo) {
      this.content.checkClose.electronicPaymentsInfo = { payments: [] };
    }
    this.content.checkClose.electronicPaymentsInfo.payments.push(stripUndefined(payment));
    return this;
  }

  /**
   * Задаёт агентские реквизиты на уровне всего чека.
   */
  public addAgent(agent: OrderAgentInput): this {
    const cleaned = stripUndefined(agent);
    Object.assign(this.content, cleaned);
    return this;
  }

  /**
   * Задаёт дополнительный реквизит пользователя (тег 1084).
   */
  public addUserAttribute(options: UserAttributeInput): this {
    this.content.additionalUserAttribute = {
      name: options.name,
      value: options.value,
    };
    return this;
  }

  /**
   * Выполняет клиентскую валидацию документа по схеме OrangeData API v2.
   * При обнаружении ошибок выбрасывает `OrangeDataValidationError`.
   */
  public validate(): void {
    const errors = validateOrder(this);
    if (Object.keys(errors).length > 0) {
      throw new OrangeDataValidationError(errors);
    }
  }

  public toJSON(): Record<string, unknown> {
    return stripUndefined({
      id: this.id,
      inn: this.inn,
      group: this.group,
      key: this.key,
      callbackUrl: this.callbackUrl,
      ignoreItemCodeCheck: this.ignoreItemCodeCheck,
      content: this.content,
    });
  }
}
