# orangedata-ts

[![CI](https://github.com/dkhizhniakov/orangedata-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/dkhizhniakov/orangedata-ts/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/orangedata-ts.svg)](https://www.npmjs.com/package/orangedata-ts)
[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)](https://www.npmjs.com/package/orangedata-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Современный **Zero-Dependency TypeScript SDK** для интеграции с онлайн-кассами [OrangeData](https://orangedata.ru/) по протоколу **API v2** (54-ФЗ, ФФД 1.05 и ФФД 1.2, маркировка «Честный ЗНАК»).

Является полностью переписанным, безопасным и строго типизированным форком заброшенной библиотеки [`node-orangedata`](https://github.com/orangedata-official/node-orangedata).

---

## Почему `orangedata-ts` вместо `node-orangedata`?

| Характеристика                     | `node-orangedata` (v1.5.0)                                                                                 | `orangedata-ts` (v2.0.0)                                                                                        |
| :--------------------------------- | :--------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| **Зависимости (`dependencies`)**   | `request`, `request-promise-native`, `validator` (~45 устаревших пакетов, **Critical CVEs** в `npm audit`) | **0 зависимостей** (`node:https`, `node:crypto`, `node:zlib`)                                                   |
| **TypeScript**                     | Нет типов (`// @ts-ignore`)                                                                                | **100% TypeScript** со строгими `.d.ts` / `.d.cts` и JSDoc по тегам 54-ФЗ                                       |
| **Форматы модулей**                | Только legacy CommonJS                                                                                     | **Dual ESM + CommonJS**                                                                                         |
| **Актуальность 54-ФЗ (2025/2026)** | Частичная                                                                                                  | Полная поддержка **ФФД 1.2**, ставок НДС **22% / 5% / 7%**, флага `useTax20`, безналичных реквизитов (тег 1234) |
| **Сетевой уровень (mTLS)**         | Создание соединений через deprecated `request`                                                             | `https.Agent` с **Keep-Alive**, `gzip`/`deflate`, `timeout`, `AbortSignal` и учётом `Retry-After` (`503`)       |
| **Поллинг статусов**               | Ручной `setTimeout` в коде приложения                                                                      | Встроенные методы `waitForOrderStatus` и др.                                                                    |

---

## Установка

Требуется **Node.js >= 22.0.0** (LTS 22.x, 24.x, 26.x).

```bash
npm install orangedata-ts
```

---

## Быстрый старт

```typescript
import fs from 'node:fs';
import {
  FfdVersion,
  OrangeData,
  OrangeDataApiError,
  OrangeDataValidationError,
  Order,
  PaymentMethodType,
  PaymentSubjectType,
  PaymentType,
  ReceiptType,
  TaxRate,
  TaxationSystem,
} from 'orangedata-ts';

const agent = new OrangeData({
  apiUrl: 'https://apip.orangedata.ru:12001/api/v2', // Боевой: https://api.orangedata.ru:12003/api/v2
  ca: fs.readFileSync('./keys/cacert.pem'),
  cert: fs.readFileSync('./keys/client.crt'),
  key: fs.readFileSync('./keys/client.key'),
  passphrase: '1234',
  privateKey: fs.readFileSync('./keys/private_key.pem'),
  timeout: 15_000,
});

const order = new Order({
  id: 'order-2026-0001',
  inn: '7727401209',
  group: 'Main',
  ffdVersion: FfdVersion.Ffd12, // ФФД 1.2 (4)
  type: ReceiptType.Income, // Приход (1)
  taxationSystem: TaxationSystem.USNIncome, // УСН доход (1)
  customerContact: '+79991234567',
  senderEmail: 'noreply@shop.ru',
});

order
  .addPosition({
    text: 'Клубная футболка сезона 2026',
    quantity: 1,
    price: 4990,
    tax: TaxRate.Vat5, // НДС 5% УСН (7); также доступны TaxRate.Vat22 (1), TaxRate.NoVat (6) и др.
    paymentMethodType: PaymentMethodType.FullPayment,
    paymentSubjectType: PaymentSubjectType.Product,
    quantityMeasurementUnit: 0, // Штуки (тег 2108 для ФФД 1.2)
  })
  .addPayment({
    type: PaymentType.Cashless,
    amount: 4990,
  })
  .addUserAttribute({
    name: 'Номер заказа',
    value: 'order-2026-0001',
  });

try {
  // 1. Отправка чека в очередь ККТ (201 Created)
  await agent.sendOrder(order);

  // 2. Ожидание пробития чека фискальным накопителем (автоматический поллинг 202 -> 200 OK)
  const receipt = await agent.waitForOrderStatus('7727401209', order.id, {
    intervalMs: 3_000,
    maxAttempts: 10,
  });

  if (receipt) {
    console.log('Чек фискализирован! ФПД:', receipt.fp, 'ФД:', receipt.documentNumber);
  } else {
    console.warn('Чек всё ещё находится в очереди обработки ККТ');
  }
} catch (error) {
  if (error instanceof OrangeDataValidationError) {
    console.error('Ошибки предвалидации документа:', error.validationErrors);
  } else if (error instanceof OrangeDataApiError) {
    console.error(`Ошибка API OrangeData (${error.statusCode}):`, error.message, error.errors);
  } else {
    throw error;
  }
}
```

---

## Основные возможности

### 1. Агентская схема и поставщики (теги 1057, 1222, 1224, 1226)

В отличие от оригинального `node-orangedata`, признак агента `agentType` можно передать как сразу в конструктор `new Order({ ..., agentType })`, так и через `.addAgent(...)`. ИНН поставщика в позиции можно указать в `supplierINN` или внутри `supplierInfo.inn` — библиотека автоматически нормализует поле под формат API v2:

```typescript
import { AgentFlag } from 'orangedata-ts';

order.addPosition({
  text: 'Товар принципала',
  quantity: 1,
  price: 1500,
  tax: TaxRate.NoVat,
  agentType: AgentFlag.BankPaymentAgent | AgentFlag.PaymentAgent, // 5
  supplierINN: '781304608018',
  supplierInfo: {
    name: 'ИП Иванов И.И.',
    phoneNumbers: ['+79001112233'],
  },
});
```

### 2. Ставки НДС 2025/2026 и возвраты по ставке 20% (`useTax20`)

В соответствии с обновлениями протокола OrangeData API v2:

- `TaxRate.Vat22` (`1`) — базовая ставка **22%** (`TaxRate.Vat22Calculated` = `3` для **22/122**).
- `TaxRate.Vat5` (`7`), `TaxRate.Vat7` (`8`), `TaxRate.Vat5Calculated` (`9`), `TaxRate.Vat7Calculated` (`10`) — ставки УСН.
- Для формирования чеков возврата или чеков коррекции по операциям до 2026 года со старой ставкой **20%** передайте `useTax20: true` в `new Order({ ..., useTax20: true })` или `new Correction({ ..., useTax20: true })`.

### 3. Чеки коррекции (`Correction`)

Поддерживаются оба формата:

- **ФФД 1.05** (`ffdVersion: FfdVersion.Ffd105`): отправка через `agent.sendCorrection(correction)` и статус через `agent.getCorrectionStatus(inn, id)` / `agent.waitForCorrectionStatus(inn, id)`.
- **ФФД 1.2** (`ffdVersion: FfdVersion.Ffd12`): сборка позиций методами `.addPosition(...)` и `.addPayment(...)`, отправка через `agent.sendCorrection12(correction)` и статус через `agent.getCorrection12Status(inn, id)` / `agent.waitForCorrection12Status(inn, id)`.

### 4. Проверка кодов маркировки «Честный ЗНАК» (`ItemCode`, ФФД 1.2)

```typescript
import { ItemCode, PlannedStatus } from 'orangedata-ts';

const kmCheck = new ItemCode({
  id: 'km-check-01',
  inn: '7727401209',
  plannedStatus: PlannedStatus.PieceSold,
  itemCode: '010460000000000021abcDEF1234567\u001d91EE06\u001d92xyz==',
  quantityMeasurementUnit: 0,
  quantity: 1,
});

await agent.checkItemCode(kmCheck);
const kmResult = await agent.waitForItemCodeStatus('7727401209', kmCheck.id);
```

### 5. Отмена запросов (`AbortSignal`) и управление соединением

Все сетевые методы и поллинг поддерживают стандартный `AbortSignal` (например, `AbortSignal.timeout(5000)`):

```typescript
const status = await agent.getOrderStatus('7727401209', 'order-1', {
  signal: AbortSignal.timeout(5_000),
});

// При завершении работы приложения можно закрыть пул keep-alive сокетов:
agent.destroy();
```

---

## Миграция с `node-orangedata` (v1.x -> v2.0)

1. Замените зависимость:

   ```bash
   npm uninstall node-orangedata
   npm install orangedata-ts
   ```
2. Обновите импорт (все классы и ошибки теперь экспортируются напрямую из корня пакета):

   ```diff
   - // @ts-ignore
   - import { OrangeData, Order } from 'node-orangedata';
   - import { OrangeDataError } from 'node-orangedata/lib/errors';
   + import {
   +   OrangeData,
   +   Order,
   +   Correction,
   +   ItemCode,
   +   OrangeDataError,
   +   OrangeDataValidationError,
   +   OrangeDataApiError,
   + } from 'orangedata-ts';
   ```
3. Проверьте `getOrderStatus`: когда чек ещё находится в очереди ККТ (`202 Accepted`), метод возвращает `null` (ранее возвращался `undefined` — проверка `if (status)` продолжает работать без изменений).

---

## Разработка и тестирование

```bash
npm install
npm run lint          # Проверка кода через Biome
npm run typecheck     # Строгая проверка типов TypeScript
npm run test:coverage # Запуск unit и локальных mTLS интеграционных тестов (Vitest + V8 coverage)
npm run build         # Сборка ESM + CJS + .d.ts в dist/
```

---

## Лицензия

Распространяется под лицензией [MIT](./LICENSE).  
Оригинальная разработка: © 2017 АО «Оранж Дата». Переработка на TypeScript и поддержка: © 2026 Dmitrii Khizhniakov.
