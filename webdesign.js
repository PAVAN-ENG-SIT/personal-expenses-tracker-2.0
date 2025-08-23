(function () {
  const STORAGE_KEY = "expenses";

  const elements = {
    menuButtons: Array.from(document.querySelectorAll(".menu-item")),
    sections: {
      add: document.getElementById("section-add"),
      view: document.getElementById("section-view"),
      summary: document.getElementById("section-summary"),
    },
    form: document.getElementById("expenseForm"),
    amount: document.getElementById("amount"),
    category: document.getElementById("category"),
    description: document.getElementById("description"),
    addMessage: document.getElementById("addMessage"),

    emptyState: document.getElementById("emptyState"),
    tableBody: document.querySelector("#expensesTable tbody"),

    summaryEmpty: document.getElementById("summaryEmpty"),
    chartCanvas: document.getElementById("categoryChart"),

    csvImport: document.getElementById("csvImport"),
    csvExport: document.getElementById("csvExport"),
    clearAll: document.getElementById("clearAll"),
  };

  let chartInstance = null;

  function loadExpenses() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (err) {
      console.error("Failed to parse expenses from localStorage", err);
      return [];
    }
  }

  function saveExpenses(expenses) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }

  function nowDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function nowTime() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  function showSection(key) {
    elements.menuButtons.forEach((btn) => {
      const target = btn.getAttribute("data-target");
      const isActive = target === key;
      btn.classList.toggle("active", isActive);
      const section = elements.sections[target];
      if (section) section.classList.toggle("visible", isActive);
    });
  }

  function renderTable(expenses) {
    elements.tableBody.innerHTML = "";
    if (!expenses.length) {
      elements.emptyState.style.display = "block";
      return;
    }
    elements.emptyState.style.display = "none";

    expenses.forEach((e, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${e.Date}</td>
        <td>${e.Time}</td>
        <td>${Number(e.Amount).toFixed(1)}</td>
        <td>${e.Category}</td>
        <td>${e.Description || ""}</td>
        <td>
          <button class="action-btn" data-action="delete" data-index="${idx}">Delete</button>
        </td>
      `;
      elements.tableBody.appendChild(tr);
    });
  }

  function computeSummary(expenses) {
    const totals = {};
    for (const e of expenses) {
      const cat = e.Category || "Other";
      const amt = Number(e.Amount) || 0;
      totals[cat] = (totals[cat] || 0) + amt;
    }
    const labels = Object.keys(totals);
    const values = labels.map((l) => Number(totals[l].toFixed(2)));
    return { labels, values };
  }

  function renderChart(expenses) {
    const { labels, values } = computeSummary(expenses);
    if (!labels.length) {
      elements.summaryEmpty.style.display = "block";
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      return;
    }
    elements.summaryEmpty.style.display = "none";

    const colors = labels.map((_, i) => `hsl(${(i * 47) % 360} 85% 60%)`);

    const data = {
      labels,
      datasets: [
        {
          label: "Amount by Category",
          data: values,
          backgroundColor: colors,
          borderRadius: 6,
        },
      ],
    };

    const options = {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.06)" } },
        y: { grid: { color: "rgba(255,255,255,0.06)" } },
      },
    };

    if (chartInstance) {
      chartInstance.data = data;
      chartInstance.options = options;
      chartInstance.update();
    } else {
      chartInstance = new Chart(elements.chartCanvas.getContext("2d"), {
        type: "bar",
        data,
        options,
      });
    }
  }

  function addExpense(expense) {
    const expenses = loadExpenses();
    expenses.push(expense);
    saveExpenses(expenses);
    renderTable(expenses);
    renderChart(expenses);
  }

  function deleteExpenseAt(index) {
    const expenses = loadExpenses();
    if (index < 0 || index >= expenses.length) return;
    expenses.splice(index, 1);
    saveExpenses(expenses);
    renderTable(expenses);
    renderChart(expenses);
  }

  function toCsv(expenses) {
    const headers = ["Date", "Time", "Amount", "Category", "Description"];
    const lines = [headers.join(",")];
    for (const e of expenses) {
      const row = headers
        .map((h) => `${String(e[h] ?? "").replaceAll('"', '""')}`)
        .map((v) => (v.includes(",") || v.includes("\n") ? `"${v}"` : v))
        .join(",");
      lines.push(row);
    }
    return lines.join("\n");
  }

  function download(filename, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8;" }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function parseCsv(text) {
    // Simple CSV parser that handles quoted fields
    const rows = [];
    let i = 0;
    let field = "";
    let row = [];
    let inQuotes = false;

    function pushField() {
      row.push(field);
      field = "";
    }

    function pushRow() {
      rows.push(row);
      row = [];
    }

    while (i < text.length) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          field += ch;
          i++;
          continue;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i++;
          continue;
        }
        if (ch === ',') {
          pushField();
          i++;
          continue;
        }
        if (ch === '\n' || ch === '\r') {
          // handle CRLF or LF
          if (ch === '\r' && text[i + 1] === '\n') i++;
          pushField();
          pushRow();
          i++;
          continue;
        }
        field += ch;
        i++;
      }
    }
    // last field/row
    pushField();
    if (row.length > 1 || row[0] !== "") pushRow();

    return rows;
  }

  function importCsv(text) {
    const rows = parseCsv(text);
    if (!rows.length) return 0;
    const header = rows[0].map((h) => h.trim());
    const idx = {
      Date: header.indexOf("Date"),
      Time: header.indexOf("Time"),
      Amount: header.indexOf("Amount"),
      Category: header.indexOf("Category"),
      Description: header.indexOf("Description"),
    };
    if (idx.Date === -1 || idx.Time === -1 || idx.Amount === -1 || idx.Category === -1 || idx.Description === -1) {
      // try a more flexible approach: allow missing Description
      idx.Description = idx.Description === -1 ? null : idx.Description;
    }

    const expenses = loadExpenses();
    let imported = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || !row.length) continue;
      const expense = {
        Date: row[idx.Date] || nowDate(),
        Time: row[idx.Time] || nowTime(),
        Amount: parseFloat(row[idx.Amount] || "0"),
        Category: row[idx.Category] || "Other",
        Description: idx.Description == null ? (row[4] || "") : (row[idx.Description] || ""),
      };
      if (!isFinite(expense.Amount)) expense.Amount = 0;
      expenses.push(expense);
      imported++;
    }
    saveExpenses(expenses);
    renderTable(expenses);
    renderChart(expenses);
    return imported;
  }

  function initEvents() {
    elements.menuButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        showSection(btn.getAttribute("data-target"));
      });
    });

    elements.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = parseFloat(elements.amount.value);
      const category = elements.category.value;
      const description = elements.description.value.trim();
      if (!isFinite(amount) || amount < 0) {
        elements.addMessage.textContent = "Please enter a valid amount.";
        return;
      }
      const expense = {
        Date: nowDate(),
        Time: nowTime(),
        Amount: Number(amount.toFixed(1)),
        Category: category,
        Description: description,
      };
      addExpense(expense);
      elements.form.reset();
      elements.addMessage.textContent = "Expense added successfully!";
      setTimeout(() => (elements.addMessage.textContent = ""), 1600);
      showSection("view");
    });

    elements.tableBody.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const action = target.getAttribute("data-action");
      if (action === "delete") {
        const index = Number(target.getAttribute("data-index"));
        deleteExpenseAt(index);
      }
    });

    elements.csvExport.addEventListener("click", () => {
      const csv = toCsv(loadExpenses());
      const fileName = `myexpenses_${nowDate()}.csv`;
      download(fileName, csv);
    });

    elements.csvImport.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const count = importCsv(text);
      alert(`Imported ${count} rows`);
      e.target.value = "";
    });

    elements.clearAll.addEventListener("click", () => {
      if (!confirm("Clear all expenses? This cannot be undone.")) return;
      saveExpenses([]);
      renderTable([]);
      renderChart([]);
    });
  }

  function init() {
    initEvents();
    const expenses = loadExpenses();
    renderTable(expenses);
    renderChart(expenses);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
