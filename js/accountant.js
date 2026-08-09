(() => {
  if (sessionStorage.getItem("sa_role") !== "accountant") location.href = "index.html";

  let DATA = null;
  let decisions = JSON.parse(localStorage.getItem("sa_review_decisions") || "{}");

  const $ = id => document.getElementById(id);
  const employeeSelect = $("employeeSelect");
  const cycleMonth = $("cycleMonth");
  const applyCycleBtn = $("applyCycleBtn");
  const exportEmployeeExcelBtn = $("exportEmployeeExcelBtn");
  const exportAllExcelBtn = $("exportAllExcelBtn");

  $("logoutBtn").onclick = () => {
    sessionStorage.clear();
    location.href = "index.html";
  };

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function cycleDecisionKey(code, date) {
    return `${DATA?.cycle?.monthValue || ""}|${code}|${date}`;
  }

  function cyclePunchCount() {
    if (!DATA?.cycle) return 0;
    return DATA.punches.filter(p => p.datetime >= DATA.cycle.start && p.datetime <= DATA.cycle.end).length;
  }

  function renderCycleInfo() {
    if (!DATA?.cycle) {
      $("cycleInfo").textContent = "Import a workbook first.";
      $("cycleBadge").textContent = "No cycle selected";
      return;
    }
    const label = `${DATA.cycle.startKey} → ${DATA.cycle.endKey}`;
    $("cycleInfo").innerHTML = `<strong>${esc(DATA.cycle.label)}</strong> • ${esc(label)} • ${cyclePunchCount()} raw punch rows in this cycle`;
    $("cycleBadge").textContent = label;
  }

  function renderEmployee(code) {
    if (!DATA || !code || !DATA.cycle) {
      exportEmployeeExcelBtn.disabled = true;
      return;
    }
    const employee = DATA.employees.find(e => String(e.code) === String(code));
    if (!employee) {
      exportEmployeeExcelBtn.disabled = true;
      return;
    }

    const rows = AttendanceEngine.analyzeEmployee(employee, DATA);
    const s = AttendanceEngine.summary(rows);

    exportEmployeeExcelBtn.disabled = false;

    $("employeeSummary").innerHTML = `
      <div class="mini"><span>Name</span><strong>${esc(employee.name)}</strong></div>
      <div class="mini"><span>Code</span><strong>${employee.code}</strong></div>
      <div class="mini"><span>Job</span><strong>${esc(employee.job)}</strong></div>
      <div class="mini"><span>Present</span><strong>${s.present}</strong></div>
      <div class="mini"><span>Review</span><strong>${s.review}</strong></div>
      <div class="mini"><span>Missing punch</span><strong>${s.missing}</strong></div>
      <div class="mini"><span>Total late</span><strong>${AttendanceEngine.fmtMinutes(s.late)}</strong></div>
      <div class="mini"><span>Total OT</span><strong>${AttendanceEngine.fmtMinutes(s.earlyOT+s.lateOT)}</strong></div>
    `;

    $("attendanceTable").querySelector("tbody").innerHTML = rows.map(r => {
      const decisionKey = cycleDecisionKey(r.code, r.date);
      const displayStatus = decisions[decisionKey] || r.status;

      return `
        <tr class="${r.review ? "review-row" : ""}">
          <td>${r.date}</td>
          <td>${esc(r.day)}</td>
          <td>${r.first || "—"}</td>
          <td>${r.last || "—"}</td>
          <td>${r.scheduledIn}–${r.scheduledOut}</td>
          <td>${AttendanceEngine.fmtMinutes(r.late) || "—"}</td>
          <td>${AttendanceEngine.fmtMinutes(r.earlyLeave) || "—"}</td>
          <td>${AttendanceEngine.fmtMinutes(r.earlyOT) || "—"}</td>
          <td>${AttendanceEngine.fmtMinutes(r.lateOT) || "—"}</td>
          <td><span class="status">${esc(displayStatus)}</span></td>
          <td>${r.review ? `<button class="tiny" data-review="${r.code}|${r.date}">Decide</button>` : "—"}</td>
        </tr>
      `;
    }).join("");

    $("attendanceTable").querySelectorAll("[data-review]").forEach(btn => {
      btn.onclick = () => reviewItem(btn.dataset.review);
    });
  }

  function reviewItem(key) {
    if (!DATA?.cycle) return;
    const [code,date] = key.split("|");
    const decisionKey = cycleDecisionKey(code, date);
    const current = decisions[decisionKey] || "";
    const answer = prompt("Accountant decision for this no-punch day:\nLeave / Present / Absence / Mission / Other", current);
    if (answer === null) return;
    decisions[decisionKey] = answer.trim() || "Pending";
    localStorage.setItem("sa_review_decisions", JSON.stringify(decisions));
    renderReviewQueue();
    renderEmployee(employeeSelect.value);
  }

  function renderReviewQueue() {
    if (!DATA?.cycle) return;
    const rows = [];
    for (const emp of DATA.employees) {
      for (const r of AttendanceEngine.analyzeEmployee(emp, DATA)) {
        if (r.review) rows.push({emp, r});
      }
    }
    $("kpiReview").textContent = rows.length;
    $("reviewTable").querySelector("tbody").innerHTML = rows.map(x => {
      const key = `${x.emp.code}|${x.r.date}`;
      const decisionKey = cycleDecisionKey(x.emp.code, x.r.date);
      return `<tr class="review-row">
        <td>${esc(x.emp.name)}</td><td>${x.emp.code}</td><td>${x.r.date}</td><td>${esc(x.r.day)}</td>
        <td>${esc(x.r.status)}</td><td><button class="tiny" data-review="${key}">${esc(decisions[decisionKey] || "Decide")}</button></td>
      </tr>`;
    }).join("") || `<tr><td colspan="6" class="empty">No review items.</td></tr>`;

    $("reviewTable").querySelectorAll("[data-review]").forEach(btn => btn.onclick = () => reviewItem(btn.dataset.review));
  }

  function exportEmployeeExcel() {
    const code = employeeSelect.value;
    if (!DATA || !code || !DATA.cycle) return;
    const employee = DATA.employees.find(e => String(e.code) === String(code));
    const rows = AttendanceEngine.analyzeEmployee(employee, DATA);

    const exportData = rows.map(r => {
      const decisionKey = cycleDecisionKey(r.code, r.date);
      return {
        "Date": r.date,
        "Day": r.day,
        "First Punch": r.first || "-",
        "Last Punch": r.last || "-",
        "Scheduled": `${r.scheduledIn}-${r.scheduledOut}`,
        "Late": AttendanceEngine.fmtMinutes(r.late) || "00:00",
        "Early Leave": AttendanceEngine.fmtMinutes(r.earlyLeave) || "00:00",
        "Early OT": AttendanceEngine.fmtMinutes(r.earlyOT) || "00:00",
        "Late OT": AttendanceEngine.fmtMinutes(r.lateOT) || "00:00",
        "Status": decisions[decisionKey] || r.status
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    XLSX.writeFile(wb, `Attendance_${employee.code}_${DATA.cycle.monthValue}.xlsx`);
  }

  function exportAllSummaryExcel() {
    if (!DATA || !DATA.cycle) return;

    const summaryRows = DATA.employees.map(emp => {
      const rows = AttendanceEngine.analyzeEmployee(emp, DATA);
      const s = AttendanceEngine.summary(rows);

      return {
        "Code": emp.code,
        "Name": emp.name,
        "Job": emp.job,
        "Department": emp.department,
        "Present Days": s.present,
        "Review Days": s.review,
        "Missing Punch": s.missing,
        "Total Late": AttendanceEngine.fmtMinutes(s.late),
        "Total Early Leave": AttendanceEngine.fmtMinutes(s.earlyLeave),
        "Total Overtime": AttendanceEngine.fmtMinutes(s.earlyOT + s.lateOT)
      };
    });

    const ws = XLSX.utils.json_to_sheet(summaryRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monthly Summary");
    XLSX.writeFile(wb, `Attendance_Summary_${DATA.cycle.monthValue}.xlsx`);
  }

  function setCycle(monthValue) {
    if (!DATA || !monthValue) return;
    const cycle = AttendanceEngine.createCycle(monthValue);
    if (!cycle) return;
    DATA.cycle = cycle;
    DATA.grouped = AttendanceEngine.groupPunches(DATA.punches, cycle);

    renderCycleInfo();
    $("kpiPunches").textContent = cyclePunchCount();
    $("kpiMissing").textContent = 0;
    $("engineStatus").textContent = "Cycle applied";
    exportAllExcelBtn.disabled = false;

    renderEmployee(employeeSelect.value);
    renderReviewQueue();

    const reports = {};
    for (const emp of DATA.employees) {
      reports[String(emp.code)] = {
        employee: emp,
        rows: AttendanceEngine.analyzeEmployee(emp, DATA),
        cycle: DATA.cycle
      };
    }
    localStorage.setItem("sa_employee_reports", JSON.stringify(reports));

    sessionStorage.setItem("sa_cycle", JSON.stringify({
      monthValue: cycle.monthValue,
      startKey: cycle.startKey,
      endKey: cycle.endKey
    }));
  }

  function setCycleCandidates() {
    const candidates = AttendanceEngine.cycleCandidates(DATA.punches);
    cycleMonth.disabled = false;
    applyCycleBtn.disabled = false;

    if (!cycleMonth.value) {
      const saved = JSON.parse(sessionStorage.getItem("sa_cycle") || "null");
      cycleMonth.value = saved?.monthValue || candidates[candidates.length - 1] || "";
    }
  }

  function loadData(data) {
    DATA = data;
    window.SA_DATA = data;
    $("engineStatus").textContent = "Workbook loaded — choose cycle";
    $("kpiEmployees").textContent = data.employees.length;
    $("kpiPunches").textContent = data.punches.length;
    $("kpiReview").textContent = 0;
    $("kpiMissing").textContent = 0;

    employeeSelect.innerHTML = data.employees
      .slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'))
      .map(e => `<option value="${e.code}">${esc(e.code)} — ${esc(e.name)}</option>`).join("");

    employeeSelect.onchange = () => renderEmployee(employeeSelect.value);
    setCycleCandidates();

    const saved = JSON.parse(sessionStorage.getItem("sa_cycle") || "null");
    const candidates = AttendanceEngine.cycleCandidates(data.punches);
    const defaultMonth = saved?.monthValue || candidates[candidates.length - 1] || "";
    if (defaultMonth) {
      cycleMonth.value = defaultMonth;
      setCycle(defaultMonth);
    } else {
      renderCycleInfo();
    }
  }

  applyCycleBtn.onclick = () => setCycle(cycleMonth.value);
  exportEmployeeExcelBtn.onclick = exportEmployeeExcel;
  exportAllExcelBtn.onclick = exportAllSummaryExcel;

  cycleMonth.addEventListener("change", () => {
    if (DATA) setCycle(cycleMonth.value);
  });

  $("excelFile").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    $("importMessage").textContent = "Reading workbook…";
    $("importMessage").className = "message";
    try {
      const data = await AttendanceParser.parseFile(file);
      loadData(data);
      $("importMessage").textContent = `Import complete • sheets: ${data.sheets.join(" • ")} • ${data.punches.length} total punches • ${data.employees.length} employees`;
      $("importMessage").className = "message success";
    } catch (err) {
      console.error(err);
      $("importMessage").textContent = err.message || "Import failed.";
      $("importMessage").className = "message error";
    }
  });

  $("demoBtn").onclick = () => {
    $("importMessage").textContent = "Choose the actual Excel file to run the real parser. The cycle is selected separately after import.";
    $("importMessage").className = "message";
  };
})();
