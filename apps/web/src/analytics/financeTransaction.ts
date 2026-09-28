import { dateOnlyAtStartOfDay, LIFEOS_TIME_ZONE } from './timezone';

export const FINANCE_TIME_ZONE = LIFEOS_TIME_ZONE;
export { dateOnlyAtStartOfDay };

type FinanceTransaction = {
  id: string | number;
  amount: string | number;
  category_id: string;
  date: string;
};

export function financeTransactionMeasurementPayload(
  transaction: FinanceTransaction,
  includedByDefault = true,
) {
  return {
    metric_key: 'finance.transaction_amount',
    subject: { domain: 'finance', type: 'transaction', id: String(transaction.id) },
    value: { type: 'money', unit_code: 'UAH', num: String(transaction.amount) },
    occurred_at: dateOnlyAtStartOfDay(transaction.date),
    occurred_tz: FINANCE_TIME_ZONE,
    provenance: {
      source_kind: 'USER_REPORTED', basis: '1 операция', method: 'Ручная запись',
    },
    dimensions: {
      category_id: transaction.category_id,
      included_by_default: includedByDefault,
    },
  };
}
