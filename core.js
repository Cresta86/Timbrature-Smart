(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SimpleTimeCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RULES = Object.freeze({
    ordinaryStart: 8 * 60,
    ordinaryWork: 8 * 60,
    standardLunch: 45,
    dailyEntryFlex: 60,
    monthlyEntryBasket: 20,
    extraBlock: 15,
  });

  function parseTime(value) {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
    const [hours, minutes] = value.split(":").map(Number);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function formatMinutes(value) {
    const minutes = Math.max(0, Math.round(Number(value) || 0));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return `${rest} min`;
    if (!rest) return `${hours} h`;
    return `${hours} h ${rest} min`;
  }

  function formatClock(totalMinutes) {
    if (!Number.isFinite(totalMinutes)) return "--:--";
    const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
  }

  function evaluateDay(record) {
    const type = record && record.type === "smart" ? "smart" : "office";
    const clean = {
      type,
      entry: type === "smart" ? "08:00" : (record && record.entry ? String(record.entry) : ""),
      lunchOut: type === "smart" ? "" : (record && record.lunchOut ? String(record.lunchOut) : ""),
      lunchIn: type === "smart" ? "" : (record && record.lunchIn ? String(record.lunchIn) : ""),
      exit: type === "smart" ? "16:45" : (record && record.exit ? String(record.exit) : ""),
      note: record && record.note ? String(record.note).trim().slice(0, 120) : "",
    };

    const entry = parseTime(clean.entry);
    const lunchOut = parseTime(clean.lunchOut);
    const lunchIn = parseTime(clean.lunchIn);
    const exit = parseTime(clean.exit);
    const hasAny = type === "smart" || Boolean(clean.entry || clean.lunchOut || clean.lunchIn || clean.exit || clean.note);
    const errors = [];

    if (!hasAny) return { ...clean, hasAny: false, complete: false, valid: true, errors: [] };
    if (entry === null) errors.push("Inserisci l'orario di entrata.");
    if (clean.exit && exit === null) errors.push("L'orario di uscita non è valido.");
    if (Boolean(clean.lunchOut) !== Boolean(clean.lunchIn)) errors.push("Inserisci entrambe le timbrature della pausa pranzo.");
    if (clean.lunchOut && lunchOut === null) errors.push("L'uscita pranzo non è valida.");
    if (clean.lunchIn && lunchIn === null) errors.push("Il rientro pranzo non è valido.");

    if (entry !== null && exit !== null && exit <= entry) errors.push("L'uscita deve essere successiva all'entrata.");
    if (lunchOut !== null && lunchIn !== null && lunchIn <= lunchOut) errors.push("Il rientro pranzo deve essere successivo all'uscita pranzo.");
    if (entry !== null && lunchOut !== null && lunchOut <= entry) errors.push("L'uscita pranzo deve essere successiva all'entrata.");
    if (exit !== null && lunchIn !== null && lunchIn >= exit) errors.push("Il rientro pranzo deve essere precedente all'uscita finale.");

    const complete = entry !== null && exit !== null;
    let lunchMinutes = null;
    let lunchAssumed = false;
    if (complete) {
      if (lunchOut !== null && lunchIn !== null) lunchMinutes = lunchIn - lunchOut;
      else {
        lunchMinutes = RULES.standardLunch;
        lunchAssumed = true;
      }
    }

    const effectiveEntry = entry === null ? null : Math.max(entry, RULES.ordinaryStart);
    const earlyEntryIgnored = entry === null ? 0 : Math.max(0, RULES.ordinaryStart - entry);
    const worked = complete && errors.length === 0 ? exit - effectiveEntry - lunchMinutes : null;
    if (worked !== null && worked < 0) errors.push("Gli orari inseriti non formano una giornata valida.");
    const lateEntry = entry === null ? 0 : Math.max(0, entry - RULES.ordinaryStart);
    const dailyFlexUsed = Math.min(lateEntry, RULES.dailyEntryFlex);
    const basketRequested = Math.max(0, lateEntry - RULES.dailyEntryFlex);

    return {
      ...clean,
      hasAny,
      complete,
      valid: errors.length === 0,
      errors,
      entryMinutes: entry,
      effectiveEntryMinutes: effectiveEntry,
      earlyEntryIgnored,
      exitMinutes: exit,
      lunchMinutes,
      lunchAssumed,
      workedMinutes: worked,
      delta: worked === null || errors.length ? null : worked - RULES.ordinaryWork,
      lateEntry,
      dailyFlexUsed,
      basketRequested,
    };
  }

  function calculateMonth(records) {
    const input = records || {};
    const dates = Object.keys(input).sort();
    const perDay = {};
    let minutesInPiu = 0;
    let missingMinutes = 0;
    let extraMinutes = 0;
    let basketRemaining = RULES.monthlyEntryBasket;
    let openDays = 0;
    let invalidDays = 0;

    dates.forEach((date) => {
      const day = evaluateDay(input[date]);
      const basketUsed = day.valid ? Math.min(day.basketRequested || 0, basketRemaining) : 0;
      basketRemaining -= basketUsed;
      const overBasket = day.valid ? Math.max(0, (day.basketRequested || 0) - basketUsed) : 0;
      let coveredMissing = 0;
      let usedPositiveBalance = 0;
      let addedExtra = 0;
      let addedBalance = 0;
      let addedMissing = 0;

      if (!day.valid) invalidDays += 1;
      else if (day.hasAny && !day.complete) openDays += 1;
      else if (day.complete && day.delta < 0) {
        const shortage = -day.delta;
        usedPositiveBalance = Math.min(minutesInPiu, shortage);
        minutesInPiu -= usedPositiveBalance;
        addedMissing = shortage - usedPositiveBalance;
        missingMinutes += addedMissing;
      } else if (day.complete && day.delta > 0) {
        coveredMissing = Math.min(missingMinutes, day.delta);
        missingMinutes -= coveredMissing;
        const available = day.delta - coveredMissing;
        addedExtra = Math.floor(available / RULES.extraBlock) * RULES.extraBlock;
        addedBalance = available - addedExtra;
        extraMinutes += addedExtra;
        minutesInPiu += addedBalance;
      }

      perDay[date] = {
        ...day,
        basketUsed,
        overBasket,
        coveredMissing,
        usedPositiveBalance,
        addedExtra,
        addedBalance,
        addedMissing,
      };
    });

    return {
      perDay,
      minutesInPiu,
      missingMinutes,
      extraMinutes,
      extraBlocks: extraMinutes / RULES.extraBlock,
      basketUsed: RULES.monthlyEntryBasket - basketRemaining,
      basketRemaining,
      openDays,
      invalidDays,
    };
  }

  function calculateEightHourExit(record) {
    const entry = parseTime(record && record.entry);
    if (entry === null) return null;
    const lunchOut = parseTime(record && record.lunchOut);
    const lunchIn = parseTime(record && record.lunchIn);
    let lunch = RULES.standardLunch;
    if (lunchOut !== null && lunchIn !== null && lunchIn > lunchOut) lunch = lunchIn - lunchOut;
    return formatClock(Math.max(entry, RULES.ordinaryStart) + RULES.ordinaryWork + lunch);
  }

  return { RULES, parseTime, formatMinutes, formatClock, evaluateDay, calculateMonth, calculateEightHourExit };
});
