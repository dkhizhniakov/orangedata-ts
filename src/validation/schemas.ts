import { createValidator } from './engine.js';
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
  validateNomenclatureCode,
} from './rules.js';

export const MAX_MONEY_AMOUNT = 99_999_999.99;

const PAYMENT_SUBJECT_TYPES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
  30, 31, 32, 33,
] as const;

export const validateServiceOptions = createValidator({
  ca: [required],
  passphrase: [required],
  key: [required],
  cert: [required],
  privateKey: [required],
});

const industryAttributeValidator = createValidator({
  foivId: [maxLength(3)],
  causeDocumentDate: [date],
  causeDocumentNumber: [maxLength(32)],
  value: [maxLength(239)],
});

const customerInfoValidator = createValidator({
  name: [maxLength(239)],
  inn: [inn],
  birthDate: [date],
  citizenship: [integer, minValue(1), maxValue(999)],
  identityDocumentCode: [integer, minValue(1), maxValue(99)],
  identityDocumentData: [maxLength(64)],
  address: [maxLength(256)],
});

const operationalAttributeValidator = createValidator({
  date: [isIso8601],
  id: [integer, minValue(0), maxValue(255)],
  value: [maxLength(64)],
});

const userAttributeValidator = createValidator({
  name: [required, maxLength(64)],
  value: [required, maxLength(234)],
});

const positionValidator = createValidator({
  quantity: [required, decimal(6), minValue(0.000001)],
  price: [required, decimal(2), minValue(0)],
  tax: [required, integer, oneOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])],
  text: [required, maxLength(128)],
  paymentMethodType: [oneOf([1, 2, 3, 4, 5, 6, 7])],
  paymentSubjectType: [oneOf(PAYMENT_SUBJECT_TYPES)],
  supplierINN: [inn],
  supplierInfo: [
    optionalObject(
      createValidator({
        phoneNumbers: [arrayOf([maxLength(19), phone])],
        name: [maxLength(239)],
      }),
    ),
  ],
  agentType: [integer, minValue(1), maxValue(127)],
  unitOfMeasurement: [maxLength(16)],
  additionalAttribute: [maxLength(64)],
  manufacturerCountryCode: [maxLength(3)],
  customsDeclarationNumber: [maxLength(32)],
  agentInfo: [
    optionalObject(
      createValidator({
        paymentAgentOperation: [maxLength(24)],
        paymentOperatorName: [maxLength(64)],
        paymentOperatorAddress: [maxLength(243)],
        paymentOperatorINN: [maxLength(12), inn],
        paymentOperatorPhoneNumbers: [arrayOf([phone])],
        paymentAgentPhoneNumbers: [arrayOf([phone])],
        paymentTransferOperatorPhoneNumbers: [arrayOf([phone])],
      }),
    ),
  ],
  taxSum: [decimal(2)],
  nomenclatureCode: [validateNomenclatureCode],
  excise: [decimal(2)],
  unitTaxSum: [decimal(2)],
  quantityMeasurementUnit: [integer, minValue(0), maxValue(255)],
  itemCode: [maxLength(223)],
  fractionalQuantity: [
    optionalObject(
      createValidator({
        numerator: [required, integer, minValue(1)],
        denominator: [required, integer, minValue(2)],
      }),
    ),
  ],
  industryAttribute: [objectOrArrayOf(industryAttributeValidator)],
  barcodes: [
    optionalObject(
      createValidator({
        ean8: [maxLength(8)],
        ean13: [maxLength(13)],
        itf14: [maxLength(14)],
        gs1: [maxLength(38)],
        mi: [maxLength(20)],
        egais20: [maxLength(23)],
        egais30: [maxLength(14)],
        f1: [maxLength(32)],
        f2: [maxLength(32)],
        f3: [maxLength(32)],
        f4: [maxLength(32)],
        f5: [maxLength(32)],
        f6: [maxLength(32)],
      }),
    ),
  ],
  plannedStatus: [integer, minValue(0), maxValue(256)],
});

const paymentValidator = createValidator({
  type: [required, oneOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])],
  amount: [required, decimal(2), minValue(0)],
});

const cashlessPaymentValidator = createValidator({
  amount: [required, decimal(2), minValue(0)],
  type: [required, integer, minValue(0), maxValue(255)],
  id: [required, minLength(1), maxLength(256)],
  additionalInfo: [minLength(1), maxLength(256)],
});

const agentRules = {
  agentType: [integer, minValue(1), maxValue(127)],
  paymentTransferOperatorPhoneNumbers: [arrayOf([maxLength(19), phone])],
  paymentAgentOperation: [maxLength(24)],
  paymentAgentPhoneNumbers: [arrayOf([maxLength(19), phone])],
  paymentOperatorPhoneNumbers: [arrayOf([maxLength(19), phone])],
  paymentOperatorName: [maxLength(64)],
  paymentOperatorAddress: [maxLength(244)],
  paymentOperatorINN: [inn],
  supplierPhoneNumbers: [arrayOf([maxLength(19), phone])],
};

const checkCloseRules = [
  amounts,
  createValidator({
    payments: [required, arrayOf(paymentValidator), maxPaymentsTotal(MAX_MONEY_AMOUNT)],
    taxationSystem: [required, integer, oneOf([0, 1, 2, 3, 4, 5])],
    electronicPaymentsInfo: [
      optionalObject(
        createValidator({
          payments: [required, arrayOf(cashlessPaymentValidator)],
        }),
      ),
    ],
  }),
];

export const validateOrder = createValidator({
  id: [required, maxLength(64)],
  inn: [required, inn],
  group: [maxLength(32)],
  key: [maxLength(32)],
  callbackUrl: [maxLength(1024)],
  ignoreItemCodeCheck: [boolean],
  content: createValidator({
    ffdVersion: [required, integer, oneOf([2, 4])],
    type: [required, oneOf([1, 2, 3, 4])],
    positions: [required, arrayOf(positionValidator), maxPositionsTotal(MAX_MONEY_AMOUNT)],
    checkClose: checkCloseRules,
    customerContact: [maxLength(64), or([email, phone, equals('none')])],
    customer: [maxLength(243)],
    customerINN: [inn],
    ...agentRules,
    additionalUserAttribute: [optionalObject(userAttributeValidator)],
    automatNumber: [maxLength(20)],
    settlementAddress: [maxLength(243)],
    settlementPlace: [maxLength(243)],
    additionalAttribute: [maxLength(16)],
    cashier: [maxLength(64)],
    cashierINN: [inn, minLength(12), maxLength(12)],
    senderEmail: [maxLength(64), email],
    totalSum: [decimal(2)],
    vat1Sum: [decimal(2)],
    vat2Sum: [decimal(2)],
    vat3Sum: [decimal(2)],
    vat4Sum: [decimal(2)],
    vat5Sum: [decimal(2)],
    vat6Sum: [decimal(2)],
    vat7Sum: [decimal(2)],
    vat8Sum: [decimal(2)],
    vat9Sum: [decimal(2)],
    vat10Sum: [decimal(2)],
    useTax20: [boolean],
    customerInfo: [optionalObject(customerInfoValidator)],
    operationalAttribute: [optionalObject(operationalAttributeValidator)],
    industryAttribute: [objectOrArrayOf(industryAttributeValidator)],
  }),
});

export const validateCorrection = createValidator({
  id: [required, maxLength(64)],
  inn: [required, inn],
  group: [maxLength(32)],
  key: [maxLength(32)],
  callbackUrl: [maxLength(1024)],
  ignoreItemCodeCheck: [boolean],
  content: createValidator({
    ffdVersion: [required, integer, oneOf([2])],
    type: [required, oneOf([1, 3])],
    taxationSystem: [required, integer, oneOf([0, 1, 2, 3, 4, 5])],
    correctionType: [required, oneOf([0, 1])],
    causeDocumentDate: [required, isIso8601],
    causeDocumentNumber: [
      requiredIf<{ correctionType?: number }>((data) => data.correctionType === 1),
      maxLength(32),
    ],
    totalSum: [required, decimal(2)],
    cashSum: [decimal(2)],
    eCashSum: [decimal(2)],
    prepaymentSum: [decimal(2)],
    postpaymentSum: [decimal(2)],
    otherPaymentTypeSum: [decimal(2)],
    tax1Sum: [decimal(2)],
    tax2Sum: [decimal(2)],
    tax3Sum: [decimal(2)],
    tax4Sum: [decimal(2)],
    tax5Sum: [decimal(2)],
    tax6Sum: [decimal(2)],
    tax7Sum: [decimal(2)],
    tax8Sum: [decimal(2)],
    tax9Sum: [decimal(2)],
    tax10Sum: [decimal(2)],
    useTax20: [boolean],
    automatNumber: [maxLength(20)],
    settlementAddress: [maxLength(243)],
    settlementPlace: [maxLength(243)],
    customerContact: [maxLength(64), or([email, phone, equals('none')])],
  }),
});

export const validateCorrection12 = createValidator({
  id: [required, maxLength(64)],
  inn: [required, inn],
  group: [maxLength(32)],
  key: [maxLength(32)],
  callbackUrl: [maxLength(1024)],
  ignoreItemCodeCheck: [boolean],
  content: createValidator({
    ffdVersion: [required, integer, oneOf([4])],
    type: [required, integer, oneOf([1, 2, 3, 4])],
    positions: [required, arrayOf(positionValidator), maxPositionsTotal(MAX_MONEY_AMOUNT)],
    checkClose: checkCloseRules,
    customerContact: [maxLength(64), or([email, phone, equals('none')])],
    correctionType: [required, oneOf([0, 1])],
    causeDocumentDate: [required, isIso8601],
    causeDocumentNumber: [
      requiredIf<{ correctionType?: number }>((data) => data.correctionType === 1),
      maxLength(32),
    ],
    additionalUserAttribute: [optionalObject(userAttributeValidator)],
    additionalAttribute: [maxLength(16)],
    automatNumber: [maxLength(20)],
    settlementAddress: [maxLength(243)],
    settlementPlace: [maxLength(243)],
    cashier: [maxLength(64)],
    cashierINN: [inn, minLength(12), maxLength(12)],
    senderEmail: [maxLength(64), email],
    totalSum: [decimal(2)],
    vat1Sum: [decimal(2)],
    vat2Sum: [decimal(2)],
    vat3Sum: [decimal(2)],
    vat4Sum: [decimal(2)],
    vat5Sum: [decimal(2)],
    vat6Sum: [decimal(2)],
    vat7Sum: [decimal(2)],
    vat8Sum: [decimal(2)],
    vat9Sum: [decimal(2)],
    vat10Sum: [decimal(2)],
    useTax20: [boolean],
    customerInfo: [optionalObject(customerInfoValidator)],
    operationalAttribute: [optionalObject(operationalAttributeValidator)],
    industryAttribute: [objectOrArrayOf(industryAttributeValidator)],
  }),
});

export const validateItemCode = createValidator({
  id: [required, maxLength(64)],
  inn: [required, inn],
  group: [maxLength(32)],
  key: [maxLength(32)],
  callbackUrl: [maxLength(1024)],
  meta: [maxLength(128)],
  ignoreItemCodeCheck: [boolean],
  content: createValidator({
    plannedStatus: [required, integer, minValue(0), maxValue(256)],
    itemCode: [required, maxLength(223)],
    quantityMeasurementUnit: [integer, minValue(0), maxValue(255)],
    quantity: [decimal(6)],
    fractionalQuantity: [
      optionalObject(
        createValidator({
          numerator: [required, integer, minValue(1)],
          denominator: [required, integer, minValue(2)],
        }),
      ),
    ],
  }),
});
