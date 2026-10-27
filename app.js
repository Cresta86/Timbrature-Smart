(function () {
  "use strict";
  const Core = window.SimpleTimeCore;
  const STORAGE_PREFIX = "timbrature-semplici-v1:";
  const SMART_PATTERN_KEY = "timbrature-semplici-v1:smart-weekdays";
  const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
  const dayNames = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  let shown = new Date();
  shown = new Date(shown.getFullYear(), shown.getMonth(), 1);
  let activeDate = "";
  let records = {};

  const $ = (id) => document.getElementById(id);
  const els = {
    grid: $("calendarGrid"), month: $("todayMonth"), dialog: $("dayDialog"), form: $("dayForm"),
    title: $("dialogTitle"), entry: $("entryInput"), exit: $("exitInput"), lunchOut: $("lunchOutInput"),
    lunchIn: $("lunchInInput"), type: $("dayType"), note: $("noteInput"), error: $("errorBox"), preview: $("livePreview"),
    delete: $("deleteDay"), calcText: $("calculatedExit"), toast: $("toast"), smartDialog: $("smartMonthDialog"),
    smartForm: $("smartMonthForm"), smartError: $("smartMonthError"), smartPreview: $("smartMonthPreview")
  };

  function monthKey() { return `${shown.getFullYear()}-${String(shown.getMonth() + 1).padStart(2, "0")}`; }
  function storageKey() { return STORAGE_PREFIX + monthKey(); }
  function load() {
    try { records = JSON.parse(localStorage.getItem(storageKey()) || "{}"); }
    catch (_) { records = {}; }
  }
  function persist() { localStorage.setItem(storageKey(), JSON.stringify(records)); }
  function isoDate(day) { return `${monthKey()}-${String(day).padStart(2, "0")}`; }
  function escapeHtml(value) {
    return String(value || "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }
  function plural(value, one, many) { return `${value} ${value === 1 ? one : many}`; }
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 2300);
  }

  function selectedSmartWeekdays() {
    return [...document.querySelectorAll('input[name="smartWeekday"]:checked')].map((input) => Number(input.value));
  }
  function matchingSmartDates(weekdays) {
    const matches = [];
    const days = new Date(shown.getFullYear(), shown.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(shown.getFullYear(), shown.getMonth(), day);
      if (weekdays.includes(date.getDay())) matches.push(isoDate(day));
    }
    return matches;
  }
  function updateSmartMonthPreview() {
    const weekdays = selectedSmartWeekdays();
    if (!weekdays.length) {
      els.smartPreview.textContent = "Seleziona almeno un giorno.";
      return;
    }
    const dates = matchingSmartDates(weekdays);
    const occupied = dates.filter((date) => Boolean(records[date])).length;
    const overwrite = $("overwriteSmartMonth").checked;
    const applied = overwrite ? dates.length : dates.length - occupied;
    const protectedText = occupied === 1 ? " 1 giornata già compilata sarà lasciata invariata." : ` ${occupied} giornate già compilate saranno lasciate invariate.`;
    els.smartPreview.textContent = `${applied} giornate verranno impostate come Smart working in ${monthNames[shown.getMonth()]} ${shown.getFullYear()}.${!overwrite && occupied ? protectedText : ""}`;
  }
  function openSmartMonthDialog() {
    $("smartMonthTitle").textContent = `Smart working · ${monthNames[shown.getMonth()]} ${shown.getFullYear()}`;
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(SMART_PATTERN_KEY) || "[]"); } catch (_) { saved = []; }
    document.querySelectorAll('input[name="smartWeekday"]').forEach((input) => { input.checked = saved.includes(Number(input.value)); });
    $("overwriteSmartMonth").checked = false;
    els.smartError.hidden = true;
    updateSmartMonthPreview();
    els.smartDialog.showModal();
  }

  function render() {
    const year = shown.getFullYear();
    const month = shown.getMonth();
    els.month.textContent = `${monthNames[month]} ${year}`;
    const result = Core.calculateMonth(records);
    $("balanceValue").textContent = Core.formatMinutes(result.minutesInPiu);
    $("extraValue").textContent = Core.formatMinutes(result.extraMinutes);
    $("extraBlocks").textContent = plural(result.extraBlocks, "blocco da 15 min", "blocchi da 15 min");
    $("missingValue").textContent = Core.formatMinutes(result.missingMinutes);
    $("basketValue").textContent = `${result.basketUsed} / ${Core.RULES.monthlyEntryBasket} min`;
    $("basketRemaining").textContent = `${result.basketRemaining} min disponibili`;
    const statuses = [];
    if (result.openDays) statuses.push(plural(result.openDays, "giornata aperta", "giornate aperte"));
    if (result.invalidDays) statuses.push(plural(result.invalidDays, "giornata da correggere", "giornate da correggere"));
    $("openDaysStatus").textContent = statuses.length ? statuses.join(" · ") : "Tutte le giornate inserite sono complete";

    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const leading = (first.getDay() + 6) % 7;
    const now = new Date();
    let html = "";
    for (let i = 0; i < leading; i += 1) html += '<div class="day-spacer" aria-hidden="true"></div>';
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(year, month, day);
      const key = isoDate(day);
      const info = result.perDay[key] || Core.evaluateDay({});
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
      const classes = ["day-card", isWeekend ? "weekend" : "", info.hasAny && !info.complete ? "open" : "", !info.valid ? "invalid" : ""].filter(Boolean).join(" ");
      let body = '<span class="day-empty">Tocca per inserire</span>';
      if (info.hasAny) {
        body = `<span class="day-badge ${info.type === "smart" ? "smart" : ""}">${info.type === "smart" ? "Smart working" : "Ufficio"}</span>`;
        body += `<div class="stamp-row"><span>Entrata</span><strong>${escapeHtml(info.entry || "--:--")}</strong></div>`;
        if (info.complete) {
          const lunchText = info.lunchOut && info.lunchIn ? `${info.lunchOut}–${info.lunchIn}` : "45 min standard";
          body += `<div class="stamp-row lunch"><span>Pausa pranzo</span><br><strong>${escapeHtml(lunchText)}</strong></div>`;
          body += `<div class="stamp-row"><span>Uscita</span><strong>${escapeHtml(info.exit)}</strong></div>`;
          if (info.valid) {
            const sign = info.delta > 0 ? "+" : info.delta < 0 ? "−" : "";
            const cls = info.delta > 0 ? "positive" : info.delta < 0 ? "negative" : "neutral";
            body += `<div class="day-result ${cls}">${info.delta === 0 ? "Orario completato" : `${sign}${Core.formatMinutes(Math.abs(info.delta))}`}`;
            if (info.addedExtra) body += `<br>Extra: +${Core.formatMinutes(info.addedExtra)}`;
            if (info.basketUsed) body += `<br><span class="basket-text">Basket ingresso: ${info.basketUsed} min</span>`;
            if (info.overBasket) body += `<br><span class="negative">Oltre basket: ${info.overBasket} min</span>`;
            if (info.earlyEntryIgnored) body += `<br><span class="neutral">Prima delle 08:00: ${info.earlyEntryIgnored} min non conteggiati</span>`;
            body += "</div>";
          }
        } else body += '<div class="day-result open-text">Giornata aperta · uscita da inserire</div>';
        if (!info.valid) body += `<div class="day-result negative">${escapeHtml(info.errors[0])}</div>`;
        if (info.note) body += `<div class="note-line" title="${escapeHtml(info.note)}">${escapeHtml(info.note)}</div>`;
      }
      html += `<button type="button" class="${classes}" data-date="${key}" aria-label="${dayNames[date.getDay()]} ${day} ${monthNames[month]}"><div class="day-number"><span>${day}</span>${isToday ? '<span class="today-dot" title="Oggi"></span>' : ""}</div>${body}</button>`;
    }
    els.grid.innerHTML = html;
  }

  function openDay(dateKey) {
    activeDate = dateKey;
    const date = new Date(`${dateKey}T12:00:00`);
    els.title.textContent = `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]}`;
    const row = records[dateKey] || {};
    els.type.value = row.type === "smart" ? "smart" : "office";
    els.entry.value = row.entry || "";
    els.exit.value = row.exit || "";
    els.lunchOut.value = row.lunchOut || "";
    els.lunchIn.value = row.lunchIn || "";
    els.note.value = row.note || "";
    els.delete.hidden = !records[dateKey];
    els.error.hidden = true;
    els.error.textContent = "";
    applyDayType();
    updatePreview();
    els.dialog.showModal();
    setTimeout(() => els.entry.focus(), 0);
  }

  function formRecord() {
    return { type: els.type.value, entry: els.entry.value, exit: els.exit.value, lunchOut: els.lunchOut.value, lunchIn: els.lunchIn.value, note: els.note.value.trim() };
  }
  function applyDayType() {
    const smart = els.type.value === "smart";
    if (smart) {
      els.entry.value = "08:00";
      els.exit.value = "16:45";
      els.lunchOut.value = "";
      els.lunchIn.value = "";
    }
    [els.entry, els.exit, els.lunchOut, els.lunchIn].forEach((input) => { input.disabled = smart; });
    $("calculateExit").disabled = smart;
    $("clearLunch").disabled = smart;
    document.querySelectorAll("[data-lunch]").forEach((button) => { button.disabled = smart; });
  }
  function updatePreview() {
    const record = formRecord();
    const info = Core.evaluateDay(record);
    const calc = Core.calculateEightHourExit(record);
    els.calcText.textContent = calc ? `Uscita prevista: ${calc}` : "";
    if (!info.hasAny || !info.entry) {
      els.preview.textContent = "Inserisci l’entrata per iniziare.";
      return;
    }
    if (!info.valid) {
      els.preview.textContent = info.errors.join(" ");
      return;
    }
    if (!info.complete) {
      els.preview.textContent = `Entrata salvabile. Flessibilità usata: ${Core.formatMinutes(info.dailyFlexUsed)}${info.basketRequested ? `; basket richiesto: ${Core.formatMinutes(info.basketRequested)}` : ""}.`;
      return;
    }
    const sign = info.delta > 0 ? "+" : info.delta < 0 ? "−" : "";
    els.preview.textContent = `Presenza netta: ${Core.formatMinutes(info.workedMinutes)}. Risultato giornaliero: ${sign}${Core.formatMinutes(Math.abs(info.delta))}.${info.lunchAssumed ? " Pausa standard di 45 minuti applicata." : ""}${info.earlyEntryIgnored ? ` I ${info.earlyEntryIgnored} minuti prima delle 08:00 non vengono conteggiati.` : ""}`;
  }

  els.grid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-date]");
    if (card) openDay(card.dataset.date);
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  [els.entry, els.exit, els.lunchOut, els.lunchIn, els.note].forEach((input) => input.addEventListener("input", updatePreview));
  els.type.addEventListener("change", () => { applyDayType(); updatePreview(); });
  document.querySelectorAll("[data-lunch]").forEach((button) => button.addEventListener("click", () => {
    [els.lunchOut.value, els.lunchIn.value] = button.dataset.lunch.split(",");
    updatePreview();
  }));
  $("clearLunch").addEventListener("click", () => { els.lunchOut.value = ""; els.lunchIn.value = ""; updatePreview(); });
  $("calculateExit").addEventListener("click", () => {
    const value = Core.calculateEightHourExit(formRecord());
    if (!value) { els.entry.focus(); showToast("Inserisci prima l’entrata"); return; }
    els.exit.value = value;
    updatePreview();
  });
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const record = formRecord();
    const info = Core.evaluateDay(record);
    if (!info.hasAny || !record.entry || !info.valid) {
      els.error.textContent = !record.entry ? "Inserisci almeno l’orario di entrata." : info.errors.join(" ");
      els.error.hidden = false;
      return;
    }
    records[activeDate] = record;
    persist();
    els.dialog.close();
    render();
    showToast(record.exit ? "Giornata salvata" : "Entrata salvata: potrai aggiungere l’uscita più tardi");
  });
  els.delete.addEventListener("click", () => {
    if (!activeDate || !records[activeDate]) return;
    delete records[activeDate];
    persist();
    els.dialog.close();
    render();
    showToast("Giornata cancellata");
  });
  $("prevMonth").addEventListener("click", () => { shown = new Date(shown.getFullYear(), shown.getMonth() - 1, 1); load(); render(); });
  $("nextMonth").addEventListener("click", () => { shown = new Date(shown.getFullYear(), shown.getMonth() + 1, 1); load(); render(); });
  $("todayMonth").addEventListener("click", () => { const now = new Date(); shown = new Date(now.getFullYear(), now.getMonth(), 1); load(); render(); });
  $("resetMonth").addEventListener("click", () => {
    if (!Object.keys(records).length) { showToast("Il mese è già vuoto"); return; }
    if (!window.confirm(`Cancellare tutte le timbrature di ${monthNames[shown.getMonth()]} ${shown.getFullYear()}?`)) return;
    records = {};
    localStorage.removeItem(storageKey());
    render();
    showToast("Mese azzerato");
  });
  $("autoSmartButton").addEventListener("click", openSmartMonthDialog);
  document.querySelectorAll('input[name="smartWeekday"]').forEach((input) => input.addEventListener("change", updateSmartMonthPreview));
  $("overwriteSmartMonth").addEventListener("change", updateSmartMonthPreview);
  els.smartForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const weekdays = selectedSmartWeekdays();
    if (!weekdays.length) {
      els.smartError.textContent = "Seleziona almeno un giorno della settimana.";
      els.smartError.hidden = false;
      return;
    }
    const overwrite = $("overwriteSmartMonth").checked;
    const dates = matchingSmartDates(weekdays);
    let applied = 0;
    let skipped = 0;
    dates.forEach((date) => {
      if (records[date] && !overwrite) { skipped += 1; return; }
      records[date] = { type: "smart", entry: "08:00", exit: "16:45", lunchOut: "", lunchIn: "", note: "" };
      applied += 1;
    });
    localStorage.setItem(SMART_PATTERN_KEY, JSON.stringify(weekdays));
    persist();
    els.smartDialog.close();
    render();
    showToast(`${applied} giornate Smart inserite${skipped ? ` · ${skipped} già compilate non modificate` : ""}`);
  });
  $("exportButton").addEventListener("click", () => {
    const result = Core.calculateMonth(records);
    const rows = [["Data", "Tipo", "Entrata", "Uscita pranzo", "Rientro pranzo", "Uscita finale", "Pausa minuti", "Presenza minuti", "Differenza minuti", "Basket ingresso", "Extra", "Nota"]];
    Object.keys(records).sort().forEach((date) => {
      const day = result.perDay[date];
      rows.push([date, day.type === "smart" ? "Smart working" : "Ufficio", day.entry, day.lunchOut, day.lunchIn, day.exit, day.lunchMinutes ?? "", day.workedMinutes ?? "", day.delta ?? "", day.basketUsed, day.addedExtra, day.note]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `timbrature-${monthKey()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("File CSV esportato");
  });

  load();
  render();
})();
