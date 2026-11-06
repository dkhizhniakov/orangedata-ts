import { OrangeDataValidationError } from '../errors/errors.js';
import type { FractionalQuantity, ItemCodeInput } from '../types/requests.js';
import { stripUndefined } from '../validation/engine.js';
import { validateItemCode } from '../validation/schemas.js';

export interface ItemCodeContent {
  plannedStatus: number;
  itemCode: string;
  quantityMeasurementUnit?: number;
  quantity?: number;
  fractionalQuantity?: FractionalQuantity;
}

/**
 * Модель запроса проверки кода маркировки (`POST /api/v2/itemcode`, ФФД 1.2).
 */
export class ItemCode {
  public readonly id: string;
  public readonly inn: string;
  public readonly group?: string;
  public readonly key?: string;
  public readonly callbackUrl?: string;
  public readonly meta?: string;
  public readonly ignoreItemCodeCheck?: boolean;
  public readonly content: ItemCodeContent;

  constructor(input: ItemCodeInput) {
    this.id = input.id;
    this.inn = input.inn;
    if (input.group !== undefined) this.group = input.group;
    if (input.key !== undefined) this.key = input.key;
    if (input.callbackUrl !== undefined) this.callbackUrl = input.callbackUrl;
    if (input.meta !== undefined) this.meta = input.meta;
    if (input.ignoreItemCodeCheck !== undefined) {
      this.ignoreItemCodeCheck = input.ignoreItemCodeCheck;
    }

    this.content = stripUndefined<ItemCodeContent>({
      plannedStatus: input.plannedStatus,
      itemCode: input.itemCode,
      quantityMeasurementUnit: input.quantityMeasurementUnit,
      quantity: input.quantity,
      fractionalQuantity: input.fractionalQuantity,
    });
  }

  /**
   * Валидирует запрос проверки КМ перед отправкой.
   */
  public validate(): void {
    const errors = validateItemCode(this);
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
      meta: this.meta,
      ignoreItemCodeCheck: this.ignoreItemCodeCheck,
      content: this.content,
    });
  }
}
