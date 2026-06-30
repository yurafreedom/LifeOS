/* lib/medMath.js
 *
 * Pure helpers for medication timer math + duration formatting.
 * No React, no DOM. Imported by MedCard, TakeDoseModal, MedDetailPage.
 *
 * Glossary
 *   med            — entry from state.medications
 *   doseLog        — array of { taken_at, dose_mg, mode, note }, NEWEST first
 *   modeStyle      — entry from state.modeStyles[medId] or null
 *   nowMs          — Date.now() snapshot (passed in so React can re-render
 *                    on tick without these fns reading wall-clock directly).
 */

(function () {
  const HR = 3600 * 1000;
  const DAY = 24 * HR;

  /* Format "5ч 47м" / "5г 47хв" — accepts a positive ms delta. */
  function formatHM(ms, unitH, unitM) {
    if (ms < 0) ms = 0;
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return m + unitM;
    if (m === 0) return h + unitH;
    return h + unitH + ' ' + m + unitM;
  }

  /* HH:MM in local time. */
  function formatClock(date) {
    return date.toTimeString().slice(0, 5);
  }

  /* Pick the most recent dose log entry. Returns null if list empty. */
  function lastDose(doseLog) {
    if (!Array.isArray(doseLog) || doseLog.length === 0) return null;
    /* arrays are stored newest-first in state.doseLogs */
    return doseLog[0];
  }

  /* Timer 1 · next dose
     Returns { etaMs, eta: 'HH:MM' } if a schedule exists, else null.
     For PRN-mode meds, callers should hide this timer. */
  function nextDose(med, doseLog, modeStyle, nowMs) {
    if (modeStyle && modeStyle.type === 'prn') return null;
    const interval = med.dose_interval_h;
    if (!interval) return null;
    const last = lastDose(doseLog);
    if (!last) return { etaMs: 0, eta: formatClock(new Date(nowMs)) };
    const lastMs = new Date(last.taken_at).getTime();
    const targetMs = lastMs + interval * HR;
    return {
      etaMs: targetMs - nowMs,
      eta: formatClock(new Date(targetMs)),
    };
  }

  /* Timer 2 · half-life decay
     Returns { halfLifeH, exitClock } where exitClock is HH:MM when
     concentration falls below 1 t½ after the last dose. */
  function halfLifeTimer(med, doseLog, nowMs) {
    const h = med.half_life_h;
    if (h == null) return null;
    const last = lastDose(doseLog);
    if (!last) return null;
    const lastMs = new Date(last.taken_at).getTime();
    const exitMs = lastMs + h * HR;
    return {
      halfLifeH: h,
      exitClock: formatClock(new Date(exitMs)),
    };
  }

  /* Timer 3 · full elimination (~5 half-lives)
     Uses half_life_active_metabolite_h if present (DDCAR case for
     cariprazine, etc). Returns { days, useMetabolite }. */
  function fullEliminationTimer(med) {
    const useMetabolite = med.half_life_active_metabolite_h != null;
    const h = useMetabolite ? med.half_life_active_metabolite_h : med.half_life_h;
    if (h == null) return null;
    const days = Math.round((5 * h) / 24);
    return { days, useMetabolite };
  }

  /* "Обычно принимаешь в HH:MM" — mean time-of-day over last 14
     entries, only if stddev < 90 minutes (spec). */
  function usualTime(doseLog) {
    if (!Array.isArray(doseLog) || doseLog.length < 3) return null;
    const sample = doseLog.slice(0, 14).map(e => {
      const d = new Date(e.taken_at);
      return d.getHours() * 60 + d.getMinutes();
    });
    /* circular mean would be nicer but overkill for one-per-day */
    const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
    const variance = sample.reduce((a, b) => a + (b - mean) * (b - mean), 0) / sample.length;
    const std = Math.sqrt(variance);
    if (std > 90) return null;
    const h = Math.floor(mean / 60);
    const m = Math.round(mean % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /* Inventory risk tier given count + per-day consumption rate.
     Returns { daysLeft, tier, chipKey } where tier ∈
     'safe' | 'soon' | 'urgent' | 'low' | 'empty'.
     `low` (0-1 days) maps to red "заканчивается"; `empty` (0 doses
     and 0 inventory) maps to "закончился" + disabled take button. */
  function inventoryRisk(med, modeStyle) {
    const count = med.inventory_count || 0;
    const dosesPerDay = (modeStyle && modeStyle.type === 'prn')
      ? 1                                    // PRN: assume 1/day worst-case
      : (med.doses_per_day || 1);
    const daysLeft = dosesPerDay > 0 ? (count / dosesPerDay) : null;
    if (count === 0) return { daysLeft: 0, tier: 'empty', chipKey: 'meds_inv_empty' };
    if (daysLeft != null && daysLeft <= 1)  return { daysLeft, tier: 'low',     chipKey: 'meds_inv_running_out' };
    if (daysLeft != null && daysLeft <= 3)  return { daysLeft, tier: 'urgent',  chipKey: 'meds_inv_urgent' };
    if (daysLeft != null && daysLeft <= 7)  return { daysLeft, tier: 'soon',    chipKey: 'meds_inv_soon' };
    return { daysLeft, tier: 'safe', chipKey: null };
  }

  /* Late/early indicator for TakeDoseModal. Returns
     { kind: 'late' | 'early', deltaMs } or null if within 30min of
     expected. */
  function dosingDelta(med, doseLog, takenAtMs) {
    const interval = med.dose_interval_h;
    if (!interval) return null;
    const last = lastDose(doseLog);
    if (!last) return null;
    const lastMs = new Date(last.taken_at).getTime();
    const expectedMs = lastMs + interval * HR;
    const delta = takenAtMs - expectedMs;
    if (Math.abs(delta) < 30 * 60 * 1000) return null;
    return { kind: delta > 0 ? 'late' : 'early', deltaMs: Math.abs(delta) };
  }

  /* PRN anti-stacking: returns ms since last dose if user is in PRN
     mode AND that gap is shorter than dose_interval_h. Else null. */
  function prnStackingGap(med, doseLog, modeStyle, nowMs) {
    if (!modeStyle || modeStyle.type !== 'prn') return null;
    const last = lastDose(doseLog);
    if (!last) return null;
    const interval = med.dose_interval_h || 6;
    const gap = nowMs - new Date(last.taken_at).getTime();
    if (gap >= interval * HR) return null;
    return gap;
  }

  window.LifeMedMath = {
    HR, DAY,
    formatHM, formatClock,
    lastDose,
    nextDose, halfLifeTimer, fullEliminationTimer,
    usualTime,
    inventoryRisk,
    dosingDelta,
    prnStackingGap,
  };
})();
