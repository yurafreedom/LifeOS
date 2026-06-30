/* lib/finance.js
 *
 * Sprint 3B · pure helpers for the flexible-finance feature.
 *
 * A transaction counts toward totals only if BOTH gates are open:
 *   1. transaction.included_in_totals !== false
 *   2. categoryOverrides[transaction.category_id]?.included_in_totals !== false
 *
 * Helpers exported on window.LifeFinance:
 *   isIncluded(tx, overrides)            → boolean
 *   sumIncluded(txList, overrides)       → number
 *   byCategory(txList, overrides)        → [{ catId, amount }] aggregated, only-included
 *   allCategoriesHidden(overrides, cats) → boolean (extreme empty-state hint)
 */

(function () {
  function isIncluded(tx, overrides) {
    if (!tx) return false;
    if (tx.included_in_totals === false) return false;
    var o = overrides && overrides[tx.category_id];
    if (o && o.included_in_totals === false) return false;
    return true;
  }

  function sumIncluded(txList, overrides) {
    if (!Array.isArray(txList)) return 0;
    var total = 0;
    for (var i = 0; i < txList.length; i++) {
      if (isIncluded(txList[i], overrides)) total += (+txList[i].amount || 0);
    }
    return total;
  }

  function byCategory(txList, overrides) {
    if (!Array.isArray(txList)) return [];
    var bucket = {};
    for (var i = 0; i < txList.length; i++) {
      var tx = txList[i];
      if (!isIncluded(tx, overrides)) continue;
      bucket[tx.category_id] = (bucket[tx.category_id] || 0) + (+tx.amount || 0);
    }
    var out = [];
    for (var k in bucket) {
      if (Object.prototype.hasOwnProperty.call(bucket, k)) {
        out.push({ catId: k, amount: bucket[k] });
      }
    }
    return out;
  }

  /* Sprint 3B QA scenario: if EVERY category is overridden off, the
     /home category breakdown shows a hint pointing at Settings. */
  function allCategoriesHidden(overrides, expenseCats) {
    if (!overrides || !expenseCats || expenseCats.length === 0) return false;
    for (var i = 0; i < expenseCats.length; i++) {
      var c = expenseCats[i];
      var o = overrides[c.id];
      if (!o || o.included_in_totals !== false) return false;
    }
    return true;
  }

  /* Convenience: how many transactions are excluded? Used in
     /finances page header chip. */
  function excludedCount(txList, overrides) {
    if (!Array.isArray(txList)) return 0;
    var n = 0;
    for (var i = 0; i < txList.length; i++) {
      if (!isIncluded(txList[i], overrides)) n += 1;
    }
    return n;
  }

  window.LifeFinance = {
    isIncluded:          isIncluded,
    sumIncluded:         sumIncluded,
    byCategory:          byCategory,
    allCategoriesHidden: allCategoriesHidden,
    excludedCount:       excludedCount,
  };
})();
