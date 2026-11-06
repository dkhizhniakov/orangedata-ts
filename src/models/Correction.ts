import { OrangeDataValidationError } from '../errors/errors.js';
import { FfdVersion, type FfdVersionValue } from '../types/enums.js';
import type {
  CorrectionInput,
  OrderPaymentInput,
  OrderPositionInput,
  UserAttributeInput,
} from '../types/requests.js';
import { stripUndefined } from '../validation/engine.js';
import { validateCorrection, validateCorrection12 } from '../validation/schemas.js';

export type CorrectionContent = Omit<
  CorrectionInput,
  'id' | 'inn' | 'group' | 'key' | 'callbackUrl' | 'ignoreItemCodeCheck' | 'ffdVersion'
> & {
  ffdVersion: FfdVersionValue;
};

/**
 * Модель чека коррекции:
 * - ФФД 1.05 (`ffdVersion: 2`, отправляется через `sendCorrection` -> `/corrections`)
 * - ФФД 1.2 (`ffdVersion: 4`, отправляется через `sendCorrection12` -> `/correction12`)
 */
export class Correction {
  public readonly id: string;
  public readonly inn: string;
  public readonly group?: string;
  public readonly key?: string;
  public readonly callbackUrl?: string;
  public readonly ignoreItemCodeCheck?: boolean;
  public readonly content: CorrectionContent;

  constructor(order: CorrectionInput) {
    this.id = order.id;
    this.inn = order.inn;
    if (order.group !== undefined) this.group = order.group;
    if (order.key !== undefined) this.key = order.key;
    if (order.callbackUrl !== undefined) this.callbackUrl = order.callbackUrl;
    if (order.ignoreItemCodeCheck !== undefined) {
      this.ignoreItemCodeCheck = order.ignoreItemCodeCheck;
    }

    const {
      id: _id,
      inn: _inn,
      group: _group,
      key: _key,
      callbackUrl: _cb,
      ignoreItemCodeCheck: _ignore,
      ffdVersion,
      ...restContent
    } = order;

    this.content = stripUndefined<CorrectionContent>({
      ...restContent,
      ffdVersion: ffdVersion ?? FfdVersion.Ffd105,
    });
  }

  /**
   * Добавляет позицию в чек коррекции ФФД 1.2.
   */
  public addPosition(pos: OrderPositionInput): this {
    if (!this.content.positions) {
      this.content.positions = [];
    }
    const resolvedSupplierINN = pos.supplierINN ?? pos.supplierInfo?.inn;
    const cleanSupplierInfo = pos.supplierInfo
      ? stripUndefined({
          phoneNumbers: pos.supplierInfo.phoneNumbers,
          name: pos.supplierInfo.name,
        })
      : undefined;

    this.content.positions.push(
      stripUndefined({
        ...pos,
        supplierINN: resolvedSupplierINN,
        supplierInfo:
          cleanSupplierInfo && Object.keys(cleanSupplierInfo).length > 0
            ? cleanSupplierInfo
            : undefined,
        quantityMeasurementUnit:
          this.content.ffdVersion === FfdVersion.Ffd12 ? pos.quantityMeasurementUnit : undefined,
      }),
    );
    return this;
  }

  /**
   * Добавляет оплату в `checkClose` чека коррекции ФФД 1.2.
   */
  public addPayment(payment: OrderPaymentInput): this {
    if (!this.content.checkClose) {
      this.content.checkClose = {
        taxationSystem: this.content.taxationSystem ?? 0,
        payments: [],
      };
    }
    this.content.checkClose.payments.push({
      type: payment.type,
      amount: payment.amount,
    });
    return this;
  }

  /**
   * Задаёт дополнительный реквизит пользователя (тег 1084).
   */
  public addUserAttribute(attr: UserAttributeInput): this {
    this.content.additionalUserAttribute = {
      name: attr.name,
      value: attr.value,
    };
    return this;
  }

  /**
   * Валидирует чек коррекции по схеме ФФД 1.05 или ФФД 1.2 в зависимости от `content.ffdVersion`.
   */
  public validate(): void {
    const validator =
      this.content.ffdVersion === FfdVersion.Ffd12 ? validateCorrection12 : validateCorrection;
    const errors = validator(this);
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
