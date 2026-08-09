(() => {
  if (sessionStorage.getItem("sa_role") !== "employee") {
    location.href = "index.html";
    return;
  }

  const code = sessionStorage.getItem("sa_employee_code");
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = v => {
    if (!v) return "—";
    const n = Math.round(v * 60), h = Math.floor(n / 60), m = n % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  document.getElementById("logoutBtn").onclick = () => { 
    sessionStorage.clear(); 
    location.href = "index.html"; 
  };

  const container = document.getElementById("employeeTable");
  container.innerHTML = `<div class="empty">جاري تحميل تقرير الحضور من السيرفر...</div>`;

  // جلب البيانات من Google Sheets
  const apiUrl = window.ATTENDANCE_CONFIG?.googleSheetApiUrl;
  
  if (apiUrl) {
    fetch(`${apiUrl}?code=${encodeURIComponent(code)}`)
      .then(res => res.json())
      .then(res => {
        if (res.status === "success" && res.data) {
          renderReport(res.data);
        } else {
          // تجربة القراءة من التخزين المحلي كخيار احتياطي
          const localReports = JSON.parse(localStorage.getItem("sa_employee_reports") || "{}");
          if (localReports[String(code)]) {
            renderReport(localReports[String(code)]);
          } else {
            showNotFound();
          }
        }
      })
      .catch(() => {
        const localReports = JSON.parse(localStorage.getItem("sa_employee_reports") || "{}");
        if (localReports[String(code)]) {
          renderReport(localReports[String(code)]);
        } else {
          showNotFound();
        }
      });
  }

  function showNotFound() {
    document.getElementById("employeeName").textContent = `Employee ${code || ""}`;
    document.getElementById("employeeMeta").textContent = "تقرير الحضور غير متاح حالياً.";
    container.innerHTML = `<div class="empty">لم يتم العثور على سجلات لهذا الكود. تواصل مع المحاسب.</div>`;
  }

  function renderReport(report) {
    const { employee, rows, cycle } = report;
    const decisions = JSON.parse(localStorage.getItem("sa_review_decisions") || "{}");

    document.getElementById("employeeName").textContent = employee.name;
    document.getElementById("employeeMeta").innerHTML = `${esc(employee.job || 'موظف')} • كود: ${esc(employee.code)} • الدورة: ${esc(cycle.startKey)} ← ${esc(cycle.endKey)}`;

    const present = rows.filter(r => r.status === "Present").length;
    const holiday = rows.filter(r => r.status === "Weekly holiday").length;
    const review = rows.filter(r => r.review).length;
    const missing = rows.filter(r => r.status === (window.ATTENDANCE_CONFIG?.rules?.missingPunchLabel || "Your fingerprint is lost.")).length;
    const late = rows.reduce((a,r) => a + (r.late || 0), 0);
    const ot = rows.reduce((a,r) => a + (r.earlyOT || 0) + (r.lateOT || 0), 0);

    container.innerHTML = `
      <div class="employee-welcome">
        <div class="pulse-dot"></div>
        <div>
          <strong>أهلاً بك، ${esc(employee.name.split(' ')[0])} 👋</strong>
          <span>تقرير الحضور والغياب الخاص بك معتمد من السيرفر.</span>
        </div>
      </div>

      <div class="employee-kpis">
        <div class="employee-kpi"><span>أيام الحضور</span><strong>${present}</strong></div>
        <div class="employee-kpi"><span>إجمالي الإضافي</span><strong>${fmt(ot)}</strong></div>
        <div class="employee-kpi"><span>إجمالي التأخير</span><strong>${fmt(late)}</strong></div>
        <div class="employee-kpi"><span>بصمة واحدة</span><strong>${missing}</strong></div>
        <div class="employee-kpi"><span>العطلات الأسبوعية</span><strong>${holiday}</strong></div>
        <div class="employee-kpi"><span>تحت مراجعة المحاسب</span><strong>${review}</strong></div>
      </div>

      <div class="table-wrap employee-table-wrap">
        <table>
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>اليوم</th>
              <th>الحضور</th>
              <th>الانصراف</th>
              <th>المواعيد المحددة</th>
              <th>التأخير</th>
              <th>إضافي مبكر</th>
              <th>إضافي متأخر</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => {
              const decisionKey = `${cycle.monthValue}|${employee.code}|${r.date}`;
              const finalStatus = decisions[decisionKey] || r.status;

              return `
                <tr style="animation-delay: ${Math.min(i * 12, 600)}ms">
                  <td>${esc(r.date)}</td>
                  <td>${esc(r.day)}</td>
                  <td>${r.first || "—"}</td>
                  <td>${r.last || "—"}</td>
                  <td>${r.scheduledIn} – ${r.scheduledOut}</td>
                  <td>${fmt(r.late)}</td>
                  <td>${fmt(r.earlyOT)}</td>
                  <td>${fmt(r.lateOT)}</td>
                  <td>
                    <span class="employee-status ${
                      finalStatus === 'Present' ? 'ok' : 
                      finalStatus === 'Weekly holiday' ? 'holiday' : 
                      r.review ? 'review' : 'warn'
                    }">
                      ${esc(finalStatus)}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
})();
