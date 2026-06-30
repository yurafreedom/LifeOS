/* lib/activity.js
 *
 * Central activity log helper. Pure functions — they take the
 * current activityLog array and return a new one with the entry
 * appended. App-level dispatcher calls these inside the reducer.
 *
 * Entry shape:
 *   {
 *     id:          string,                 // unique
 *     timestamp:   ISO string,
 *     entity_type: 'task' | 'transaction' | 'med_dose' |
 *                  'med_config' | 'habit' | 'goal' |
 *                  'profile' | 'mode_style' | 'note' | 'quick_note',
 *     entity_id:   string | number,
 *     action:      'created' | 'edited' | 'completed' | 'reopened' |
 *                  'deleted' | 'restored' | 'dose_taken' |
 *                  'dose_skipped' | 'dose_snoozed' |
 *                  'mode_changed' | 'inventory_updated' |
 *                  'note_added' | 'note_edited' | 'note_deleted',
 *     details:     object                  // free-form
 *   }
 *
 * Cap: 5000 entries. Oldest dropped FIFO. Generous because each
 * entry is small (~150 bytes serialized) and the export tool can
 * preserve anything important.
 */

(function () {
  var CAP = 5000;
  var uidCounter = 0;

  function uid() {
    uidCounter += 1;
    return 'a' + Date.now().toString(36) + uidCounter.toString(36);
  }

  function appendActivity(log, entry) {
    var safe = Array.isArray(log) ? log : [];
    var full = {
      id:          entry.id || uid(),
      timestamp:   entry.timestamp || new Date().toISOString(),
      entity_type: entry.entity_type,
      entity_id:   entry.entity_id != null ? entry.entity_id : null,
      action:      entry.action,
      details:     entry.details || {},
    };
    var next = safe.concat([full]);
    if (next.length > CAP) next = next.slice(next.length - CAP);
    return next;
  }

  /* Filter helper used by ActivityTimeline. */
  function entriesFor(log, entityType, entityId) {
    if (!Array.isArray(log)) return [];
    return log.filter(function (e) {
      if (entityType != null && e.entity_type !== entityType) return false;
      if (entityId   != null && String(e.entity_id) !== String(entityId)) return false;
      return true;
    }).slice().reverse();   // newest first
  }

  /* Drop entries older than `cutoffISO`. Used by Settings "очистить
     историю". Returns new array. */
  function pruneOlderThan(log, cutoffISO) {
    if (!Array.isArray(log)) return [];
    var cutoff = new Date(cutoffISO).getTime();
    if (!isFinite(cutoff)) return log.slice();
    return log.filter(function (e) {
      var t = new Date(e.timestamp).getTime();
      return isFinite(t) && t >= cutoff;
    });
  }

  window.LifeActivity = {
    append:          appendActivity,
    entriesFor:      entriesFor,
    pruneOlderThan:  pruneOlderThan,
    CAP:             CAP,
  };
})();
