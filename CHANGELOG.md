# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-11-06

### Breaking Changes

- Package renamed to **`orangedata-ts`** (fork of `orangedata-official/node-orangedata`).
- Minimum required Node.js version set to **`>=22.0.0`** (LTS).
- `getOrderStatus`, `getCorrectionStatus`, `getCorrection12Status`, and `getItemCodeStatus` now return `null` instead of `undefined` when a document is still queued (`202 Accepted`).
- Removed deep internal imports (`node-orangedata/lib/errors`) in favor of clean root exports (`OrangeDataError`, `OrangeDataValidationError`, `OrangeDataApiError`, `ItemCode`).

### Added

- **100% TypeScript rewrite** with complete `.d.ts` / `.d.cts` declarations, source maps, and JSDoc annotations with 54-FZ / FFD 1.2 tag numbers.
- **Dual ESM + CommonJS** package exports.
- Named constants and types for 54-FZ fiscal tags (`FfdVersion`, `ReceiptType`, `TaxationSystem`, `TaxRate` including 22%, 5%, 7% USN VAT and `useTax20`, `PaymentMethodType`, `PaymentSubjectType`, `PaymentType`, `AgentFlag`, `PlannedStatus`).
- Built-in polling helpers: `waitForOrderStatus`, `waitForCorrectionStatus`, `waitForCorrection12Status`, `waitForItemCodeStatus` with automatic `503 Retry-After` backoff and `AbortSignal` support.
- Fluent builders: `Order.addElectronicPayment()` (FNS Order N ЕД-7-20/236@ tag 1235), `Correction.addPosition()`, `Correction.addPayment()`, `Correction.addUserAttribute()`.
- Direct support for `agentType` and agent fields in `new Order({ ... })` constructor as well as automatic `supplierINN` normalization from `supplierInfo.inn`.
- `OrangeData.destroy()` to cleanly close persistent mTLS `https.Agent` keep-alive sockets.

### Removed / Security

- **Zero runtime dependencies (`"dependencies": {}`)**: completely removed deprecated `request`, `request-promise-native`, and `validator`, eliminating all transitive `form-data`, `qs`, and `tough-cookie` CVEs.

### Fixed

- Fixed `GET` requests sending `'X-Signature': undefined` header.
- Fixed IEEE-754 floating-point drift in position/payment sum validation using exact kopek integer math.
- Fixed calendar date (`ДД.ММ.ГГГГ`) and ISO 8601 validation edge cases.
- Stripped `undefined` properties from serialized document payloads (`toJSON()`).
