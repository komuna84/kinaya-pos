 // ===========================================================
// 🌿 KINAYA RISING — EXPENSE LOG CONTROLLER (2025)
// Unified with Inventory + POS ecosystem
// ===========================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🌿 Kinaya Expense Log initializing...");

  // ---------- CONFIG ----------
  const SHEET_API =
    "https://script.google.com/macros/s/AKfycbz83-usxoCG3YpHFACMTH9SA8CP2PLANhdFC92fbpm55qo3KSF30lb9ph3iOooQhQWX0A/exec"; // replace with your active endpoint

  const tableBody = document.querySelector("#expense-table tbody");
  const saveBtn = document.getElementById("save-expense-btn");
  const clearBtn = document.getElementById("clear-expense-btn");

  // ---------- FORM ELEMENTS ----------
  const dateEl = document.getElementById("date");
  const categoryEl = document.getElementById("category");
  const descEl = document.getElementById("description");
  const vendorEl = document.getElementById("vendor");
  const skuEl = document.getElementById("sku");
  const amountEl = document.getElementById("amount");
  const quantityEl = document.getElementById("quantity");
  const unitCostEl = document.getElementById("unit-cost");
  const totalEl = document.getElementById("total");
  const paymentEl = document.getElementById("payment");
  const taxEl = document.getElementById("tax");

  // ===========================================================
  // 🧮 AUTO-CALCULATE TOTAL
  // ===========================================================
  function recalcTotal() {
    const qty = parseFloat(quantityEl.value) || 0;
    const unit = parseFloat(unitCostEl.value) || 0;
    const total = qty * unit;
    totalEl.value = total.toFixed(2);
  }
  quantityEl.addEventListener("input", recalcTotal);
  unitCostEl.addEventListener("input", recalcTotal);

  // ===========================================================
  // 📤 SAVE EXPENSE ENTRY
  // ===========================================================
  saveBtn.addEventListener("click", async () => {
    const row = {
      Mode: "expenseEntry",
      Date: dateEl.value || new Date().toISOString().split("T")[0],
      Category: categoryEl.value.trim(),
      Description: descEl.value.trim(),
      Vendor: vendorEl.value.trim(),
      Sku: skuEl.value.trim(),
      Amount: parseFloat(amountEl.value) || 0,
      Quantity: parseFloat(quantityEl.value) || 0,
      UnitCost: parseFloat(unitCostEl.value) || 0,
      Total: parseFloat(totalEl.value) || 0,
      PaymentMethod: paymentEl.value.trim(),
      TaxDeductible: taxEl.value
    };

    if (!row.Category || !row.Description) {
      alert("⚠️ Please enter at least a category and description.");
      return;
    }

    try {
      const res = await fetch(SHEET_API, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([row])
      });

      const data = await res.json();
      if (data.success) {
        alert("✅ Expense saved successfully!");
        loadExpenses();
        clearForm();
      } else {
        alert("❌ Save failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Save failed", err);
      alert("❌ Network or CORS error saving expense.");
    }
  });

  // ===========================================================
  // 🧹 CLEAR FORM
  // ===========================================================
  clearBtn.addEventListener("click", () => {
    clearForm();
  });

  function clearForm() {
    [
      dateEl,
      categoryEl,
      descEl,
      vendorEl,
      skuEl,
      amountEl,
      quantityEl,
      unitCostEl,
      totalEl,
      paymentEl
    ].forEach(el => (el.value = ""));
    taxEl.value = "Y";
  }

  // ===========================================================
  // 📥 LOAD EXISTING EXPENSES
  // ===========================================================
  async function loadExpenses() {
    tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;opacity:0.6;">Loading...</td></tr>`;

    try {
      const res = await fetch(`${SHEET_API}?mode=expenses`, { method: "GET" });
      const data = await res.json();

      if (!data || !data.length) {
        tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;opacity:0.6;">No expenses found.</td></tr>`;
        return;
      }

      renderExpenses(data);
    } catch (err) {
      console.error("Error loading expenses:", err);
      tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:#ffbfbf;">Failed to load expense data.</td></tr>`;
    }
  }

  function renderExpenses(rows) {
    tableBody.innerHTML = rows
      .map(
        r => `
        <tr>
          <td>${r["Date"] || ""}</td>
          <td>${r["Category"] || ""}</td>
          <td>${r["Description"] || ""}</td>
          <td>${r["Vendor"] || ""}</td>
          <td>${r["Sku"] || ""}</td>
          <td>${r["Amount"] || ""}</td>
          <td>${r["Quantity"] || ""}</td>
          <td>${r["UnitCost"] || ""}</td>
          <td>${r["Total"] || ""}</td>
          <td>${r["PaymentMethod"] || ""}</td>
          <td>${r["TaxDeductible"] || ""}</td>
        </tr>`
      )
      .join("");
  }

  // ===========================================================
  // 🚀 INIT
  // ===========================================================
  loadExpenses();
});
