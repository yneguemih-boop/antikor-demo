(() => {
  "use strict";

  const STORAGE_KEY = "antikor-demo-records-v1";
  const weekdays = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
  const visitLabels = { inspection: "Осмотр", treatment: "Обработка" };
  const statusLabels = { scheduled: "Запланировано", confirmed: "Подтверждено", completed: "Завершено", cancelled: "Отменено" };
  const $ = (selector) => document.querySelector(selector);
  const icon = (name, extra = "") => `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function fromKey(key) { return new Date(`${key}T12:00:00`); }
  function addDays(date, days) { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
  function startOfWeek(date) { return addDays(date, -((date.getDay() + 6) % 7)); }
  function displayDate(key) { return fromKey(key).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }); }
  function countWord(count, one, few, many) {
    const n = count % 100;
    if (n >= 11 && n <= 14) return many;
    const last = n % 10;
    return last === 1 ? one : last >= 2 && last <= 4 ? few : many;
  }
  function loadRecords() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.date === "string" && typeof item.time === "string") : [];
    } catch { return []; }
  }

  let records = loadRecords();
  let selectedDate = dateKey(new Date());
  let weekOffset = 0;
  let editingId = null;
  let visitType = "inspection";

  function persist(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      records = next;
      render();
      return true;
    } catch {
      alert("Не удалось сохранить запись в этом браузере. Проверьте настройки приватности и свободное место.");
      return false;
    }
  }

  function selectView(date) {
    selectedDate = date;
    $("#sidebar").classList.remove("sidebar-open");
    render();
  }
  function render() {
    const today = dateKey(new Date());
    const active = records.filter((item) => item.status === "scheduled" || item.status === "confirmed");
    const todayCount = active.filter((item) => item.date === today).length;
    const thisWeek = startOfWeek(new Date());
    const thisWeekEnd = dateKey(addDays(thisWeek, 6));
    const weekCount = active.filter((item) => item.date >= dateKey(thisWeek) && item.date <= thisWeekEnd).length;
    const overdueCount = active.filter((item) => item.date < today).length;
    $("#today-count").textContent = String(todayCount);
    $("#today-note").textContent = `на ${displayDate(today)}`;
    $("#week-count").textContent = String(weekCount);
    $("#overdue-count").textContent = String(overdueCount);
    $("#nav-count").textContent = String(records.length);
    $("#topbar-date").textContent = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

    const isSchedule = selectedDate !== null;
    $("#nav-schedule").classList.toggle("active", isSchedule);
    $("#nav-all").classList.toggle("active", !isSchedule);
    $("#breadcrumb").textContent = isSchedule ? "Расписание" : "Все записи";
    $("#page-title").textContent = isSchedule ? "Расписание" : "Все записи";
    $("#week-panel").hidden = !isSchedule;

    if (isSchedule) {
      const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7));
      const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
      $("#week-label").textContent = `${displayDate(dateKey(days[0]))} — ${displayDate(dateKey(days[6]))} ${days[0].getFullYear()}`;
      $("#week-grid").innerHTML = days.map((date, index) => {
        const key = dateKey(date);
        const count = active.filter((item) => item.date === key).length;
        const label = count ? `${count} ${countWord(count, "запись", "записи", "записей")}` : "—";
        return `<button class="day-button ${key === selectedDate ? "selected" : ""} ${key === today ? "is-today" : ""}" data-date="${key}"><span>${weekdays[index]}</span><strong>${date.getDate()}</strong><small>${label}</small></button>`;
      }).join("");
    }
    $("#overdue-alert").hidden = !overdueCount;
    $("#overdue-text").textContent = `Есть просроченные записи: ${overdueCount}. Проверьте, приехали ли клиенты, и обновите статус.`;

    $("#records-title").textContent = isSchedule ? `Записи на ${displayDate(selectedDate)}` : "Журнал записей";
    $("#records-subtitle").textContent = isSchedule ? "Все запланированные визиты на выбранный день" : "Все клиенты и визиты в одном месте";
    const query = $("#search").value.trim().toLocaleLowerCase("ru");
    const visitFilter = $("#visit-filter").value;
    const statusFilter = $("#status-filter").value;
    const visible = records.filter((item) => {
      const inDate = !selectedDate || item.date === selectedDate;
      const inVisit = visitFilter === "all" || item.visitType === visitFilter;
      const inStatus = statusFilter === "all" || (statusFilter === "completed" ? item.status === "completed" : item.status === "scheduled" || item.status === "confirmed");
      const inSearch = !query || [item.clientName, item.phone, item.car, item.plate, item.material].some((value) => String(value || "").toLocaleLowerCase("ru").includes(query));
      return inDate && inVisit && inStatus && inSearch;
    }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    $("#visible-count").textContent = String(visible.length);
    $("#record-list").innerHTML = visible.length ? visible.map(renderRecord).join("") : `<div class="empty-state"><div class="empty-icon">${icon("calendar")}</div><h3>${records.length ? "Записи не найдены" : "Пока нет записей"}</h3><p>${records.length ? "Попробуйте изменить фильтр или дату." : "Добавьте первый визит, чтобы увидеть его в расписании."}</p><button class="secondary-button" id="empty-add">${icon("plus", "small")} Добавить запись</button></div>`;

    const upcoming = active.filter((item) => item.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 4);
    $("#upcoming-list").innerHTML = upcoming.length ? upcoming.map((item) => `<button class="upcoming-item" data-id="${escapeHtml(item.id)}"><span class="upcoming-date"><strong>${fromKey(item.date).getDate()}</strong><small>${fromKey(item.date).toLocaleDateString("ru-RU", { month: "short" })}</small></span><span class="upcoming-details"><strong>${escapeHtml(item.clientName)}</strong><small>${escapeHtml(item.car)}</small><em>${escapeHtml(item.time)} · ${visitLabels[item.visitType]?.toLowerCase() || "визит"}</em></span>${icon("chevron", "small")}</button>`).join("") : '<p class="upcoming-empty">Ближайших записей пока нет.</p>';
  }

  function renderRecord(item) {
    const type = item.visitType === "treatment" ? "treatment" : "inspection";
    const status = statusLabels[item.status] ? item.status : "scheduled";
    const phone = String(item.phone || "").replace(/[^+\d]/g, "");
    return `<article class="record-row">
      <div class="record-time"><strong>${escapeHtml(item.time)}</strong><span>${selectedDate ? "визит" : displayDate(item.date)}</span></div>
      <div class="record-type ${type}">${icon("car")}</div>
      <div class="record-main"><div class="record-name-line"><strong>${escapeHtml(item.clientName)}</strong><span class="visit-tag ${type}">${visitLabels[type]}</span></div><div class="record-meta"><span>${escapeHtml(item.car)}${item.plate ? ` · ${escapeHtml(item.plate)}` : ""}</span>${item.material ? `<span class="record-material">Материал: ${escapeHtml(item.material)}</span>` : ""}</div>${item.comment ? `<p class="record-comment">${escapeHtml(item.comment)}</p>` : ""}</div>
      <div class="record-side"><span class="status-pill ${status}"><span class="status-dot"></span>${statusLabels[status]}</span>${phone ? `<a class="phone-link" href="tel:${escapeHtml(phone)}">${icon("phone", "tiny")}${escapeHtml(item.phone)}</a>` : ""}</div>
      <div class="record-actions"><button class="icon-button" data-action="edit" data-id="${escapeHtml(item.id)}" aria-label="Изменить запись ${escapeHtml(item.clientName)}">•••</button>${status !== "completed" && status !== "cancelled" ? `<button class="complete-mini" data-action="complete" data-id="${escapeHtml(item.id)}" aria-label="Завершить запись ${escapeHtml(item.clientName)}">${icon("check", "small")}</button>` : ""}</div>
    </article>`;
  }

  function setVisitType(type) {
    visitType = type;
    $("#choice-inspection").classList.toggle("active", type === "inspection");
    $("#choice-treatment").classList.toggle("active", type === "treatment");
  }
  function openForm(item = null) {
    editingId = item?.id || null;
    $("#form-title").textContent = item ? "Изменить запись" : "Новая запись";
    const form = $("#appointment-form");
    form.reset();
    for (const key of ["clientName", "phone", "car", "plate", "date", "time", "material", "status", "comment"]) {
      form.elements.namedItem(key).value = item?.[key] ?? (key === "date" ? selectedDate || dateKey(new Date()) : key === "time" ? "10:00" : key === "status" ? "scheduled" : "");
    }
    setVisitType(item?.visitType || "inspection");
    $("#delete-button").hidden = !item;
    $("#modal").hidden = false;
    document.body.classList.add("modal-open");
    form.elements.namedItem("clientName").focus();
  }
  function closeForm() {
    $("#modal").hidden = true;
    document.body.classList.remove("modal-open");
    editingId = null;
  }
  function saveForm(event) {
    event.preventDefault();
    const form = $("#appointment-form");
    const value = (key) => String(form.elements.namedItem(key).value || "").trim();
    const data = {
      clientName: value("clientName"), phone: value("phone"), car: value("car"), plate: value("plate"),
      visitType, date: value("date"), time: value("time"), material: value("material"),
      status: value("status"), comment: value("comment"),
    };
    if (!data.clientName || !data.car || !data.date || !data.time) { form.reportValidity(); return; }
    const current = records.find((item) => item.id === editingId);
    const row = { ...data, id: current?.id || (crypto.randomUUID?.() || String(Date.now())), createdAt: current?.createdAt || Date.now(), updatedAt: Date.now() };
    const next = current ? records.map((item) => item.id === current.id ? row : item) : [...records, row];
    if (persist(next)) {
      if (selectedDate) {
        selectedDate = data.date;
        weekOffset = Math.round((startOfWeek(fromKey(data.date)).getTime() - startOfWeek(new Date()).getTime()) / (7 * 86400000));
      }
      closeForm();
      render();
    }
  }
  function removeRecord(id) {
    const item = records.find((record) => record.id === id);
    if (!item || !confirm(`Удалить запись ${item.clientName} на ${displayDate(item.date)}?`)) return;
    if (persist(records.filter((record) => record.id !== id))) closeForm();
  }
  function completeRecord(id) {
    const next = records.map((item) => item.id === id ? { ...item, status: "completed", updatedAt: Date.now() } : item);
    persist(next);
  }

  $("#nav-schedule").addEventListener("click", () => { weekOffset = 0; selectView(dateKey(new Date())); });
  $("#nav-all").addEventListener("click", () => selectView(null));
  $("#upcoming-all").addEventListener("click", () => selectView(null));
  $("#new-button").addEventListener("click", () => openForm());
  $("#today-button").addEventListener("click", () => { weekOffset = 0; selectView(dateKey(new Date())); });
  $("#prev-week").addEventListener("click", () => { weekOffset--; selectedDate = dateKey(addDays(fromKey(selectedDate), -7)); render(); });
  $("#next-week").addEventListener("click", () => { weekOffset++; selectedDate = dateKey(addDays(fromKey(selectedDate), 7)); render(); });
  $("#week-grid").addEventListener("click", (event) => { const button = event.target.closest("[data-date]"); if (button) selectView(button.dataset.date); });
  $("#search").addEventListener("input", render);
  $("#visit-filter").addEventListener("change", render);
  $("#status-filter").addEventListener("change", render);
  $("#show-overdue").addEventListener("click", () => { $("#status-filter").value = "active"; selectView(null); });
  $("#record-list").addEventListener("click", (event) => {
    if (event.target.closest("#empty-add")) { openForm(); return; }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const item = records.find((record) => record.id === button.dataset.id);
    if (!item) return;
    if (button.dataset.action === "edit") openForm(item);
    if (button.dataset.action === "complete") completeRecord(item.id);
  });
  $("#upcoming-list").addEventListener("click", (event) => { const button = event.target.closest("[data-id]"); const item = records.find((record) => record.id === button?.dataset.id); if (item) openForm(item); });
  $("#appointment-form").addEventListener("submit", saveForm);
  $("#choice-inspection").addEventListener("click", () => setVisitType("inspection"));
  $("#choice-treatment").addEventListener("click", () => setVisitType("treatment"));
  $("#close-form").addEventListener("click", closeForm);
  $("#cancel-form").addEventListener("click", closeForm);
  $("#delete-button").addEventListener("click", () => { if (editingId) removeRecord(editingId); });
  $("#modal").addEventListener("mousedown", (event) => { if (event.target === event.currentTarget) closeForm(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("#modal").hidden) closeForm(); });
  $("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("sidebar-open"));
  $("#reset-demo").addEventListener("click", () => { if (records.length && confirm("Очистить все тестовые записи в этом браузере?")) { if (persist([])) { selectedDate = dateKey(new Date()); weekOffset = 0; render(); } } });

  render();
})();
