export { buildRequestUrl, HttpClient, resolveBaseApiUrl } from './client/HttpClient.js';
export { OrangeData } from './client/OrangeData.js';
export { signPayload } from './client/signature.js';
export {
  type ApiErrorContext,
  ORANGE_API_ERRORS,
  OrangeDataApiError,
  OrangeDataError,
  OrangeDataValidationError,
} from './errors/errors.js';
export { Correction, type CorrectionContent } from './models/Correction.js';
export { ItemCode, type ItemCodeContent } from './models/ItemCode.js';
export { Order, type OrderContent } from './models/Order.js';

export {
  AgentFlag,
  CorrectionType,
  type CorrectionTypeValue,
  DEFAULT_PROD_API_URL,
  DEFAULT_TEST_API_URL,
  FfdVersion,
  type FfdVersionValue,
  PaymentMethodType,
  type PaymentMethodTypeValue,
  PaymentSubjectType,
  type PaymentSubjectTypeValue,
  PaymentType,
  type PaymentTypeValue,
  PlannedStatus,
  ReceiptType,
  type ReceiptTypeValue,
  TaxationSystem,
  type TaxationSystemValue,
  TaxRate,
  type TaxRateValue,
} from './types/enums.js';

export type {
  CashlessPaymentItem,
  CheckClose,
  CorrectionInput,
  CustomerInfo,
  ElectronicPaymentsInfo,
  FractionalQuantity,
  IndustryAttribute,
  ItemBarcodes,
  ItemCodeInput,
  OperationalAttribute,
  OrangeDataOptions,
  OrderAgentInput,
  OrderInput,
  OrderPaymentInput,
  OrderPositionInput,
  PollStatusOptions,
  PositionAgentInfo,
  RequestCallOptions,
  SupplierInfo,
  UserAttributeInput,
} from './types/requests.js';

export type {
  CorrectionStatusResponse,
  FiscalDocumentStatusBase,
  ItemCodeCheckResult,
  ItemCodeStatusResponse,
  OrderStatusResponse,
} from './types/responses.js';
