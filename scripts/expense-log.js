// ===========================================================
// 🌿 KINAYA RISING — EXPENSE LOG CONTROLLER (2025)
// Unified with Inventory + POS ecosystem
// ===========================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🌿 Kinaya Expense Log initializing...");

  // ===========================================================
  // ⚙️ CONFIGURATION + CORE ELEMENTS
  // ===========================================================
  const SHEET_API =
    "https://script.google.com/macros/s/AKfycbxDzflmDmWiP8qzTUKhKdsdWSL_ZOaRnA8sRrmJ0Qj8yPXm1hya6dWvq-BoJW25NntLLA/exec"; // 🔹 Replace if redeployed

  const tableBody = document.querySelector("#expense-table tbody");
  const saveBtn = document.getElementById("save-expense-btn");


  // ===========================================================
  // 🧾 FORM ELEMENTS
  // ===========================================================
  const dateEl = document.getElementById("date");
  const categoryEl = document.getElementById("category");
  const descEl = document.getElementById("description");
  const vendorEl = document.getElementById("vendor");
  const invoiceAmountEl = document.getElementById("invoice-amount");
  const shippingEl = document.getElementById("shipping");
  const totalEl = document.getElementById("total");
  const paymentEl = document.getElementById("payment-method");
  const paidEl = document.getElementById("paid");
  const receivedEl = document.getElementById("received");
  const dateReceivedEl = document.getElementById("date-received");
  const invoicePOEl = document.getElementById("invoice-po");
  const taxEl = document.getElementById("tax-deductible");

  const displayEl = document.getElementById("expense-number-display");

  let nextExpenseNumber = "EXP-001";

// ===========================================================
// 🧮 LIVE TOTAL CALCULATOR — invoice + tax + shipping
// ===========================================================
const invoiceAmountInput = document.getElementById("invoice-amount");
const taxInput = document.getElementById("tax-amount");
const shippingInput = document.getElementById("shipping");
const totalInput = document.getElementById("total");

function updateExpenseTotal(triggeredByBlur = false) {
  const invoice = parseFloat(invoiceAmountInput?.value) || 0;
  const tax = parseFloat(taxInput?.value) || 0;
  const shipping = parseFloat(shippingInput?.value) || 0;
  const total = invoice + tax + shipping;

  totalInput.value = total.toFixed(2);

  // Format neatly when leaving the field
  if (triggeredByBlur) {
    [invoiceAmountInput, taxInput, shippingInput].forEach((el) => {
      if (el && el.value) el.value = parseFloat(el.value).toFixed(2);
    });
  }
}

// 🔁 Update total dynamically as user types or leaves field
[invoiceAmountInput, taxInput, shippingInput].forEach((el) => {
  el.addEventListener("input", () => updateExpenseTotal(false));
  el.addEventListener("blur", () => updateExpenseTotal(true));
});

// Run once on load
updateExpenseTotal(true);


  // ===========================================================
  // 🧮 GET NEXT EXPENSE NUMBER FROM SHEET
  // ===========================================================
  async function getNextExpenseNumber() {
    try {
      const res = await fetch(`${SHEET_API}?mode=expenses`);
      const json = await res.json();
      const data = json.data || [];
      if (!data.length) return "EXP-001";

      const last = data[data.length - 1];
      const lastNum = (last["Expense #"] || last["ExpenseID"] || "").replace(/[^\d]/g, "");
      const nextNum = (parseInt(lastNum, 10) || 0) + 1;
      return `EXP-${String(nextNum).padStart(3, "0")}`;
    } catch (err) {
      console.error("❌ Failed to fetch next expense number:", err);
      return "EXP-001";
    }
  }

// ===========================================================
// 💾 SAVE EXPENSE — CORS SAFE + EXP-ID + AUTO RESET
// ===========================================================
async function saveExpense() {
  const SHEET_API =
    "https://script.google.com/macros/s/AKfycbw3lgHk_DldA6zdUYsek6FTO64qtSEnE86nOdW5xNxWZbhiDHAvS53jtk6zuuf5tjJOkw/exec"; // 🔹 Replace if redeployed

  const data = {
    Mode: "expenseEntry",
    "Expense ID": window.nextExpenseId || "",
    Date: document.getElementById("date")?.value || new Date().toLocaleDateString("en-CA"),
    Category: document.getElementById("category")?.value.trim(),
    Description: document.getElementById("description")?.value.trim(),
    Vendor: document.getElementById("vendor")?.value.trim(),
    InvoiceAmount: parseFloat(document.getElementById("invoice-amount")?.value) || 0,
    Tax: parseFloat(document.getElementById("tax-amount")?.value) || 0,
    Shipping: parseFloat(document.getElementById("shipping")?.value) || 0,
    Total: parseFloat(document.getElementById("total")?.value) || 0,
    PaymentMethod: document.getElementById("payment-method")?.value.trim(),
    TaxDeductible: document.getElementById("tax-deductible")?.value || "No",
    Paid: document.getElementById("paid")?.value || "",
    Received: document.getElementById("received")?.value || "",
    "Invoice/PO": document.getElementById("invoice-po")?.value.trim(),
  };

  console.log("🧾 Saving expense:", data);

  const res = await fetch(SHEET_API, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify([data]),
  });

  const text = await res.text();
  const json = (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })();
  if (!res.ok || !json.success) throw new Error(json.error || res.statusText);

  console.log("✅ Expense saved:", json);
  showToast(json.message || "✅ Expense added successfully!");
  document.querySelector("form")?.reset();
}
  
// ===========================================================
// 🧹 CLEAR FORM — Expense Log Reset
// ===========================================================
function clearForm() {
  const fields = [
    "date",
    "category",
    "description",
    "vendor",
    "invoice-amount",
    "tax-amount",
    "shipping",
    "total",
    "payment-method",
    "paid",
    "received",
    "invoice-po",
    "tax-deductible"
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === "checkbox") el.checked = false;
      else el.value = "";
    }
  });

  // Reset EXP-ID tracker
  window.currentExpenseId = null;
  window.lastExpenseId = null;

  console.log("🧹 Expense form cleared.");
  showToast?.("🧹 Form cleared! Ready for new entry.");
}

clearBtn?.addEventListener("click", clearForm);


  // ===========================================================
  // 🪶 LOAD EXISTING EXPENSES
  // ===========================================================
  async function loadExpenses() {
    if (!tableBody) return;
    tableBody.innerHTML =
      `<tr><td colspan="14" style="text-align:center;opacity:0.6;">Loading...</td></tr>`;

    try {
      const res = await fetch(`${SHEET_API}?mode=expenses`);
      const json = await res.json();

      const data = json.data || json || [];
      if (!data.length) {
        tableBody.innerHTML =
          `<tr><td colspan="14" style="text-align:center;opacity:0.6;">No expenses found.</td></tr>`;
        return;
      }

      renderExpenses(data);
      setupSearchAndSort();
    } catch (err) {
      console.error("Error loading expenses:", err);
      tableBody.innerHTML =
        `<tr><td colspan="14" style="text-align:center;color:#ffbfbf;">Failed to load expense data.</td></tr>`;
    }
  }

  // ===========================================================
  // 🧾 RENDER TABLE
  // ===========================================================
  function renderExpenses(rows) {
  const normalized = rows.map((r) => ({
    id: r["ID"] || r["Expense ID"] || "",
    date: r["Date"] || "",
    category: r["Category"] || "",
    description: r["Description"] || "",
    vendor: r["Vendor"] || "",
    invoice: r["Invoice Amount"] || r["InvoiceAmount"] || "",
    tax: r["Tax"] || "",
    shipping: r["Shipping"] || "",
    total: r["Total"] || "",
    invoicePO: r["Invoice/PO #"] || r["Invoice/PO"] || "",
    taxDeductible: r["Tax Deductible"] || r["Tax Deductible (Y/N)"] || "",
    paid: r["Paid"] || r["Paid (Y/N)"] || "",
    payment: r["Payment Method"] || "",
    received: r["Received"] || r["Received (Y/N)"] || "",
  }));

  const sorted = normalized.sort((a, b) => new Date(b.date) - new Date(a.date));

  tableBody.innerHTML = sorted
    .map(
      (r) => `
        <tr class="expense-row" data-id="${r.id}">
          <td>${r.id}</td>
          <td>${r.date}</td>
          <td>${r.category}</td>
          <td>${r.description}</td>
          <td>${r.vendor}</td>
          <td>${r.invoice}</td>
          <td>${r.tax}</td>
          <td>${r.shipping}</td>
          <td>${r.total}</td>
          <td>${r.invoicePO}</td>
          <td>${r.taxDeductible}</td>
          <td>${r.paid}</td>
          <td>${r.payment}</td>
          <td>${r.received}</td>
        </tr>`
    )
    .join("");
}

  // ===========================================================
  // 🔍 SEARCH + SORT
  // ===========================================================
  function setupSearchAndSort() {
    const table = document.getElementById("expense-table");
    const searchInput = document.getElementById("expense-search");
    const clearBtn = document.getElementById("clear-search");

    if (!table) return;

    // ----- SORT -----
    const headers = table.querySelectorAll("th");
    headers.forEach((header, index) => {
      header.addEventListener("click", () => {
        const tbody = table.querySelector("tbody");
        const rows = Array.from(tbody.querySelectorAll("tr"));
        const ascending = !header.classList.contains("asc");

        headers.forEach((h) => h.classList.remove("asc", "desc"));
        header.classList.add(ascending ? "asc" : "desc");

        rows.sort((a, b) => {
          const A = a.children[index].innerText.trim().toLowerCase();
          const B = b.children[index].innerText.trim().toLowerCase();
          if (!isNaN(parseFloat(A)) && !isNaN(parseFloat(B)))
            return ascending ? A - B : B - A;
          return ascending ? A.localeCompare(B) : B.localeCompare(A);
        });

        tbody.innerHTML = "";
        rows.forEach((r) => tbody.appendChild(r));
      });
    });

    // ----- SEARCH -----
    searchInput?.addEventListener("input", () => {
      const term = searchInput.value.toLowerCase();
      table.querySelectorAll("tbody tr").forEach((row) => {
        row.style.display = row.innerText.toLowerCase().includes(term)
          ? ""
          : "none";
      });
    });

    // ----- CLEAR SEARCH -----
    clearBtn?.addEventListener("click", () => {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
    });
  }

  // ===========================================================
  // 🚀 INITIALIZE PAGE
  // ===========================================================
  loadExpenses();
});
