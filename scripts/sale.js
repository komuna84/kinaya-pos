// ===========================================================
// 🌿 KINAYA RISING POS — FINAL UNIFIED LOGIC (2025)
// ===========================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🌿 Kinaya POS initializing...");

  // ---------- CONFIG ----------
  const SHEET_API =
    "https://script.google.com/macros/s/AKfycbw56BFnWW5CqsHsqwE9gmZE5SLu-Z-WJLaSgx8RHb4aYFC3B7jo-GogBWkVUKyH_eo9sg/exec"; // 🔹 Replace if redeployed

  // ---------- CORE ELEMENTS ----------
  const menu = document.getElementById("menu");
  const banner = document.getElementById("return-mode-banner");
  const toggleReturnMain = document.getElementById("toggle-return-main");
  const paypadOverlay = document.getElementById("payment-overlay");
  const paypadDisplay = document.getElementById("paypad-display");
  const paypadButtons = document.querySelectorAll(".paypad-btn");
  const confirmPaymentBtn = document.getElementById("confirm-payment-btn");
  const cashBtn = document.getElementById("cash-btn");
  const cardBtn = document.getElementById("card-btn");
  const closePaypadBtn = document.getElementById("close-paypad-btn");
  const emailInput = document.getElementById("customer-email");
  const emailToggle = document.getElementById("email-toggle");
  const submitBtn = document.getElementById("submit-sale");

  // ---------- STATE ----------
  let returnMode = false;
  let paypadValue = "";
  let currentPaymentType = "";
  let paymentRecord = { cash: 0, card: 0 };

// ===========================================================
// 🔢 INVOICE NUMBER
// ===========================================================
async function updateInvoiceNumber() {
  try {
    const invoiceNumEl = document.getElementById("invoice-number");
    const res = await fetch(`${SHEET_API}?mode=nextInvoice`, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (invoiceNumEl && data?.nextInvoice) {
      invoiceNumEl.textContent = `Invoice #${data.nextInvoice}`;
    }
  } catch (err) {
    console.error("❌ Could not fetch invoice number:", err);
  }
} // 👈 this final brace must exist


// ===========================================================
// 🔎 INVOICE SEARCH (Loads Previous Sale + Updates Summary)
// ===========================================================
document.getElementById("invoice-search-btn")?.addEventListener("click", async () => {
  const id = document.getElementById("invoice-search-input").value.trim();
  const resultDiv = document.getElementById("invoice-result");
  const tableBody = document.getElementById("receipt-details");

  if (!id) return alert("Enter an invoice number.");

  try {
    const res = await fetch(`${SHEET_API}?mode=invoice&id=${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data || data.length === 0) {
      resultDiv.innerHTML = `<p style="color:red;">❌ No record found for Invoice #${id}</p>`;
      return;
    }

    // ✅ Build receipt rows
    tableBody.innerHTML = data.map(r => `
      <tr data-sku="${r.Sku || ""}">
        <td>${r["Product Title"] || "Unknown"}</td>
        <td class="qty">${r.Quantity || 0}</td>
        <td>$${parseFloat(r.Price || 0).toFixed(2)}</td>
        <td class="subtotal">$${parseFloat(r.Subtotal || 0).toFixed(2)}</td>
        <td><button class="del-btn"><i class="fas fa-trash"></i></button></td>
      </tr>
    `).join("");

    // ✅ Calculate and update summary
    const subtotal = data.reduce((sum, r) => sum + (parseFloat(r.Subtotal) || 0), 0);
    const tax = data.reduce((sum, r) => sum + (parseFloat(r.Tax) || 0), 0);
    const total = data.reduce((sum, r) => sum + (parseFloat(r.Total) || 0), 0);
    const paid = data[0].Paid || total;
    const change = Math.max((parseFloat(paid) || 0) - total, 0);
    const payment = data[0].Payment || "N/A";
    const email = data[0].Email || "";

    document.getElementById("subtotal-summary").textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById("tax-summary").textContent = `$${tax.toFixed(2)}`;
    document.getElementById("grandtotal-summary").textContent = `$${total.toFixed(2)}`;
    document.getElementById("amount-paid-display").textContent = `$${parseFloat(paid).toFixed(2)}`;
    document.getElementById("change-amount").textContent = `$${change.toFixed(2)}`;
    document.getElementById("split-info").textContent = payment;
    document.getElementById("customer-email").value = email;

    // 🟩 NEW — Store original paid for Return Summary calculations
    const amountPaidEl = document.getElementById("amount-paid-display");
    if (amountPaidEl) {
      amountPaidEl.dataset.originalPaid = paid;
      console.log(`💾 Stored original paid amount = ${paid} for Invoice #${id}`);
    }

    // ✅ Display success message
    resultDiv.innerHTML = `<p style="color:lightgreen;">✅ Invoice #${id} loaded successfully.</p>`;

    // 🔹 Save invoice number for Return Mode validation
    const originalInvoiceInput = document.getElementById("original-invoice");
    if (originalInvoiceInput) {
      originalInvoiceInput.value = id;
      console.log(`💾 Stored original invoice for Return Mode: ${id}`);
    }

    // ✅ Automatically enable Return Mode after invoice load
    if (typeof setReturnMode === "function") {
      setReturnMode(true);
      console.log("🔁 Auto-enabled Return Mode after invoice load.");
    }

    // 🟩 NEW — Trigger Return Summary Update
    if (typeof updateReturnSummary === "function") updateReturnSummary();

    // 🟩 NEW — Also refresh totals so refund value recalculates cleanly
    if (typeof updateTotals === "function") updateTotals();

    applyDiscount();
    toggleSubmitButton();

    const conditionSelect = document.getElementById("return-condition");
    if (conditionSelect) conditionSelect.focus();

  } catch (err) {
    console.error("❌ Invoice lookup failed:", err);
    resultDiv.innerHTML = `<p style="color:red;">⚠️ Error fetching invoice details. Check console.</p>`;
  }
});




  // ===========================================================
  // 🔁 LOAD PRODUCT CATALOG (from POS Sheet)
  // ===========================================================
  async function loadProductCatalog() {
    try {
      const res = await fetch(`${SHEET_API}?mode=pos`);
      if (!res.ok) throw new Error(`Network error: ${res.status}`);
      const data = await res.json();
      renderProducts(data);
      console.log(`✅ Loaded ${data.length} products from sheet.`);
    } catch (err) {
      console.error("❌ Could not load POS data:", err);
      renderProducts(fallbackProducts);
    }
  }

// ===========================================================
// 🛍️ RENDER PRODUCTS — Reads Sale Price + Retail Price
// ===========================================================
function renderProducts(products) {
  if (!menu) return;

  const normalized = products.map((p) => {
    const sale = parseFloat(
      (p["Sale Price"] || "").toString().replace(/[^0-9.]/g, "")
    ) || 0;
    const retail = parseFloat(
      (p["Retail Price"] || "").toString().replace(/[^0-9.]/g, "")
    ) || 0;
    const final = sale > 0 ? sale : retail;

    return {
      sku: p.Sku || p.sku || "",
      name: p["Product Title"] || p.name || "Unnamed Product",
      salePrice: sale,
      retailPrice: retail,
      price: final,
      image:
        p["Image Link"] ||
        p.Image ||
        "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/default.png",
    };
  });

  // 🔹 Build catalog grid
  menu.innerHTML = normalized
    .map(
      (p) => `
        <figure
          class="menu-item"
          data-sku="${p.sku}"
          data-name="${p.name}"
          data-price="${p.price}"
          data-sale="${p.salePrice}"
          data-retail="${p.retailPrice}"
        >
          <img src="${p.image}" alt="${p.name}" />
          <figcaption>${p.name}</figcaption>
          <figcaption style="font-size:0.8em; color:#66caff;">${p.sku}</figcaption>
          <figcaption>
            ${
              p.salePrice > 0
                ? `<span style="color:#bffcff;">$${p.salePrice.toFixed(2)}</span>
                   <span style="text-decoration:line-through; color:#888; margin-left:4px;">$${p.retailPrice.toFixed(2)}</span>`
                : `<span>$${p.retailPrice.toFixed(2)}</span>`
            }
          </figcaption>
        </figure>`
    )
    .join("");

  // 🔹 Attach product click handler
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => {
      const name = item.dataset.name;
      const sku = item.dataset.sku;
      const retail = parseFloat(item.dataset.retail || 0);
      const sale = parseFloat(item.dataset.sale || 0);
      const finalPrice = sale > 0 ? sale : retail;
      const qtyChange = window.returnMode ? -1 : 1;
      updateReceipt({ name, sku, price: finalPrice, qtyChange });
    });
  });
}  // ✅ closes renderProducts()



  // ===========================================================
  // 🌱 FALLBACK PRODUCTS (Offline Backup)
  // ===========================================================
  const fallbackProducts = [
    { name: "Book — AoL Part 1", sku: "B0F8NFSWXW", price: 14.98, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/B0F8NFSWXW.png" },
    { name: "Bookmarks", sku: "BKM-001", price: 2.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/BKM-001.png" },
    { name: "Buttons (individual)", sku: "Button-001", price: 5.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/Button-001.png" },
    { name: "Buttons (5 pack)", sku: "Button-001-5pk", price: 15.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/Button-001-5pk.png" },
    { name: "Coaster", sku: "Cos-001", price: 10.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/Cos-001.png" },
    { name: "Journal", sku: "Jou-001", price: 14.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/Jou-001.png" },
    { name: "Tote Bag", sku: "TBA-001", price: 20.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/TBA-001.png" },
  ];

 // ===========================================================
// 🌿 TOGGLE RETURN MODE — Unified Logic
// ===========================================================
function setReturnMode(state) {
  const banner = document.getElementById("return-mode-banner");
  const returnConditionRow = document.getElementById("return-condition-row");
  const differenceRow = document.getElementById("difference-row");
  const changeRow = document.getElementById("change-row");

  // 🔹 Update global variable + persist
  window.returnMode = state;
  sessionStorage.setItem("returnMode", state ? "true" : "false");

  // 🔹 Banner visibility
  if (banner) {
    banner.classList.toggle("active", state);
    banner.textContent = state ? "🔁 RETURN MODE ACTIVE" : "";
  }

  // 🔹 Visual cue (body class)
  document.body.classList.toggle("return-active", state);

  // 🔹 Toggle dropdown + difference + change
  if (returnConditionRow) returnConditionRow.classList.toggle("hidden", !state);
  if (differenceRow) differenceRow.classList.toggle("hidden", !state);
  if (changeRow) changeRow.classList.toggle("hidden", !!state);

  console.log(`↩️ Return mode ${state ? "ENABLED" : "DISABLED"}`);
}

// ===========================================================
// 🔘 RETURN MODE BUTTON HANDLER
// ===========================================================
toggleReturnMain?.addEventListener("click", () => {
  const originalInvoiceInput = document.getElementById("original-invoice");
  const hasInvoice = originalInvoiceInput && originalInvoiceInput.value.trim() !== "";

  if (!hasInvoice) {
    alert("🔎 Please load an original invoice before enabling Return Mode.");
    return;
  }

  // Flip Return Mode ON/OFF cleanly
  const newState = !window.returnMode;
  setReturnMode(newState);
});


  // ===========================================================
  // 🧾 RECEIPT HANDLER
  // ===========================================================
  function updateReceipt(product) {
  const tableBody = document.getElementById("receipt-details");
  if (!tableBody) return;

  // Always find existing (non-return) line
  const existing = Array.from(tableBody.children).find(
    (row) => row.dataset.sku === product.sku && !row.classList.contains("return-line")
  );

  // Normal sale behavior (add or increment)
  if (!window.returnMode) {
    if (existing) {
      const qtyCell = existing.querySelector(".qty");
      const subCell = existing.querySelector(".subtotal");
      const qty = parseInt(qtyCell.textContent) + 1;
      qtyCell.textContent = qty;
      subCell.textContent = `$${(qty * product.price).toFixed(2)}`;
    } else {
      const newRow = document.createElement("tr");
      newRow.dataset.sku = product.sku;
      newRow.innerHTML = `
        <td>${product.name}</td>
        <td class="qty">1</td>
        <td>$${product.price.toFixed(2)}</td>
        <td class="subtotal">$${product.price.toFixed(2)}</td>
        <td><button class="del-btn"><i class="fas fa-trash"></i></button></td>
      `;
      tableBody.appendChild(newRow);
    }
  }

  // 🔁 Return mode — always append a separate red negative line
  else {
    const newRow = document.createElement("tr");
    newRow.dataset.sku = product.sku;
    newRow.classList.add("return-line");
    const negPrice = -Math.abs(product.price);

    newRow.innerHTML = `
      <td style="color:#ff5252;">${product.name}</td>
      <td class="qty" style="color:#ff5252;">-1</td>
      <td style="color:#ff5252;">$${product.price.toFixed(2)}</td>
      <td class="subtotal" style="color:#ff5252;">$${negPrice.toFixed(2)}</td>
      <td><button class="del-btn"><i class="fas fa-trash"></i></button></td>
    `;

    tableBody.appendChild(newRow);
  }

  // ✅ Always recalc after add
  updateTotals();
  applyDiscount();
  toggleSubmitButton();
}

// ===========================================================
// 🎁 DISCOUNT CALCULATION — Applies % Off to Subtotal
// ===========================================================
function applyDiscount() {
  const discountInput = document.getElementById("discount-input");
  const discountDisplay = document.getElementById("discount-display");
  const subtotalEl = document.getElementById("subtotal-summary");
  const taxEl = document.getElementById("tax-summary");
  const grandEl = document.getElementById("grandtotal-summary");

  const discountPercent = parseFloat(discountInput?.value || 0);
  const baseSubtotal = parseFloat(
    subtotalEl.textContent.replace(/[^0-9.-]/g, "")
  ) || 0;

  // 🧮 Apply % discount to subtotal
  const discountAmount = baseSubtotal * (discountPercent / 100);
  const newSubtotal = baseSubtotal - discountAmount;

  // Recalculate tax (tax-after-discount model)
  const newTax = newSubtotal * 0.07;
  const grandTotal = newSubtotal + newTax;

  // 🧾 Update UI
  if (discountDisplay)
    discountDisplay.textContent = `–$${discountAmount.toFixed(2)}`;
  subtotalEl.textContent = `$${newSubtotal.toFixed(2)}`;
  taxEl.textContent = `$${newTax.toFixed(2)}`;
  grandEl.textContent = `$${grandTotal.toFixed(2)}`;

  console.log(
    `🎁 Discount ${discountPercent}% → –$${discountAmount.toFixed(
      2
    )}, new subtotal $${newSubtotal.toFixed(2)}`
  );
}

 // ===========================================================
// 🗑 DELETE ITEM (decrement or remove row)
// ===========================================================
document.addEventListener("click", (e) => {
  if (e.target.closest(".del-btn")) {
    const row = e.target.closest("tr");
    const qtyCell = row.querySelector(".qty");
    const subCell = row.querySelector(".subtotal");
    const priceCell = row.children[2]; // the Price column

    let qty = parseInt(qtyCell.textContent, 10);
    const price = parseFloat(priceCell.textContent.replace(/[^0-9.-]/g, "")) || 0;

    // Decrease quantity
    qty -= 1;

    if (qty > 0) {
      qtyCell.textContent = qty;
      subCell.textContent = `$${(qty * price).toFixed(2)}`;
    } else {
      // Remove the row completely
      row.remove();
    }

    // Recalculate totals
    updateTotals();
    applyDiscount();
    toggleSubmitButton();

    // Hide submit button if no items left
    const hasItems = document.querySelectorAll("#receipt-details tr").length > 0;
    document.getElementById("submit-row").classList.toggle("hidden", !hasItems);
  }
});

// ===========================================================
// 💸 TOTAL CALCULATION — Mixed Sales + Returns + Difference Field
// ===========================================================
function updateTotals() {
  const tableBody = document.getElementById("receipt-details");
  if (!tableBody) return;

  // 1️⃣ Calculate subtotal
  let subtotal = 0;
  tableBody.querySelectorAll("tr").forEach((row) => {
    const sub = parseFloat(
      row.querySelector(".subtotal")?.textContent.replace(/[^0-9.-]/g, "") || 0
    );
    subtotal += sub;
  });

  // 2️⃣ Apply discount
  const discountPercent = parseFloat(document.getElementById("discount-input")?.value || 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const discountedSubtotal = subtotal - discountAmount;

  // 3️⃣ Calculate tax
  const taxableSubtotal = discountedSubtotal; // ✅ allow negative subtotal for returns
  const tax = taxableSubtotal * 0.07;

  // 4️⃣ Add the “Difference ($)” field
  const extraChargeEl = document.getElementById("extra-charge");
  const difference = parseFloat(extraChargeEl?.value || 0);
  const adjustedTotal = discountedSubtotal + tax + difference;

  // 5️⃣ Update display
  const subtotalEl = document.getElementById("subtotal-summary");
  const taxEl = document.getElementById("tax-summary");
  const grandEl = document.getElementById("grandtotal-summary");

  if (subtotalEl) subtotalEl.textContent = `$${discountedSubtotal.toFixed(2)}`;
  if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;

  // ✅ Refund display logic (in red if negative during Return Mode)
  if (window.returnMode && adjustedTotal < 0) {
    grandEl.style.color = "#ff5252";
    grandEl.textContent = `Refund Due: $${Math.abs(adjustedTotal).toFixed(2)}`;
  } else {
    grandEl.style.color = "";
    grandEl.textContent = `$${adjustedTotal.toFixed(2)}`;
  }

  // 6️⃣ Calculate payment + change
  const totalPaid = (window.cashMemory + window.cardMemory) || 0;
  const change = Math.max(totalPaid - adjustedTotal, 0);
  document.getElementById("amount-paid-display").textContent = `$${totalPaid.toFixed(2)}`;
  document.getElementById("change-amount").textContent = `$${change.toFixed(2)}`;

  // ===========================================================
  // 🔁 RETURN SUMMARY AUTO-CALCULATOR
  // ===========================================================
  if (window.returnMode) {
    const originalPaidEl = document.getElementById("original-paid");
    const returnValueEl = document.getElementById("return-value");
    const newTotalEl = document.getElementById("new-total");
    const diffAmountEl = document.getElementById("difference-amount");
    const diffNoteEl = document.getElementById("difference-note");

    const originalInvoiceInput = document.getElementById("original-invoice");
    const id = originalInvoiceInput?.value?.trim() || "";

    // Current refund value (sum of negatives)
    let returnValue = 0;
    tableBody.querySelectorAll(".return-line .subtotal").forEach((cell) => {
      returnValue += parseFloat(cell.textContent.replace(/[^0-9.-]/g, "")) || 0;
    });

    // Grand total (could include multiple returns)
    const grandText = grandEl?.textContent.replace(/[^0-9.-]/g, "");
    const currentTotal = parseFloat(grandText || "0");

    // Simulated original paid from invoice lookup
    const originalPaidText =
      document.getElementById("amount-paid-display")?.dataset?.originalPaid ||
      document.getElementById("amount-paid-display")?.textContent ||
      "$0.00";
    const originalPaid = parseFloat(originalPaidText.replace(/[^0-9.-]/g, "")) || 0;

    const newBalance = originalPaid + currentTotal; // total after refund
    const difference = newBalance - originalPaid;

    if (originalPaidEl) originalPaidEl.textContent = `$${originalPaid.toFixed(2)}`;
    if (returnValueEl) returnValueEl.textContent = `$${Math.abs(returnValue).toFixed(2)}`;
    if (newTotalEl) newTotalEl.textContent = `$${newBalance.toFixed(2)}`;
    if (diffAmountEl) diffAmountEl.textContent = `$${Math.abs(difference).toFixed(2)}`;
    if (diffNoteEl)
      diffNoteEl.textContent =
        difference < 0
          ? "Refund Due"
          : difference > 0
          ? "Balance Owed"
          : "";

    console.log(
      `🔁 Return Summary Updated | Paid:${originalPaid} Return:${returnValue} New:${newBalance}`
    );
  }
}


// ===========================================================
// 💰 PAYMENT OVERLAY (Cash / Card Independent Memory + Dynamic Owed)
// ===========================================================
(() => {
  const overlay = document.getElementById("payment-overlay");
  const paypadDisplay = document.getElementById("paypad-display");
  const owedDisplay = document.getElementById("paypad-owed");
  const closeBtn = document.getElementById("close-paypad-btn");
  const confirmBtn = document.getElementById("confirm-payment-btn");
  const paypadButtons = document.querySelectorAll(".paypad-btn");
  const amountPaidDisplay = document.getElementById("amount-paid-display");
  const cashBtn = document.getElementById("cash-btn");
  const cardBtn = document.getElementById("card-btn");
  const splitInfo = document.getElementById("split-info");

  // --- memory for each type (GLOBAL) ---
  let currentPaymentType = null;
  window.cashMemory = 0;
  window.cardMemory = 0;
  let tempAmount = "0";

  // ---------- OPEN ----------
  function openPaypad(type) {
    currentPaymentType = type;
    overlay.classList.add("active");
    document.querySelector(".paypad-title").textContent =
      type === "cash" ? "Enter Cash Amount" : "Enter Card Amount";

    // Calculate remaining owed
    const grandText = document.getElementById("grandtotal-summary")?.textContent || "$0.00";
    const grand = parseFloat(grandText.replace(/[^0-9.]/g, "")) || 0;
    const paidSoFar = (window.cashMemory || 0) + (window.cardMemory || 0);
    const remaining = Math.max(grand - paidSoFar, 0);
    owedDisplay.textContent = `$${remaining.toFixed(2)}`;

    tempAmount = "0";
    updatePaypadDisplay();
  }

  // ---------- CLOSE ----------
  function closePaypad(save = false) {
    overlay.classList.remove("active");

    // Save current entry to global memory
    if (save) {
      const val = parseFloat(tempAmount || "0") || 0;
      if (currentPaymentType === "cash") {
        window.cashMemory += val;
      } else if (currentPaymentType === "card") {
        window.cardMemory += val;
      }
    }

    // Recalculate totals and update UI
    updateTotals();
    updatePaymentSummary();
    applyDiscount();
    toggleSubmitButton();

    tempAmount = "0";
    updatePaypadDisplay();
  }

  // ---------- DISPLAY UPDATERS ----------
  function updatePaypadDisplay() {
    paypadDisplay.textContent = `$${parseFloat(tempAmount || "0").toFixed(2)}`;
  }

  function updatePaymentSummary() {
    const totalPaid = (window.cashMemory + window.cardMemory) || 0;
    const split =
      window.cashMemory > 0 && window.cardMemory > 0
        ? "Split (Cash + Card)"
        : window.cashMemory > 0
        ? "Cash"
        : window.cardMemory > 0
        ? "Card"
        : "None";

    amountPaidDisplay.textContent = `$${totalPaid.toFixed(2)}`;
    document.getElementById("split-info").textContent = split;

    const grandText = document.getElementById("grandtotal-summary")?.textContent || "$0.00";
    const grand = parseFloat(grandText.replace(/[^0-9.]/g, "")) || 0;
    const change = Math.max(totalPaid - grand, 0);
    document.getElementById("change-amount").textContent = `$${change.toFixed(2)}`;
  }

  // ---------- BUTTON LOGIC ----------
  paypadButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.value;
      if (!val) return;

      if (val === "C" || val === "clear") tempAmount = "0";
      else if (val === "←" || val === "back") {
        tempAmount = tempAmount.slice(0, -1) || "0";
      } else {
        tempAmount = tempAmount === "0" ? val : tempAmount + val;
      }
      updatePaypadDisplay();
    });
  });

  // ---------- CONFIRM / CLOSE ----------
  confirmBtn?.addEventListener("click", () => closePaypad(true));
  closeBtn?.addEventListener("click", () => closePaypad(false));

  // ---------- OPEN TRIGGERS ----------
  cashBtn?.addEventListener("click", () => openPaypad("cash"));
  cardBtn?.addEventListener("click", () => openPaypad("card"));
})();

/// 🔁 Always recheck submit visibility when data changes
document.addEventListener("input", toggleSubmitButton);
document.addEventListener("click", toggleSubmitButton);

// 🔁 Recalculate totals when discount or difference fields change
document.getElementById("discount-input")?.addEventListener("input", () => {
  updateTotals();
  applyDiscount();
});

document.getElementById("extra-charge")?.addEventListener("input", updateTotals);

// ===========================================================
// 🧹 FULL RESET (Safe After Invoice Lookup)
// ===========================================================
function resetOrder(full = true) {
  console.log("🧹 Performing full POS reset...");

  // 🧾 Clear receipt table
  const tableBody = document.getElementById("receipt-details");
  if (tableBody) tableBody.innerHTML = "";

  // 💸 Reset payment memory
  window.cashMemory = 0;
  window.cardMemory = 0;

  // 💬 Reset text displays
  const resetText = (id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "$0.00";
  };

  [
    "subtotal-summary",
    "tax-summary",
    "grandtotal-summary",
    "amount-paid-display",
    "change-amount",
  ].forEach(resetText);

  // 🧮 Reset split info and condition
  const splitInfo = document.getElementById("split-info");
  if (splitInfo) splitInfo.textContent = "None";

  const returnCondition = document.getElementById("return-condition");
  if (returnCondition) returnCondition.value = "";

  // 💬 Reset email and toggle
  const emailInput = document.getElementById("customer-email");
  const emailToggle = document.getElementById("email-toggle");
  if (emailInput) emailInput.value = "";
  if (emailToggle) emailToggle.checked = true;

  // 💸 Reset discount & difference fields
  const discountInput = document.getElementById("discount-input");
  const extraCharge = document.getElementById("extra-charge");
  if (discountInput) discountInput.value = "";
  if (extraCharge) extraCharge.value = "";

  // 💬 Hide submit button and return-specific rows
  const submitRow = document.getElementById("submit-row");
  if (submitRow) submitRow.classList.add("hidden");

  const returnConditionRow = document.getElementById("return-condition-row");
  if (returnConditionRow) returnConditionRow.classList.add("hidden");

  // 🔍 NEW — Clear invoice search + original invoice
  const invoiceSearchInput = document.getElementById("invoice-search-input");
  const invoiceResult = document.getElementById("invoice-result");
  const invoiceNumber = document.getElementById("invoice-number");
  const originalInvoiceInput = document.getElementById("original-invoice");

  if (invoiceSearchInput) invoiceSearchInput.value = "";
  if (invoiceResult) invoiceResult.innerHTML = "";
  if (invoiceNumber) invoiceNumber.textContent = "Invoice #Loading...";
  if (originalInvoiceInput) originalInvoiceInput.value = "";

  // 🔁 Disable Return Mode
  if (typeof setReturnMode === "function") setReturnMode(false);

  // 🎫 Refresh invoice number for next order
  if (typeof updateInvoiceNumber === "function") updateInvoiceNumber();

  // 🧾 Recalculate clean totals
  if (typeof updateTotals === "function") updateTotals();

  console.log("✅ POS reset complete — ready for next order.");

  // 🔁 Optional — focus back on search for fast workflow
  setTimeout(() => {
    const input = document.getElementById("invoice-search-input");
    if (input) input.focus();
  }, 200);
}


// ===========================================================
// 📧 EMAIL FIELD + TOGGLE LOGIC
// ===========================================================
(() => {
  const emailInput = document.getElementById("customer-email");
  const emailToggle = document.getElementById("email-toggle");
  

  if (!emailInput || !emailToggle) return;

  // Watch input typing
  emailInput.addEventListener("input", () => {
    const val = emailInput.value.trim();

    // Simple pattern for validation
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

    if (val === "") {
      // Empty → reset to checked (share = Yes)
      emailToggle.checked = true;
    } else if (!valid) {
      // Invalid email → uncheck
      emailToggle.checked = false;
    } else {
      // Valid email → keep checked (share = Yes)
      emailToggle.checked = true;
    }
  });

  // Manual toggle click behavior
  emailToggle.addEventListener("change", () => {
    console.log(
      `📧 Email share is now: ${emailToggle.checked ? "YES" : "NO"}`
    );
  });
})();



// ===========================================================
// 🔘 RESTORE SUBMIT BUTTON LOGIC (Full Conditioned Visibility)
// ===========================================================
function toggleSubmitButton() {
  const tableBody = document.getElementById("receipt-details");
  const submitRow = document.getElementById("submit-row");
  const emailInput = document.getElementById("customer-email");

  const cash = window.cashMemory || 0;
  const card = window.cardMemory || 0;

  if (!tableBody || !submitRow) return;

  // ✅ Conditions for showing the button
  const hasItems = tableBody.querySelectorAll("tr").length > 0;
  const hasPayment = (cash + card) > 0;
  const email = (emailInput?.value || "").trim();
  const validEmail = email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // 🔘 Show only when all required info is ready
  const readyToSubmit = hasItems && hasPayment && validEmail;
  submitRow.classList.toggle("hidden", !readyToSubmit);

  console.log(`🧾 Submit button ${readyToSubmit ? "visible" : "hidden"} (items=${hasItems}, payment=${hasPayment}, email=${validEmail})`);
}

// ===========================================================
// 🧾 SUBMIT SALE — POST TO BACKEND (no-preflight CORS)
// ===========================================================
async function submitSale() {
  try {
    const emailEl = document.getElementById("customer-email");
    const discountInput = document.getElementById("discount-input");
    const originalInvoiceInput = document.getElementById("original-invoice");
    const returnCondition = document.getElementById("return-condition")?.value || ""; // ✅ FIXED LINE

    const discountPercent = parseFloat(discountInput?.value || 0);
    const originalInvoice = (originalInvoiceInput?.value || "").trim();
    const emailToggle = document.getElementById("email-toggle");
    const tableBody = document.getElementById("receipt-details");

    const email = (emailEl?.value || "").trim();
    const share = emailToggle?.checked ? "Yes" : "No";
    const cashPaid = window.cashMemory || 0;
    const cardPaid = window.cardMemory || 0;

    let paymentType = "None";
if (cashPaid > 0 && cardPaid > 0) {
  paymentType = window.returnMode
    ? `Refund: ${cashPaid.toFixed(2)} Cash + ${cardPaid.toFixed(2)} Card`
    : `${cashPaid.toFixed(2)} Cash + ${cardPaid.toFixed(2)} Card`;
} else if (cashPaid > 0) {
  paymentType = window.returnMode
    ? `Refund: ${cashPaid.toFixed(2)} Cash`
    : `${cashPaid.toFixed(2)} Cash`;
} else if (cardPaid > 0) {
  paymentType = window.returnMode
    ? `Refund: ${cardPaid.toFixed(2)} Card`
    : `${cardPaid.toFixed(2)} Card`;
}


    const date = new Date().toLocaleString();

    const rows = Array.from(tableBody.querySelectorAll("tr")).map((row) => {
  const name = row.children[0]?.textContent || "";
  const qty = parseFloat(row.children[1]?.textContent || "0");
  const price = parseFloat(row.children[2]?.textContent.replace(/[^0-9.]/g, "") || "0");
  const subtotal = parseFloat(row.children[3]?.textContent.replace(/[^0-9.]/g, "") || "0");
  const tax = +(subtotal * 0.07).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);
  const sku = row.dataset?.sku || "";

  return {
  Date: date,
  Sku: sku,
  "Product Title": name,
  Quantity: qty,
  Price: price,
  Discount: discountPercent,
  SalePrice: +(price * (1 - discountPercent / 100)).toFixed(2),
  OriginalInvoice: originalInvoice,
  Subtotal: subtotal,
  Tax: tax,
  Total: window.returnMode ? -Math.abs(total) : total, // ✅ negative for returns
  Refund: window.returnMode ? "Yes" : "No",           // ✅ marks refund
  Invoice: Date.now().toString().slice(-6),
  "Customer Email": email,
  "Share Receipt": share,
  Payment: paymentType,
  CashPaid: cashPaid,
  CardPaid: cardPaid,
  Paid: (cashPaid + cardPaid).toFixed(2),
  ReturnMode: !!returnMode,
  ReturnCondition: returnCondition,
};
}); // ✅ this closes .map()



    if (!rows.length) {
      alert("🧾 Add at least one product before submitting!");
      return;
    }

    console.log("POST →", SHEET_API, rows);

    // 👇 Use text/plain to avoid OPTIONS preflight
    const res = await fetch(SHEET_API, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(rows),
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      console.error("POST failed:", res.status, json);
      alert(`⚠️ Sync failed (${res.status}). Check console.`);
      return;
    }

    console.log("✅ Backend response:", json);
    alert("✅ Sale recorded and inventory updated!");
    updateInvoiceNumber();

    // ✅ Reset UI after success
    document.getElementById("receipt-details").innerHTML = "";
    document.getElementById("submit-row")?.classList.add("hidden");
    if (emailEl) emailEl.value = "";
    document.getElementById("amount-paid-display").textContent = "$0.00";
    document.getElementById("change-amount").textContent = "$0.00";
    document.getElementById("split-info").textContent = "None";
    document.getElementById("return-condition").value = "";
document.getElementById("return-condition-row").classList.add("hidden");
if (typeof setReturnMode === "function") setReturnMode(false);

   // ✅ Clear memory and totals
window.cashMemory = 0;
window.cardMemory = 0;
if (typeof updateTotals === "function") updateTotals();

// ✅ Clear discount + invoice fields for next order
if (discountInput) discountInput.value = "";
if (originalInvoiceInput) originalInvoiceInput.value = "";

console.log("✅ Sale complete, UI cleared for next entry.");
} catch (err) {
  console.error("❌ Error posting sale:", err);
  alert("⚠️ Could not sync sale. Check console for details.");
}
}

// Bind once (must be outside submitSale)
document.getElementById("submit-sale")?.addEventListener("click", submitSale);
document.getElementById("clear-order-btn")?.addEventListener("click", resetOrder);


// ===========================================================
// 🚀 INIT
// ===========================================================
loadProductCatalog();
console.log("✅ Kinaya POS ready.");
});   // 👈 Add this semicolon — closes document.addEventListener("DOMContentLoaded", async () => { ... })



