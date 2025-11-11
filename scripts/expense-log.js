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
    "https://script.google.com/macros/s/AKfycbwgWEV43YURmnstV5g-qCjc4VF6tSgzH7lhcspjSaF-gcqczvJY8dIKcP025-yREPZE6Q/exec"; // 🔹 Replace if redeployed

  const tableBody = document.querySelector("#expense-table tbody");
  const saveBtn = document.getElementById("save-expense-btn");
  const clearBtn = document.getElementById("clear-expense-btn");

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
// 💾 SAVE EXPENSE — AUTO ID + CORS SAFE + RESET
// ===========================================================
async function getNextExpenseId() {
  const SHEET_API =
    "https://script.google.com/macros/s/AKfycbwgWEV43YURmnstV5g-qCjc4VF6tSgzH7lhcspjSaF-gcqczvJY8dIKcP025-yREPZE6Q/exec"; // 🔹 Replace if redeployed

  try {
    const res = await fetch(`${SHEET_API}?mode=expenses`);
    const json = await res.json();
    const rows = json.data || [];
    if (!rows.length) return "EXP-001";

    const last = rows[rows.length - 1];
    const lastNum = String(last["ID"] || "").replace(/[^\d]/g, "");
    const nextNum = (parseInt(lastNum, 10) || 0) + 1;
    return `EXP-${String(nextNum).padStart(3, "0")}`;
  } catch (err) {
    console.error("❌ Failed to get next expense ID:", err);
    return "EXP-001";
  }
}

async function saveExpense() {
  const SHEET_API =
    "https://script.google.com/macros/s/AKfycbwgWEV43YURmnstV5g-qCjc4VF6tSgzH7lhcspjSaF-gcqczvJY8dIKcP025-yREPZE6Q/exec"; // 🔹 Replace if redeployed

  try {
    // 🔹 1. Generate the next Expense ID
    const nextExpenseId = await getNextExpenseId();

    // 🔹 2. Build payload (must match sheet headers exactly)
    const data = {
      Mode: "expenseEntry",
      ID: nextExpenseId,
      Date: document.getElementById("date")?.value || new Date().toLocaleDateString("en-CA"),
      Category: document.getElementById("category")?.value.trim(),
      Description: document.getElementById("description")?.value.trim(),
      Vendor: document.getElementById("vendor")?.value.trim(),
      "Invoice Amount": parseFloat(document.getElementById("invoice-amount")?.value) || 0,
      Shipping: parseFloat(document.getElementById("shipping")?.value) || 0,
      Tax: parseFloat(document.getElementById("tax-amount")?.value) || 0,
      Total: parseFloat(document.getElementById("total")?.value) || 0,
      "Payment Method": document.getElementById("payment-method")?.value.trim(),
      "Paid (Y/N)": document.getElementById("paid")?.value || "No",
      "Received (Y/N)": document.getElementById("received")?.value || "No",
      "Invoice/PO #": document.getElementById("invoice-po")?.value.trim(),
      "Tax Deductible (Y/N)": document.getElementById("tax-deductible")?.value || "No",
    };

    console.table(data);

    // 🔹 3. POST to Sheet
    const res = await fetch(SHEET_API, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify([data]),
    });

    const text = await res.text();
    const json = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    })();

    if (!res.ok || !json.success)
      throw new Error(json.error || res.statusText);

    console.log("✅ Expense saved:", json);
    showToast(`✅ ${nextExpenseId} added successfully!`);

    // 🔹 Automatically clear the form after a successful submit
    clearForm();

    // 🔹 Refresh expense table
    loadExpenses();

  } catch (err) {
    console.error("❌ Save failed:", err);
    showToast("❌ Failed to save expense. Check console for details.");
  }
}

// ===========================================================
// 🖱️ SAVE BUTTON HANDLER
// ===========================================================
saveBtn?.addEventListener("click", async () => {
  await saveExpense();
});

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
      if (el.tagName === "SELECT") el.selectedIndex = 0;
    }
  });

  // Reset EXP-ID tracker
  window.currentExpenseId = null;
  window.lastExpenseId = null;

  console.log("🧹 Expense form cleared.");
  showToast?.("🧹 Form cleared! Ready for new entry.");

  // Optional: auto-focus first field after clear
  document.getElementById("date")?.focus();
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

  // 🔹 Sort by numeric part of ID (EXP-001 → EXP-002 → EXP-003)
const sorted = normalized.sort((a, b) => {
  const numA = parseInt(String(a.id || "").replace(/[^\d]/g, ""), 10) || 0;
  const numB = parseInt(String(b.id || "").replace(/[^\d]/g, ""), 10) || 0;
  return numA - numB; // ascending
});


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
// ✨ TOAST MESSAGE HELPER
// ===========================================================
function showToast(message) {
  const toast = document.createElement("div");
  toast.innerText = message;
  toast.style.position = "fixed";
  toast.style.bottom = "30px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "rgba(0, 198, 255, 0.15)";
  toast.style.border = "1px solid rgba(0, 198, 255, 0.5)";
  toast.style.color = "#A7E1EE";
  toast.style.padding = "10px 16px";
  toast.style.borderRadius = "10px";
  toast.style.zIndex = "9999";
  toast.style.fontFamily = "Roboto, sans-serif";
  toast.style.backdropFilter = "blur(8px)";
  toast.style.boxShadow = "0 0 10px rgba(0,198,255,0.3)";
  toast.style.transition = "opacity 0.3s ease";
  document.body.appendChild(toast);

  setTimeout(() => (toast.style.opacity = "0"), 2500);
  setTimeout(() => toast.remove(), 3000);
}

// ===========================================================
// 🗓️ DATE FORMATTER — Clean ISO → YYYY-MM-DD
// ===========================================================
function formatDate(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (isNaN(d)) return value; // fallback if it's already plain text
    return d.toISOString().split("T")[0]; // "2025-11-09"
  } catch {
    return value;
  }
}


  // ===========================================================
  // 🚀 INITIALIZE PAGE
  // ===========================================================
  loadExpenses();
});
