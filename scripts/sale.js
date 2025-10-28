// ===========================================================
// 🌿 KINAYA RISING POS — FINAL UNIFIED LOGIC (2025)
// ===========================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🌿 Kinaya POS initializing...");

  // ---------- CONFIG ----------
  const SHEET_API =
    "https://script.google.com/macros/s/AKfycbz83-usxoCG3YpHFACMTH9SA8CP2PLANhdFC92fbpm55qo3KSF30lb9ph3iOooQhQWX0A/exec"; // 🔹 Replace if redeployed

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

    if (data?.nextInvoice) {
      // 🔹 Save it globally for submitSale()
      window.nextInvoiceNumber = data.nextInvoice;

      // 🔹 Update the text on the receipt
      if (invoiceNumEl) invoiceNumEl.textContent = `Invoice #${data.nextInvoice}`;

      console.log(`🧾 Next invoice number loaded: ${data.nextInvoice}`);
    } else {
      throw new Error("Missing nextInvoice in response");
    }
  } catch (err) {
    console.error("❌ Could not fetch invoice number:", err);
    const invoiceNumEl = document.getElementById("invoice-number");
    if (invoiceNumEl) invoiceNumEl.textContent = "Invoice #Error";
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

    // ✅ Build receipt rows first
    tableBody.innerHTML = data.map(r => `
      <tr data-sku="${r.Sku || ""}">
        <td>${r["Product Title"] || "Unknown"}</td>
        <td class="qty">${r.Quantity || 0}</td>
        <td>$${parseFloat(r.Price || 0).toFixed(2)}</td>
        <td class="subtotal">$${parseFloat(r.Subtotal || 0).toFixed(2)}</td>
        <td><button class="del-btn"><i class="fas fa-trash"></i></button></td>
      </tr>
    `).join("");

    // 🧾 Tag all loaded rows as original (after they exist)
    tableBody.querySelectorAll("tr").forEach(row => {
      row.classList.add("original-item");
      row.style.opacity = "0.8";
      row.style.borderLeft = "2px solid rgba(102,202,255,0.3)";
    });

    // ✅ Calculate and update summary
    const subtotal = data.reduce((sum, r) => sum + (parseFloat(r.Subtotal) || 0), 0);
    const tax = data.reduce((sum, r) => sum + (parseFloat(r.Tax) || 0), 0);
    const total = data.reduce((sum, r) => sum + (parseFloat(r.Total) || 0), 0);
    const paid = data[0].Paid || total;
    const payment = data[0].Payment || "N/A";
    const email = data[0].Email || "";

    document.getElementById("subtotal-summary").textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById("tax-summary").textContent = `$${tax.toFixed(2)}`;
    document.getElementById("grandtotal-summary").textContent = `$${total.toFixed(2)}`;
    document.getElementById("amount-paid-display").textContent = `$${parseFloat(paid).toFixed(2)}`;
    document.getElementById("split-info").textContent = payment;
    document.getElementById("customer-email").value = email;

    // 💾 Store paid for return math
const amountPaidEl = document.getElementById("amount-paid-display");
if (amountPaidEl) amountPaidEl.dataset.originalPaid = paid;

// 💾 Persist Original Purchase Amount in Return Summary
const originalEl = document.getElementById("original-total");
if (originalEl) {
  // Unlock if switching to a new invoice
  originalEl.dataset.locked = "false";

  // Pull the current grand total from this invoice
  const grand = parseFloat(
    document.getElementById("grandtotal-summary")?.textContent.replace(/[^0-9.-]/g, "")
  ) || 0;

  // Set and lock the original amount
  originalEl.textContent = `$${grand.toFixed(2)}`;
  originalEl.dataset.locked = "true";
  console.log(`💾 Original Purchase Amount set and locked: $${grand.toFixed(2)}`);
}

// ✅ Show success
resultDiv.innerHTML = `<p style="color:lightgreen;">✅ Invoice #${id} loaded successfully.</p>`;

// 💾 Save for Return Mode
const originalInvoiceInput = document.getElementById("original-invoice");
if (originalInvoiceInput) originalInvoiceInput.value = id;

// 🟦 Show linked invoice in Return Summary
const linkedInvoiceNum = document.getElementById("linked-invoice-number");
const summaryRow = document.getElementById("return-summary-row");

if (linkedInvoiceNum && summaryRow) {
  linkedInvoiceNum.textContent = `#${id}`;
  summaryRow.classList.remove("hidden");
}

// 🔗 Update linked invoice under Return Summary
const linkRow = document.getElementById("linked-invoice-row");
if (linkRow) {
  linkRow.classList.remove("hidden");
  linkRow.innerHTML = `
    <small style="color:#66caff;cursor:pointer;text-decoration:underline;">
      View Original Invoice #${id}
    </small>
  `;
  linkRow.onclick = () => {
    document.getElementById("invoice-search-input").value = id;
    document.getElementById("invoice-search-btn").click();
  };
}

// ✅ Enable Return Mode automatically
if (typeof setReturnMode === "function") setReturnMode(true);

// ✅ Refresh summaries
if (typeof updateTotals === "function") updateTotals();
if (typeof updateReturnSummary === "function") updateReturnSummary();

// ✅ Apply discount and re-check submit state
applyDiscount();
toggleSubmitButton();

// Focus on condition selector
document.getElementById("return-condition")?.focus();

  } catch (err) {
    console.error("❌ Invoice lookup failed:", err);
    resultDiv.innerHTML = `<p style="color:red;">⚠️ Error fetching invoice details. Check console.</p>`;
  }
}); // ✅ closes the event listener properly


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
  //  RETURN MODEE HELPERR
  // ===========================================================
  function getActiveUnitPrice(sale, retail) {
  // In Return Mode always use RETAIL; otherwise use SALE if it’s lower and > 0
  if (window.returnMode) return Number(retail) || 0;
  return (Number(sale) > 0 && Number(sale) < Number(retail)) ? Number(sale) : Number(retail) || 0;
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

  // 🔹 Attach product click handler (forces retail in Return Mode)
document.querySelectorAll(".menu-item").forEach((item) => {
  item.addEventListener("click", () => {
    const name   = item.dataset.name;
    const sku    = item.dataset.sku;
    const retail = parseFloat(item.dataset.retail || "0");
    const sale   = parseFloat(item.dataset.sale   || "0");

    // 👇 KEY LINE: retail in return mode, sale-if-valid otherwise
    const unitPrice = getActiveUnitPrice(sale, retail);

    // Return mode adds a negative line; normal mode increments/creates positive line
    const qtyChange = window.returnMode ? -1 : 1;

    updateReceipt({ name, sku, price: unitPrice, qtyChange });
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
// 🔁 RETURN MODE TOGGLER — Unified (Sale ↔ Return Mode)
// ===========================================================
function setReturnMode(state) {
  const banner = document.getElementById("return-mode-banner");
  const returnConditionRow = document.getElementById("return-condition-row");
  const differenceRow = document.getElementById("difference-row");
  const changeRow = document.getElementById("change-row");
  const discountRow = document.getElementById("discount-row");
  const tableBody = document.getElementById("receipt-details");
  const productCards = document.querySelectorAll(".menu-item");

  // ---------- 1️⃣ Core state ----------
  window.returnMode = state;
  sessionStorage.setItem("returnMode", state ? "true" : "false");
  document.body.classList.toggle("return-active", state);

  // ---------- 2️⃣ Banner ----------
  if (banner) {
    banner.classList.toggle("active", state);
    banner.textContent = state ? "🔴 RETURN MODE ACTIVE" : "";
  }

  // ---------- 3️⃣ Summary & UI rows ----------
  if (returnConditionRow) returnConditionRow.classList.toggle("hidden", !state);
  if (differenceRow) differenceRow.classList.toggle("hidden", !state);
  if (changeRow) changeRow.classList.toggle("hidden", !!state);
  if (discountRow) discountRow.classList.toggle("hidden", state); // hide discounts in return mode

    // ---------- 4️⃣ KEEP ORIGINAL RECEIPT IN VIEW ----------
if (tableBody) {
  if (state) {
    // Entering Return Mode → mark all existing rows as original (dimmed)
    tableBody.querySelectorAll("tr").forEach(row => {
      row.classList.add("original-item");
      row.style.opacity = "0.6";
      row.style.borderLeft = "2px solid rgba(102,202,255,0.3)";
    });
  } else {
    // Exiting Return Mode → keep originals dimmed, but DO NOT mark new ones
    tableBody.querySelectorAll("tr").forEach(row => {
      if (row.classList.contains("return-line")) {
        // Keep returns red
        row.style.color = "#ff8080";
      } else if (row.classList.contains("original-item")) {
        // Originals stay dimmed (read-only)
        row.style.opacity = "0.6";
        row.style.color = "#A7E1EE";
      } else {
        // New items = full brightness
        row.style.opacity = "1";
        row.style.color = "#bffcff";
      }
    });
  }
}

  // ---------- 5️⃣ Price display toggle ----------
  productCards.forEach(card => {
    const salePrice = parseFloat(card.dataset.sale || 0);
    const retailPrice = parseFloat(card.dataset.retail || 0);
    const priceLines = card.querySelectorAll("figcaption");
    if (!priceLines.length) return;
    const priceLine = priceLines[priceLines.length - 1];

    if (state) {
      // In Return Mode → show RETAIL ONLY
      priceLine.innerHTML = `<span style="color:#bffcff;">$${retailPrice.toFixed(2)}</span>`;
    } else {
      // Exit Return Mode → restore SALE + struck RETAIL (if sale is lower)
      if (salePrice > 0 && salePrice < retailPrice) {
        priceLine.innerHTML = `
          <span style="color:#bffcff;">$${salePrice.toFixed(2)}</span>
          <span style="text-decoration:line-through; color:#888; margin-left:4px;">
            $${retailPrice.toFixed(2)}
          </span>`;
      } else {
        priceLine.innerHTML = `<span style="color:#bffcff;">$${retailPrice.toFixed(2)}</span>`;
      }
    }
  });

  // ---------- 6️⃣ Done ----------
  console.log(`↩️ Return Mode ${state ? "ENABLED" : "DISABLED"}`);
  updateTotals();
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
// 💸 TOTAL CALCULATION — Always Accurate (Sales + Returns)
// ===========================================================
function updateTotals() {
  const tableBody = document.getElementById("receipt-details");
  if (!tableBody) return;

  // 1️⃣ Separate positive vs. negative lines
  let saleSubtotal = 0;
  let returnSubtotal = 0;

  tableBody.querySelectorAll("tr").forEach((row) => {
    const sub = parseFloat(row.querySelector(".subtotal")?.textContent.replace(/[^0-9.-]/g, "") || 0);
    if (sub >= 0) saleSubtotal += sub;
    else returnSubtotal += Math.abs(sub); // positive value for returns
  });

  // 2️⃣ Discount logic (applies only to sale lines)
  const discountPercent = parseFloat(document.getElementById("discount-input")?.value || 0);
  const discountAmount = saleSubtotal * (discountPercent / 100);
  const discountedSubtotal = saleSubtotal - discountAmount;

  // 3️⃣ Tax calculation (7% of both sales and returns)
  const taxRate = window.taxEnabled ? 0.07 : 0;
  const saleTax = discountedSubtotal * taxRate;
  const returnTax = returnSubtotal * taxRate;
  const totalTax = saleTax; // Tax only applies to new sales in your UI summary

  // 4️⃣ Returned total (items + tax)
  const returnedItemsTotal = returnSubtotal + returnTax;

  // 5️⃣ Grand Total formula (Subtotal + Tax - Returns)
  const grandTotal = discountedSubtotal + saleTax - returnedItemsTotal;

  // 6️⃣ Update displays
document.getElementById("subtotal-summary").textContent = `$${discountedSubtotal.toFixed(2)}`;
document.getElementById("tax-summary").textContent = `$${saleTax.toFixed(2)}`;
document.getElementById("return-total").textContent = `$${returnedItemsTotal.toFixed(2)}`;
document.getElementById("grandtotal-summary").textContent = `$${grandTotal.toFixed(2)}`;

  // 7️⃣ Payment + Change
  const totalPaid = (window.cashMemory + window.cardMemory) || 0;
  const change = Math.max(totalPaid - grandTotal, 0);
  document.getElementById("amount-paid-display").textContent = `$${totalPaid.toFixed(2)}`;
  document.getElementById("change-amount").textContent = `$${change.toFixed(2)}`;

  console.log(`🧾 Totals updated — Subtotal:$${discountedSubtotal.toFixed(2)}, Tax:$${saleTax.toFixed(2)}, Returns:$${returnedItemsTotal.toFixed(2)}, Grand:$${grandTotal.toFixed(2)}`);
}
if (window.returnMode && typeof updateReturnSummary === "function") updateReturnSummary();

// ===========================================================
// 🎯 PARSE DISCOUNT — Handle $, %, or plain numbers
// ===========================================================
function parseDiscount(value, subtotal) {
  if (!value) return 0;
  const str = String(value).trim();

  if (str.endsWith("%")) {
    const percent = parseFloat(str.replace("%", "")) || 0;
    return +(subtotal * (percent / 100)).toFixed(2);
  }
  if (str.startsWith("$")) {
    return +(parseFloat(str.replace("$", "")) || 0).toFixed(2);
  }
  return +(parseFloat(str) || 0).toFixed(2);
}


// ===========================================================
// 🎁 APPLY DISCOUNT — Unified $ / % Parser
// ===========================================================
function applyDiscount() {
  const subtotalEl = document.getElementById("subtotal-summary");
  const discountInput = document.getElementById("discount-input");
  const discountDisplay = document.getElementById("discount-display");
  const discountRow = document.getElementById("discount-row");

  if (!subtotalEl || !discountInput) return;

  const subtotal = parseFloat(subtotalEl.textContent.replace(/[^0-9.]/g, "")) || 0;
  const discountRaw = discountInput.value;
  const discountValue = parseDiscount(discountRaw, subtotal);

  if (discountValue > 0) {
    discountRow?.classList.remove("hidden");
    discountDisplay.textContent = `–$${discountValue.toFixed(2)}`;
  } else {
    discountRow?.classList.add("hidden");
    discountDisplay.textContent = "$0.00";
  }

  updateTotals();
}


// ===========================================================
// 🗑 DELETE ITEM (decrement or remove row)
// ===========================================================
document.addEventListener("click", (e) => {
  if (e.target.closest(".del-btn")) {
    const row = e.target.closest("tr");
    const qtyCell = row.querySelector(".qty");
    const subCell = row.querySelector(".subtotal");
    const priceCell = row.children[2];

    let qty = parseInt(qtyCell.textContent, 10);
    const price = parseFloat(priceCell.textContent.replace(/[^0-9.-]/g, "")) || 0;

    qty -= 1;

    if (qty > 0) {
      qtyCell.textContent = qty;
      subCell.textContent = `$${(qty * price).toFixed(2)}`;
    } else {
      row.remove();
    }

    updateTotals();
    applyDiscount();
    toggleSubmitButton();

    const hasItems = document.querySelectorAll("#receipt-details tr").length > 0;
    document.getElementById("submit-row").classList.toggle("hidden", !hasItems);
  }
});

// ===========================================================
// 🔁 RETURN SUMMARY — Reflects Actual Totals + Tax (Persistent Original)
// ===========================================================
function updateReturnSummary() {
  const summaryRow = document.getElementById("return-summary-row");
  if (!summaryRow) return;

  summaryRow.classList.remove("hidden");

  const amountPaidDisplay = document.getElementById("amount-paid-display");
  const originalPaidValue = parseFloat(amountPaidDisplay?.dataset.originalPaid || 0) || 0;
  const returnedValue = parseFloat(
    document.getElementById("return-value")?.textContent.replace(/[^0-9.-]/g, "") || 0
  );
  const grandTotal = parseFloat(
    document.getElementById("grandtotal-summary")?.textContent.replace(/[^0-9.-]/g, "") || 0
  );

  const net = originalPaidValue - grandTotal;

  const originalEl = document.getElementById("original-total") || document.getElementById("original-paid");
  const returnEl = document.getElementById("return-total") || document.getElementById("return-value");
  const labelEl = document.getElementById("balance-label");
  const balanceEl = document.getElementById("balance-amount");

  if (!originalEl || !returnEl || !labelEl || !balanceEl) {
    console.warn("⚠️ Missing return summary elements — skipping updateReturnSummary()");
    return;
  }

  // 🔒 Persist original purchase amount — only set once unless unlocked
  if (!originalEl.dataset.locked || originalEl.dataset.locked === "false") {
    originalEl.textContent = `$${originalPaidValue.toFixed(2)}`;
    originalEl.dataset.locked = "true";
  }

  // Update returned amount each time
  returnEl.textContent = `$${returnedValue.toFixed(2)}`;

  // Update label and color for balance result
  if (net < 0) {
    labelEl.textContent = "Balance Due:";
    balanceEl.style.color = "#4FD9FF";
  } else if (net > 0) {
    labelEl.textContent = "Refund Due:";
    balanceEl.style.color = "#ff8080";
  } else {
    labelEl.textContent = "Even Exchange:";
    balanceEl.style.color = "#A7E1EE";
  }

  balanceEl.textContent = `$${Math.abs(net).toFixed(2)}`;
  console.log("🔁 Return Summary Updated", { originalPaidValue, returnedValue, grandTotal, net });
}

// ===========================================================
// 💰 PAYMENT OVERLAY (Cash/Card with Draft Memory + Dynamic Owed)
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

  // --- persistent memory and drafts ---
  let currentPaymentType = null;
  window.cashMemory = window.cashMemory || 0;
  window.cardMemory = window.cardMemory || 0;
  window.cashDraft = window.cashDraft || "0";
  window.cardDraft = window.cardDraft || "0";
  let tempAmount = "0";

  // ---------- OPEN ----------
  function openPaypad(type) {
    // 💾 Preserve current pad’s draft before switching
    if (currentPaymentType === "cash") window.cashDraft = tempAmount;
    if (currentPaymentType === "card") window.cardDraft = tempAmount;

    currentPaymentType = type;
    overlay.classList.add("active");
    document.querySelector(".paypad-title").textContent =
      type === "cash" ? "Enter Cash Amount" : "Enter Card Amount";

    // 💾 Restore typed value or memory
    if (type === "cash") tempAmount = window.cashDraft || String(window.cashMemory || "0");
    if (type === "card") tempAmount = window.cardDraft || "0";

    updateOwedDisplay();
    updatePaypadDisplay();
    updateCashPreview();
  }

  // ---------- CLOSE ----------
  function closePaypad(save = false) {
    overlay.classList.remove("active");
    const val = parseFloat(tempAmount || "0") || 0;

    if (save) {
      // Save confirmed amount
      if (currentPaymentType === "cash") {
        window.cashMemory = val;
        window.cashDraft = "0";
      } else if (currentPaymentType === "card") {
        window.cardMemory = val;
        window.cardDraft = "0";
      }
    } else {
      // Save what’s typed as a draft
      if (currentPaymentType === "cash") window.cashDraft = tempAmount;
      if (currentPaymentType === "card") window.cardDraft = tempAmount;
    }

    updateTotals();
    updatePaymentSummary();
    applyDiscount();
    toggleSubmitButton();
  }

  // ---------- Owed + Display helpers ----------
  function updateOwedDisplay() {
    const grandText = document.getElementById("grandtotal-summary")?.textContent || "$0.00";
    const grand = parseFloat(grandText.replace(/[^0-9.]/g, "")) || 0;
    const paidSoFar = (window.cashMemory || 0) + (window.cardMemory || 0);
    const remaining = Math.max(grand - paidSoFar, 0);
    owedDisplay.textContent = `Amount Owed: $${remaining.toFixed(2)}`;
  }

  function updateCashPreview() {
    if (currentPaymentType !== "cash") {
      document.getElementById("paypad-given").textContent = "";
      document.getElementById("paypad-change").textContent = "";
      return;
    }
    const grandText = document.getElementById("grandtotal-summary")?.textContent || "$0.00";
    const grand = parseFloat(grandText.replace(/[^0-9.]/g, "")) || 0;
    const paidCard = window.cardMemory || 0;
    const remaining = Math.max(grand - paidCard, 0);
    const given = parseFloat(tempAmount || "0") || 0;
    const change = Math.max(given - remaining, 0);

    document.getElementById("paypad-given").textContent = `Cash Given: $${given.toFixed(2)}`;
    document.getElementById("paypad-change").textContent = `Change Due: $${change.toFixed(2)}`;
  }

  function updatePaypadDisplay() {
    paypadDisplay.textContent = `$${parseFloat(tempAmount || "0").toFixed(2)}`;
  }

  // ---------- PAYMENT SUMMARY ----------
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
    splitInfo.textContent = split;

    const grandText = document.getElementById("grandtotal-summary")?.textContent || "$0.00";
    const grand = parseFloat(grandText.replace(/[^0-9.]/g, "")) || 0;
    const change = Math.max(window.cashMemory - grand, 0);
    document.getElementById("change-amount").textContent = `$${change.toFixed(2)}`;
  }

  // ---------- BUTTON LOGIC ----------
  paypadButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.value;
      if (!val) return;

      if (val === "C" || val === "clear") tempAmount = "0";
      else if (val === "←" || val === "back") tempAmount = tempAmount.slice(0, -1) || "0";
      else tempAmount = tempAmount === "0" ? val : tempAmount + val;

      updatePaypadDisplay();
      updateCashPreview(); // live change display for cash
    });
  });

  // ---------- CONFIRM / CLOSE ----------
  confirmBtn?.addEventListener("click", () => closePaypad(true));
  closeBtn?.addEventListener("click", () => closePaypad(false));

  // ---------- OPEN TRIGGERS ----------
  cashBtn?.addEventListener("click", () => openPaypad("cash"));
  cardBtn?.addEventListener("click", () => openPaypad("card"));
})();

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
// 🧾 SUBMIT SALE — POST TO BACKEND (CORS-SAFE, AUTO-SYNC)
// ===========================================================
async function submitSale() {
  try {
    const emailEl = document.getElementById("customer-email");
    const discountInput = document.getElementById("discount-input");
    const originalInvoiceInput = document.getElementById("original-invoice");
    const returnCondition = document.getElementById("return-condition")?.value || "";

    const discountPercent = parseFloat(discountInput?.value || 0);
    const originalInvoice = (originalInvoiceInput?.value || "").trim();
    const emailToggle = document.getElementById("email-toggle");
    const tableBody = document.getElementById("receipt-details");

    const email = (emailEl?.value || "").trim();
    const subscribe = emailToggle?.checked ? "Yes" : "No";
    const cashPaid = window.cashMemory || 0;
    const cardPaid = window.cardMemory || 0;
    const totalPaid = cashPaid + cardPaid;

    const date = new Date().toLocaleString();

    let paymentType = "None";
    if (cashPaid > 0 && cardPaid > 0) {
      paymentType = `${cashPaid.toFixed(2)} Cash + ${cardPaid.toFixed(2)} Card`;
    } else if (cashPaid > 0) {
      paymentType = `${cashPaid.toFixed(2)} Cash`;
    } else if (cardPaid > 0) {
      paymentType = `${cardPaid.toFixed(2)} Card`;
    }

    const rows = Array.from(tableBody.querySelectorAll("tr"))
  // only send new or return lines, not old dimmed originals
  .filter(row => !row.classList.contains("original-item"))
  .map((row) => {
      const name = row.children[0]?.textContent || "";
      const qty = parseFloat(row.children[1]?.textContent || "0");
      const price = parseFloat(row.children[2]?.textContent.replace(/[^0-9.]/g, "") || "0");
      const subtotal = +(qty * price).toFixed(2);
      const tax = +(subtotal * 0.07).toFixed(2);
      const total = +(subtotal + tax).toFixed(2);
      const sku = row.dataset?.sku || "";

      return {
        Date: date,
        Sku: sku,
        "Product Title": name,
        Quantity: qty,
        Price: price,
        Subtotal: subtotal,
        Tax: tax,
        Total: window.returnMode ? -Math.abs(total) : total, // Negative for returns
        Discount: discountPercent,
        "Sale Price": +(price * (1 - discountPercent / 100)).toFixed(2),
        "Stable Sku": sku.split("-")[0],
        "Invoice #": window.nextInvoiceNumber || "TEMP",
        Email: email,
        Subscribe: subscribe,
        Payment: paymentType,
        CashPaid: cashPaid,
        CardPaid: cardPaid,
        Paid: totalPaid.toFixed(2),
        ReturnMode: !!window.returnMode,
        ReturnCondition: returnCondition,
        OriginalInvoice: originalInvoice,
      };
    });

    if (!rows.length) {
      alert("🧾 Add at least one product before submitting!");
      return;
    }
    
    // 🔹 Tell backend what operation this is
rows.forEach(r => r.Mode = "saleEntry");
console.log("POST →", SHEET_API, rows);

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

if (!res.ok || !json.success) {
  console.error("POST failed:", res.status, json);
  alert(`⚠️ Sync failed (${json.error || res.status}). Check console.`);
  return;
}

console.log("✅ Backend response:", json);
alert(json.message || "✅ Sale recorded successfully!");
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
if (typeof updateTotals === "function") updateTotals();

window.cashMemory = 0;
window.cardMemory = 0;
if (discountInput) discountInput.value = "";
if (originalInvoiceInput) originalInvoiceInput.value = "";

console.log("✅ Sale complete, UI cleared for next entry.");

// 🔁 Auto-refresh page (same as reset button)
setTimeout(() => location.reload(), 800);

} catch (err) {
    console.error("❌ Error posting sale:", err);
    alert("⚠️ Could not sync sale. Check console for details.");
  }
} // ✅ closes submitSale()

// Bind event
document.getElementById("submit-sale")?.addEventListener("click", submitSale);


// ===========================================================
// 🧹 FULL RESET (Safe After Invoice Lookup or Trash)
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
  const resetText = (id, val = "$0.00") => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  ["subtotal-summary", "tax-summary", "grandtotal-summary", "amount-paid-display", "change-amount"]
    .forEach(id => resetText(id));

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

  // 🔍 NEW — Clear invoice search & original invoice data
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

  // 🧾 Refresh invoice number + totals
  if (typeof updateInvoiceNumber === "function") updateInvoiceNumber();
  if (typeof updateTotals === "function") updateTotals();

  console.log("✅ POS reset complete — ready for next order.");

  // 🟦 Optional: focus cursor back to search bar for speed
  setTimeout(() => {
    document.getElementById("invoice-search-input")?.focus();
  }, 200);
}
const resetBtn = document.getElementById("reset-order-btn");
const invoiceResult = document.getElementById("invoice-result");
const invoiceSearchInput = document.getElementById("invoice-search-input");
const receiptDetails = document.getElementById("receipt-details");

resetBtn.addEventListener("click", () => location.reload());

// ===========================================================
// 🚀 INIT
// ===========================================================
await updateInvoiceNumber(); // 🧾 show invoice number on load
await loadProductCatalog();
console.log("✅ Kinaya POS ready.");
}); // ✅ closes document.addEventListener("DOMContentLoaded", async () => {


