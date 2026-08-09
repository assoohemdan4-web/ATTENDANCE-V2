(() => {
  const role = document.getElementById("role");
  const username = document.getElementById("username");
  const label = document.getElementById("userLabel");
  const msg = document.getElementById("loginMsg");
  const passwordInput = document.getElementById("password");
  const passwordLabel = passwordInput ? passwordInput.closest("label") : null;

  function sync() {
    if (role.value === "employee") {
      label.firstChild.textContent = "Employee code";
      username.placeholder = "Enter your code (e.g. 7636)";
      username.value = "7636";
      
      // إخفاء خانة الباسورد عند اختيار الموظف
      if (passwordLabel) passwordLabel.style.display = "none";
    } else {
      label.firstChild.textContent = "Username";
      username.placeholder = "Username";
      username.value = "accountant";
      
      // إظهار خانة الباسورد للمحاسب
      if (passwordLabel) passwordLabel.style.display = "grid";
    }
  }
  
  role.addEventListener("change", sync);
  sync();

  document.getElementById("loginForm").addEventListener("submit", e => {
    e.preventDefault();
    const r = role.value;
    const u = username.value.trim();
    const p = passwordInput ? passwordInput.value : "";

    // دخول المحاسب باستخدام الباسورد الجديد yasser162003
    if (r === "accountant" && u === ATTENDANCE_CONFIG.auth.accountantUsername && p === ATTENDANCE_CONFIG.auth.accountantPassword) {
      sessionStorage.setItem("sa_role", "accountant");
      location.href = "accountant.html";
      return;
    }
    
    // دخول الموظف بكوده فقط دون الحاجة لكمة سر
    if (r === "employee" && u) {
      sessionStorage.setItem("sa_role", "employee");
      sessionStorage.setItem("sa_employee_code", u);
      location.href = "employee.html";
      return;
    }

    msg.textContent = "Invalid prototype credentials.";
    msg.className = "message error";
  });
})();
