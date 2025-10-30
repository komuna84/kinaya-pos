/// ===========================================================
// 🌿 KINAYA RISING POS — FINAL UNIFIED LOGIC (2025)
// ===========================================================

// ---------- GLOBAL TAX SETTINGS ----------
window.taxEnabled = true;  // default ON
window.taxRate = 0.07;     // 7% default rate

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🌿 Kinaya POS initializing...");
  
  // ---------- GLOBAL CACHE ----------
window.productCache = {
  loaded: false,
  products: []
};



  // ---------- CONFIG ----------
  const SHEET_API =
    "https://script.google.com/macros/s/AKfycbw2tVFsnIuZdorUrUJShEZjP2uRcuz1VwHiz2KpdlrHj9q04qyIvYJT1nAMobPYzFa9RQ/exec"; // 🔹 Replace if redeployed

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

    const result = await res.json();

    // ✅ Directly read result.nextInvoice, not data.nextInvoice
    const nextNum = result.nextInvoice || result?.data?.nextInvoice;
    if (nextNum) {
      window.nextInvoiceNumber = nextNum;
      if (invoiceNumEl) invoiceNumEl.textContent = `Invoice #${nextNum}`;
      console.log(`🧾 Next invoice number loaded: ${nextNum}`);
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
// 🔗 LINKED INVOICE REFERENCE — Syncs Search + Return Summary
// ===========================================================
function updateLinkedInvoiceReference(currentId, linkedId) {
  const topInvoiceEl = document.getElementById("invoice-number");
  const linkedEl = document.getElementById("linked-invoice-number");
  const summaryRow = document.getElementById("return-summary-row");

  if (!linkedEl || !summaryRow) return;

  // show both invoices in relationship form (e.g. #1005 → #1006)
  linkedEl.innerHTML = `
    <small style="color:#66caff;cursor:pointer;text-decoration:underline;">
      View Original Invoice #${linkedId}
    </small>
  `;

  linkedEl.onclick = () => {
    document.getElementById("invoice-search-input").value = linkedId;
    document.getElementById("invoice-search-btn").click();
  };

  summaryRow.classList.remove("hidden");

  // add visual cue to top
  if (topInvoiceEl) {
    topInvoiceEl.innerHTML = `
      Invoice #${currentId} 
      <span style="color:#66caff;font-size:0.85em;margin-left:8px;">
        ← linked to #${linkedId}
      </span>
    `;
  }

  console.log(`🔗 Linked invoice reference set: ${currentId} ← ${linkedId}`);
}

// ✅ Add optional "Next →" navigation only if invoice element exists
if (document.getElementById("invoice-number")) {
  const topInvoiceEl = document.getElementById("invoice-number");
  const nextSpan = document.createElement("span");
  nextSpan.innerHTML = `&nbsp;<span style="color:#66caff;cursor:pointer;">→ Next</span>`;
  nextSpan.onclick = () => {
    document.getElementById("invoice-search-input").value = window.nextInvoiceNumber || "";
    document.getElementById("invoice-search-btn").click();
  };
  topInvoiceEl.appendChild(nextSpan);
}


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
    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : json; // ✅ ensure array


    if (!data || data.length === 0) {
      resultDiv.innerHTML = `<p style="color:red;">❌ No record found for Invoice #${id}</p>`;
      return;
    }

    // ✅ Build receipt rows first (original rows have NO dropdown)
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

    // 💾 Store paid for return math + persist to dataset
    const amountPaidEl = document.getElementById("amount-paid-display");
    if (amountPaidEl) amountPaidEl.dataset.originalPaid = paid;

    /// 💾 Persist Original Purchase Amount in Return Summary (guaranteed timing)
setTimeout(() => {
  const originalEl = document.getElementById("original-total");
  const grandEl = document.getElementById("grandtotal-summary");

  if (!originalEl || !grandEl) {
    console.warn("⚠️ Missing elements for Original Purchase Amount");
    return;
  }

  // Get live grand total after render
  const grand = parseFloat(grandEl.textContent.replace(/[^0-9.-]/g, "")) || 0;

  if (grand > 0) {
    originalEl.dataset.locked = "true";
    originalEl.textContent = `$${grand.toFixed(2)}`;
    console.log(`💾 Original Purchase Amount confirmed after render: $${grand.toFixed(2)}`);
  } else {
    console.warn("⚠️ Grand total still 0 — skipping original total update");
  }
}, 200); // small delay ensures DOM + totals are rendered

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

    // 🔗 Update linked invoice clickable row (optional)
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
// 🔁 LOAD PRODUCT CATALOG (Cached for speed)
// ===========================================================
async function loadProductCatalog(forceReload = false) {
  // 🧠 Use cached version unless forced
  if (window.productCache.loaded && !forceReload) {
    console.log("⚡ Using cached product catalog");
    renderProducts(window.productCache.products);
    return;
  }

  try {
    const res = await fetch(`${SHEET_API}?mode=pos`);
    if (!res.ok) throw new Error(`Network error: ${res.status}`);
    const data = await res.json();

    // 🧠 Cache the result
    window.productCache.products = data;
    window.productCache.loaded = true;

    renderProducts(data);
    console.log(`✅ Loaded and cached ${data.length} products from sheet.`);
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
// 🧾 RECEIPT HANDLER — Fixed so R/D only shows for returns
// ===========================================================
function updateReceipt(product) {
  const tableBody = document.getElementById("receipt-details");
  if (!tableBody) return;

  // Always find existing (non-return) line
  const existing = Array.from(tableBody.children).find(
    (row) => row.dataset.sku === product.sku && !row.classList.contains("return-line")
  );

  // 🔹 Normal Sale Mode
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

  // 🔁 Return Mode — red line + R/D condition
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
      <td style="display:flex;align-items:center;gap:6px;">
        <select class="return-condition-row" title="R = Restock, D = Damaged">
          <option value="Restock (sellable)">R</option>
          <option value="Damaged (unsellable)">D</option>
        </select>
        <button class="del-btn"><i class="fas fa-trash"></i></button>
      </td>
    `;

    // 🌿 Handle R/D change
    const select = newRow.querySelector(".return-condition-row");
    select.addEventListener("change", (e) => {
      const value = e.target.value;
      const sku = newRow.dataset.sku;

      switch (value) {
        case "Restock (sellable)":
          console.log(`Item ${sku}: restocked to inventory.`);
          break;
        case "Damaged (unsellable)":
          console.log(`Item ${sku}: marked damaged.`);
          break;
      }
    });

    tableBody.appendChild(newRow);
  }

  // ✅ Always recalc after add
  updateTotals();
  applyDiscount();
  toggleSubmitButton();
}

// ===========================================================
// 💾 ENSURE ORIGINAL PURCHASE AMOUNT IS DISPLAYED
// ===========================================================
function ensureOriginalAmountDisplay() {
  const amountPaidDisplay = document.getElementById("amount-paid-display");
  const originalPaidValue = parseFloat(amountPaidDisplay?.dataset.originalPaid || 0) || 0;
  const originalEl = document.getElementById("original-total") || document.getElementById("original-paid");

  if (!originalEl) return;

  // Always show even if 0.00
  originalEl.textContent = `$${originalPaidValue.toFixed(2)}`;
}


// ===========================================================
// 💸 UNIVERSAL TOTAL CALCULATION — Works for Sales + Returns
// ===========================================================
function updateTotals() {
  const tableBody = document.getElementById("receipt-details");
  if (!tableBody) return;

  // ---------- Base Setup ----------
  const taxRate = window.taxEnabled ? window.taxRate || 0.07 : 0;
  const discountPercent = parseFloat(document.getElementById("discount-input")?.value || 0);
  const amountPaidDisplay = document.getElementById("amount-paid-display");
  const originalPaidValue = parseFloat(amountPaidDisplay?.dataset.originalPaid || 0) || 0;

  // ---------- Subtotals ----------
  let saleSubtotal = 0;
  let returnSubtotal = 0;

  tableBody.querySelectorAll("tr").forEach(row => {
    const sub = parseFloat(row.querySelector(".subtotal")?.textContent.replace(/[^0-9.-]/g, "") || 0);
    if (sub >= 0) saleSubtotal += sub;
    else returnSubtotal += Math.abs(sub);
  });

  // ---------- Discounts ----------
  const discountAmount = saleSubtotal * (discountPercent / 100);
  const discountedSubtotal = saleSubtotal - discountAmount;

  // ---------- Tax ----------
  const saleTax = discountedSubtotal * taxRate;
  const returnTax = returnSubtotal * taxRate;
  const totalTax = saleTax + returnTax;

  // ---------- Totals ----------
  const newPurchases = discountedSubtotal + saleTax;
  const returns = returnSubtotal + returnTax;
  const grandTotal = (newPurchases - returns) - originalPaidValue;

  // ---------- UI Summary ----------
  const subtotalEl = document.getElementById("subtotal-summary");
  const taxEl = document.getElementById("tax-summary");
  const returnEl = document.getElementById("return-total");
  const grandEl = document.getElementById("grandtotal-summary");
  const balanceLabel = document.getElementById("balance-label");
  const balanceAmount = document.getElementById("balance-amount");

  if (subtotalEl) subtotalEl.textContent = `$${discountedSubtotal.toFixed(2)}`;
  if (taxEl) taxEl.textContent = `$${saleTax.toFixed(2)}`;
  if (returnEl) returnEl.textContent = `$${returns.toFixed(2)}`;
  if (grandEl) grandEl.textContent = `$${(newPurchases - returns).toFixed(2)}`;

  // ---------- Payment + Change ----------
  const totalPaid = (window.cashMemory + window.cardMemory) || 0;
  const change = Math.max(totalPaid - (newPurchases - returns), 0);
  document.getElementById("amount-paid-display").textContent = `$${totalPaid.toFixed(2)}`;
  document.getElementById("change-amount").textContent = `$${change.toFixed(2)}`;

  // ---------- Refund / Balance Logic ----------
  let label = "Even Exchange:";
  let color = "#A7E1EE";

  if (grandTotal > 0) {
    label = "Balance Due:";
    color = "#4FD9FF";
  } else if (grandTotal < 0) {
    label = "Refund Due:";
    color = "#ff8080";
  }

  if (balanceLabel) balanceLabel.textContent = label;
  if (balanceAmount) {
    balanceAmount.style.color = color;
    balanceAmount.textContent = `$${Math.abs(grandTotal).toFixed(2)}`;
  }

  ensureOriginalAmountDisplay();

  console.log("🧾 Totals Updated", {
    saleSubtotal,
    returnSubtotal,
    discountedSubtotal,
    saleTax,
    returnTax,
    newPurchases,
    returns,
    originalPaidValue,
    grandTotal
  });
}

// ===========================================================
// 🧭 Ensure Original Purchase Amount Persists on Screen
// ===========================================================
function ensureOriginalAmountDisplay() {
  const amountPaidDisplay = document.getElementById("amount-paid-display");
  const originalEl = document.getElementById("original-total");

  if (!amountPaidDisplay || !originalEl) return;

  const stored = parseFloat(amountPaidDisplay.dataset.originalPaid || 0);
  const locked = originalEl.dataset.locked === "true";

  if (stored > 0 && !locked) {
    originalEl.textContent = `$${stored.toFixed(2)}`;
    originalEl.dataset.locked = "true";
    console.log(`🔒 Restored Original Purchase Amount from dataset: $${stored.toFixed(2)}`);
  }
}


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

  // ===========================================================
  // 🔹 OPEN PAYPAD
  // ===========================================================
  function openPaypad(type) {
    window.openPaypad = openPaypad;

    // 💾 Preserve current pad’s draft before switching
    if (currentPaymentType === "cash") window.cashDraft = tempAmount;
    if (currentPaymentType === "card") window.cardDraft = tempAmount;

    currentPaymentType = type;

    // ✅ Force visible overlay
    overlay.classList.remove("hidden");
    overlay.style.display = "flex";
    overlay.classList.add("active");

    document.querySelector(".paypad-title").textContent =
      type === "cash" ? "Enter Cash Amount" : "Enter Card Amount";

    // 💾 Restore typed value or memory
    tempAmount =
      type === "cash"
        ? window.cashDraft || String(window.cashMemory || "0")
        : window.cardDraft || String(window.cardMemory || "0");

    updateOwedDisplay();
    updatePaypadDisplay();
    updateCashPreview();

    console.log(`💰 Paypad opened for ${type}`);
  }

  // ===========================================================
// 💰 CLOSE PAYPAD — commits or drafts entered amount
// ===========================================================
function closePaypad(save = false) {
  overlay.classList.remove("active");
  overlay.classList.add("hidden");
  overlay.style.display = "none";

  const val = parseFloat(tempAmount || "0") || 0;

  if (save) {
    // 💾 Confirm and commit value to memory
    if (currentPaymentType === "cash") {
      window.cashMemory = val;
      window.cashDraft = "0";
    } else if (currentPaymentType === "card") {
      window.cardMemory = val;
      window.cardDraft = "0";
    }
  } else {
    // 💾 Just save what was typed as a draft
    if (currentPaymentType === "cash") window.cashDraft = tempAmount;
    if (currentPaymentType === "card") window.cardDraft = tempAmount;
  }

  // 🔹 Recalculate totals + payment summary
  updateTotals();
  updatePaymentSummary();
  applyDiscount();
  toggleSubmitButton();

  console.log(`💰 ${currentPaymentType} recorded: $${val.toFixed(2)} (save=${save})`);
}

// ===========================================================
// 🔹 ONE-TIME BINDINGS (outside function)
// ===========================================================
confirmBtn?.addEventListener("click", () => closePaypad(true));
closeBtn?.addEventListener("click", () => closePaypad(false));

  // ===========================================================
  // 🔹 HELPERS
  // ===========================================================
  function updateOwedDisplay() {
    const grandText =
      document.getElementById("grandtotal-summary")?.textContent || "$0.00";
    const grand = parseFloat(grandText.replace(/[^0-9.]/g, "")) || 0;
    const paidSoFar = (window.cashMemory || 0) + (window.cardMemory || 0);
    const remaining = Math.max(grand - paidSoFar, 0);
    owedDisplay.textContent = `Amount Owed: $${remaining.toFixed(2)}`;
  }

  function updateCashPreview() {
    if (currentPaymentType !== "cash") return;
    const grandText =
      document.getElementById("grandtotal-summary")?.textContent || "$0.00";
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

    const grandText =
      document.getElementById("grandtotal-summary")?.textContent || "$0.00";
    const grand = parseFloat(grandText.replace(/[^0-9.]/g, "")) || 0;
    const change = Math.max(window.cashMemory - grand, 0);

    document.getElementById("change-amount").textContent = `$${change.toFixed(2)}`;
  }

  function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 3rem;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,198,255,0.1);
    border: 1px solid #00c6ff;
    color: #bffcff;
    font-family: 'Audiowide', sans-serif;
    padding: 0.6rem 1.5rem;
    border-radius: 10px;
    box-shadow: 0 0 15px rgba(0,198,255,0.3);
    z-index: 9999;
    opacity: 1;
    transition: opacity 0.6s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => (toast.style.opacity = 0), 1500);
  setTimeout(() => toast.remove(), 2100);
}

  // ===========================================================
  // 🔹 BUTTON LOGIC
  // ===========================================================
  paypadButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.value;
      if (!val) return;

      switch (val) {
        case "C":
          tempAmount = "0";
          break;

        case "←":
          tempAmount = tempAmount.slice(0, -1) || "0";
          break;

        case "TAX":
          window.taxEnabled = !window.taxEnabled;
          const taxStatus = document.getElementById("tax-status-row");
          if (taxStatus) {
            taxStatus.textContent = `Tax Mode: ${window.taxEnabled ? "On" : "Off"}`;
            taxStatus.style.color = window.taxEnabled ? "#66caff" : "#ff8080";
          }
          updateTotals();
          updateOwedDisplay();
          break;

        default:
          tempAmount = tempAmount === "0" ? val : tempAmount + val;
          break;
      }

      updatePaypadDisplay();
      updateCashPreview();
    });
  });

  // ===========================================================
  // 🔹 EVENT BINDINGS
  // ===========================================================
  confirmBtn?.addEventListener("click", () => closePaypad(true));
  closeBtn?.addEventListener("click", () => closePaypad(false));

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
// 🔘 SMART SUBMIT BUTTON LOGIC (Keeps Calculator Button Visible)
// ===========================================================
function toggleSubmitButton() {
  const tableBody = document.getElementById("receipt-details");
  const emailInput = document.getElementById("customer-email");
  const footerBtn = document.getElementById("submit-sale"); // 🧾 footer Confirm Sale button
  const calcBtn = document.getElementById("open-paypad-btn"); // 💳 open calculator
  const submitRow = document.getElementById("submit-row");

  if (!tableBody || !submitRow) return;

  const cash = window.cashMemory || 0;
  const card = window.cardMemory || 0;
  const total = parseFloat(
    document.getElementById("grandtotal-summary")?.textContent.replace(/[^0-9.-]/g, "") || 0
  );

  const hasItems = tableBody.querySelectorAll("tr").length > 0;
  const hasPayment = (cash + card) > 0;
  const email = (emailInput?.value || "").trim();
  const validEmail = email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isReturnOrExchange = !!window.returnMode || total <= 0;

  const readyToSubmit = hasItems && (hasPayment || isReturnOrExchange) && validEmail;

  // 💳 Show calculator button when items exist
  if (calcBtn) calcBtn.style.display = hasItems ? "inline-flex" : "none";

  // 🧾 Footer confirm button — visible when ready
  if (footerBtn) {
    footerBtn.style.display = readyToSubmit ? "inline-flex" : "none";
    footerBtn.disabled = !readyToSubmit;
  }

  // 🌿 Footer bar visibility
  submitRow.style.display = hasItems ? "flex" : "none";

  console.log(
    `🧾 Button state: footer=${readyToSubmit ? "✅" : "❌"} | total=${total} | items=${hasItems}`
  );
}

// 🧾 Final sale submission button
document.getElementById("submit-sale")?.addEventListener("click", submitSale);

// ===========================================================
// 🧾 SUBMIT SALE — POST TO BACKEND (CORS-SAFE, AUTO-SYNC)
// ===========================================================
async function submitSale() {
  try {
    const emailEl = document.getElementById("customer-email");
    const discountInput = document.getElementById("discount-input");
    const originalInvoiceInput = document.getElementById("original-invoice");
    const tableBody = document.getElementById("receipt-details");

    const email = (emailEl?.value || "").trim();
    const subscribe = document.getElementById("email-toggle")?.checked ? "Yes" : "No";
    const discountPercent = parseFloat(discountInput?.value || 0);
    const originalInvoice = (originalInvoiceInput?.value || "").trim();

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

    // ---------- Map table rows ----------
    const rows = Array.from(tableBody.querySelectorAll("tr"))
      // only send new or return lines, not old dimmed originals
      .filter(row => !row.classList.contains("original-item"))
      .map(row => {
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
          "Stable Sku": sku.split("-")[0],
          "Product Title": name,
          Quantity: qty,
          Price: price,                        // single clean price field
          Subtotal: subtotal,
          Tax: tax,
          Total: window.returnMode ? -Math.abs(total) : total,
          Discount: discountPercent,
          "Invoice #": window.nextInvoiceNumber || "TEMP",
          Email: email,
          Subscribe: subscribe,
          Payment: paymentType,
          CashPaid: cashPaid,
          CardPaid: cardPaid,
          Paid: totalPaid.toFixed(2),
          ReturnMode: !!window.returnMode,
          ReturnCondition:
            row.querySelector(".return-condition-row")?.value ||
            document.getElementById("return-condition")?.value ||
            "",
          OriginalInvoice: originalInvoice || "",
          "Transaction Type": window.returnMode ? "Return" : "Sale",
          Mode: "saleEntry"
        };
      });

    if (!rows.length) {
      alert("🧾 Add at least one product before submitting!");
      return;
    }

    console.log("POST →", SHEET_API, rows);

    // ---------- Send to backend ----------
    const res = await fetch(SHEET_API, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(rows),
    });

    const text = await res.text();
    const json = (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })();

    if (!res.ok || !json.success) {
      console.error("POST failed:", res.status, json);
      alert(`⚠️ Sync failed (${json.error || res.status}). Check console.`);
      return;
    }

    console.log("✅ Backend response:", json);
    alert(json.message || "✅ Sale recorded successfully!");
    updateInvoiceNumber();

    // ---------- Reset UI ----------
    document.getElementById("receipt-details").innerHTML = "";
    document.getElementById("submit-row")?.classList.add("hidden");
    document.getElementById("amount-paid-display").textContent = "$0.00";
    document.getElementById("change-amount").textContent = "$0.00";
    document.getElementById("split-info").textContent = "None";
    if (emailEl) emailEl.value = "";
    if (discountInput) discountInput.value = "";
    if (originalInvoiceInput) originalInvoiceInput.value = "";
    document.getElementById("return-condition-row")?.classList.add("hidden");

    if (typeof setReturnMode === "function") setReturnMode(false);
    if (typeof updateTotals === "function") updateTotals();

    window.cashMemory = 0;
    window.cardMemory = 0;

    resetOrder(false);
    await loadProductCatalog();

    console.log("✅ Sale complete, UI cleared for next entry.");
  } catch (err) {
    console.error("❌ Error posting sale:", err);
    alert("⚠️ Could not sync sale. Check console for details.");
  }
}

// Bind event
document.getElementById("submit-sale")?.addEventListener("click", submitSale);

// ===========================================================
// 🧹 TOOLBAR TRASH → FULL RESET
// ===========================================================
const trashBtn = document.getElementById("reset-order-btn");
if (trashBtn) {
  trashBtn.addEventListener("click", () => {
    console.log("🗑️ Trash clicked — attempting reset...");
    if (typeof resetOrder === "function") {
      resetOrder(true);
      toggleSubmitButton?.();
      console.log("✅ POS cleared successfully.");
    } else {
      console.error("❌ resetOrder() missing or not global.");
    }
  });
} else {
  console.warn("⚠️ Trash button not found in DOM");
}


// ===========================================================
// 🧹 FULL RESET (Safe After Invoice Lookup or Sale Completion)
// ===========================================================
function resetOrder(full = true) {
  console.log("🧹 Performing full POS reset...");

  // 🧾 Clear receipt table
  const tableBody = document.getElementById("receipt-details");
  if (tableBody) tableBody.innerHTML = "";

  // 💸 Reset payment memory
  window.cashMemory = 0;
  window.cardMemory = 0;
  window.cashDraft = "0";
  window.cardDraft = "0";

  // 💬 Reset text displays
  const resetText = (id, val = "$0.00") => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  [
    "subtotal-summary",
    "tax-summary",
    "grandtotal-summary",
    "amount-paid-display",
    "change-amount",
    "return-total",
    "original-total",
  ].forEach(id => resetText(id));

  // 🧮 Reset labels + split info
  const splitInfo = document.getElementById("split-info");
  if (splitInfo) splitInfo.textContent = "None";

  const balanceLabel = document.getElementById("balance-label");
  const balanceAmount = document.getElementById("balance-amount");
  if (balanceLabel) balanceLabel.textContent = "Even Exchange:";
  if (balanceAmount) balanceAmount.textContent = "$0.00";

  // 💬 Reset discount, return condition, and email
  const discountInput = document.getElementById("discount-input");
  const returnCondition = document.getElementById("return-condition");
  const emailInput = document.getElementById("customer-email");
  const emailToggle = document.getElementById("email-toggle");
  if (discountInput) discountInput.value = "";
  if (returnCondition) returnCondition.value = "";
  if (emailInput) emailInput.value = "";
  if (emailToggle) emailToggle.checked = true;

  // 🔍 Reset invoice-related data
  const invoiceSearchInput = document.getElementById("invoice-search-input");
  const invoiceResult = document.getElementById("invoice-result");
  const invoiceNumber = document.getElementById("invoice-number");
  const originalInvoiceInput = document.getElementById("original-invoice");
  const linkedInvoice = document.getElementById("linked-invoice-number");
  const returnSummaryRow = document.getElementById("return-summary-row");

  if (invoiceSearchInput) invoiceSearchInput.value = "";
  if (invoiceResult) invoiceResult.innerHTML = "";
  if (originalInvoiceInput) originalInvoiceInput.value = "";
  if (linkedInvoice) linkedInvoice.textContent = "";
  if (returnSummaryRow) returnSummaryRow.classList.add("hidden");
  if (invoiceNumber) invoiceNumber.textContent = "Invoice #Loading...";

  // 🔁 Disable Return Mode
  if (typeof setReturnMode === "function") setReturnMode(false);

  // 🧾 Refresh invoice number + totals
  if (typeof updateInvoiceNumber === "function") updateInvoiceNumber();
  if (typeof updateTotals === "function") updateTotals();

  // 🔘 Hide submit button
  const submitRow = document.getElementById("submit-row");
  if (submitRow) submitRow.classList.add("hidden");

  console.log("✅ POS reset complete — ready for next order.");

  // 🟦 Optional: focus back to search
  setTimeout(() => {
    document.getElementById("invoice-search-input")?.focus();
  }, 200);
}
window.resetOrder = resetOrder; // ✅ make it global

// ===========================================================
// 🚀 INIT
// ===========================================================
await updateInvoiceNumber(); // 🧾 show invoice number on load
await loadProductCatalog();
console.log("✅ Kinaya POS ready.");
}); // ✅ closes document.addEventListener("DOMContentLoaded", async () => {


