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
    "https://script.google.com/macros/s/AKfycbxDzflmDmWiP8qzTUKhKdsdWSL_ZOaRnA8sRrmJ0Qj8yPXm1hya6dWvq-BoJW25NntLLA/exec"; // 🔹 Replace if redeployed

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
// 🔔 UNIVERSAL TOAST MESSAGE — Lightweight visual feedback
// ===========================================================
function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 3rem;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,198,255,0.15);
    border: 1px solid #00c6ff;
    color: #bffcff;
    font-family: 'Audiowide', sans-serif;
    padding: 0.6rem 1.4rem;
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
// 🔒 PRODUCT GRID LOCK SYSTEM
// ===========================================================
function setGridLock(state) {
  const overlay = document.getElementById("menu-lock-overlay");
  const grid = document.getElementById("menu-section");

  if (state) {
    overlay?.classList.remove("hidden");
    grid?.classList.add("locked");
  } else {
    overlay?.classList.add("hidden");
    grid?.classList.remove("locked");
  }

  console.log(`🌿 Menu grid ${state ? "locked" : "unlocked"}`);
}

// 🔘 Unlock button event
document.getElementById("unlock-grid-btn")?.addEventListener("click", () => {
  const confirmUnlock = confirm("Unlock product grid to add items?");
  if (confirmUnlock) setGridLock(false);
});

// ===========================================================
// 🔢 INVOICE NUMBER
// ===========================================================
async function updateInvoiceNumber() {
  try {
    const invoiceNumEl = document.getElementById("invoice-number");
    const res = await fetch(`${SHEET_API}?mode=nextInvoice`, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const result = await res.json();
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
}

// ✅ Add optional "Next →" navigation
if (document.getElementById("invoice-number")) {
  const topInvoiceEl = document.getElementById("invoice-number");
  const nextSpan = document.createElement("span");
  nextSpan.innerHTML = `&nbsp;<span style="color:#66caff;cursor:pointer;">→ Next</span>`;
  nextSpan.onclick = () => {
    document.getElementById("invoice-search-input").value =
      window.nextInvoiceNumber || "";
    document.getElementById("invoice-search-btn").click();
  };
  topInvoiceEl.appendChild(nextSpan);
}

// ===========================================================
// 🌿 FETCH ORIGINAL SALE DATA — Sales Log Reference
// ===========================================================
async function fetchOriginalInvoiceData(invoiceId) {
  try {
    const SHEET_API =
       "https://script.google.com/macros/s/AKfycbxDzflmDmWiP8qzTUKhKdsdWSL_ZOaRnA8sRrmJ0Qj8yPXm1hya6dWvq-BoJW25NntLLA/exec"; // 🔹 Replace if redeployed

    const res = await fetch(`${SHEET_API}?mode=invoice&id=${invoiceId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const records = Array.isArray(json.data) ? json.data : json;

    if (!records || !records.length)
      throw new Error("Invoice not found in Sales Log.");

    const total = records.reduce(
      (sum, r) => sum + (parseFloat(r.Total) || 0),
      0
    );
    const paid = parseFloat(records[0]?.Paid || total) || 0;

    console.log(
      `📊 Sales Log totals: Total=$${total.toFixed(2)} | Paid=$${paid.toFixed(2)}`
    );
    return { total, paid };
  } catch (err) {
    console.error("❌ Error reading Sales Log:", err);
    return { total: 0, paid: 0 };
  }
}

// ===========================================================
// 🔎 INVOICE SEARCH — Load & Render Invoice
// ===========================================================
document
  .getElementById("invoice-search-btn")
  ?.addEventListener("click", async () => {
    const id = document.getElementById("invoice-search-input").value.trim();
    const resultDiv = document.getElementById("invoice-result");
    const tableBody = document.getElementById("receipt-details");

    if (!id) return alert("Enter an invoice number.");

    try {
      const res = await fetch(`${SHEET_API}?mode=invoice&id=${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const data = Array.isArray(json.data) ? json.data : json;

      if (!data || data.length === 0) {
        resultDiv.innerHTML = `<p style="color:red;">❌ No record found for Invoice #${id}</p>`;
        return;
      }
      

      // =======================================================
      // 🧾 BUILD RECEIPT TABLE
      // =======================================================
      tableBody.innerHTML = data
        .map(
          (r) => `
        <tr data-sku="${r.Sku || ""}">
          <td>${r["Product Title"] || "Unknown"}</td>
          <td class="qty">${r.Quantity || 0}</td>
          <td>$${parseFloat(r.Price || 0).toFixed(2)}</td>
          <td class="subtotal">$${parseFloat(r.Subtotal || 0).toFixed(2)}</td>
          <td><button class="del-btn"><i class="fas fa-trash"></i></button></td>
        </tr>`
        )
        .join("");

      tableBody.querySelectorAll("tr").forEach((row) => {
        row.classList.add("original-item");
        row.style.opacity = "0.8";
        row.style.borderLeft = "2px solid rgba(102,202,255,0.3)";
      });

      // =======================================================
      // 🌿 Dim images + hide trash can for loaded (locked) items
      // =======================================================
      tableBody.querySelectorAll("tr").forEach((row) => {
        // Add a "dimmed" class for CSS control
        row.classList.add("dimmed");

        // Find the image and trash button if they exist
        const img = row.querySelector("img");
        const trash = row.querySelector(".del-btn, .trash-icon, .fa-trash");

        // Dim the product image only
        if (img) {
          img.style.opacity = "0.4";
          img.style.filter = "grayscale(60%)";
        }

        // Hide the trash can completely
        if (trash) {
          trash.style.display = "none";
        }
      });


      // =======================================================
      // 💰 UPDATE MAIN SUMMARY (Dynamic Recalculation)
      // =======================================================
      const records = Array.isArray(data) ? data : [];
      const first = records[0] || {};

      function parseMoney(value) {
        if (!value) return 0;
        const cleaned = String(value).replace(/[^\d.-]/g, "");
        return parseFloat(cleaned) || 0;
      }

      let subtotal = 0;
      let tax = 0;
      let total = 0;

      records.forEach((r) => {
        subtotal += parseMoney(r["Subtotal"] || r["Sub Total"] || 0);
        tax += parseMoney(r["Tax"] || 0);
        total += parseMoney(r["Total"] || r["Grand Total"] || 0);
      });

      if (total === 0) total = subtotal + tax;

      let paid =
        parseMoney(first["Amount Paid"] || first["Paid"] || first["Payment"]) ||
        0;
      if (paid === 0) paid = total;
      const change = Math.max(paid - total, 0);

      const payment = first["Payment"] || first["Payment Method"] || "N/A";
      const email = first["Email"] || "";

      const safeSet = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };

      safeSet("subtotal-summary", `$${subtotal.toFixed(2)}`);
      safeSet("tax-summary", `$${tax.toFixed(2)}`);
      safeSet("grandtotal-summary", `$${total.toFixed(2)}`);
      safeSet("amount-paid-display", `$${paid.toFixed(2)}`);
      safeSet("change-amount", `$${change.toFixed(2)}`);
      safeSet("split-info", payment);

      const emailEl = document.getElementById("customer-email");
      if (emailEl) emailEl.value = email;

      const amountPaidEl = document.getElementById("amount-paid-display");
      if (amountPaidEl) amountPaidEl.dataset.originalPaid = paid;

      // ===========================================================
      // 💾 LOCK TRUE ORIGINAL GRAND TOTAL (e.g., $23.54)
      // ===========================================================
      const grandEl = document.getElementById("grandtotal-summary");
      const origEl = document.getElementById("original-total");

      if (grandEl && origEl) {
        const grandValue = parseFloat(grandEl.textContent.replace(/[^0-9.]/g, "")) || 0;

        // Store and visually show the original total
        origEl.dataset.originalGrand = grandValue.toFixed(2);
        origEl.textContent = `$${grandValue.toFixed(2)}`;

        // Mark as locked
        window.originalGrandLocked = true;
        console.log(`💾 Locked TRUE original invoice total: $${grandValue.toFixed(2)}`);
      }

      // =======================================================
      // 💬 FEEDBACK + LINK ROW
      // =======================================================
      resultDiv.innerHTML = `<p style="color:lightgreen;">✅ Invoice #${id} loaded successfully.</p>`;

      const linkRow = document.getElementById("linked-invoice-row");
      if (linkRow) {
        linkRow.classList.remove("hidden");
        linkRow.innerHTML = `
          <small style="color:#66caff;cursor:pointer;text-decoration:underline;">
            View Original Invoice #${id}
          </small>`;
        linkRow.onclick = () => {
          document.getElementById("invoice-search-input").value = id;
          document.getElementById("invoice-search-btn").click();
        };
      }

      const originalInvoiceInput = document.getElementById("original-invoice");
      if (originalInvoiceInput) originalInvoiceInput.value = id;

      console.log(
      `🧾 Invoice ${id} loaded in view-only mode. Ready for return toggle.`
    );
    showReturnSummary(id);

    } catch (err) {
      console.error("❌ Invoice lookup failed:", err);
      resultDiv.innerHTML = `<p style="color:red;">⚠️ Error fetching invoice details. Check console.</p>`;
    }
    // After searching an invoice (review mode)
      // await handleInvoiceSearch(id);
      setGridLock(true);
  });

// ===========================================================
// 🧾 SUMMARY VISIBILITY CONTROLLER (independent of Return Mode)
// ===========================================================
function showReturnSummary(invoiceId) {
  const summaryRow = document.getElementById("return-summary-row");
  const linkedEl   = document.getElementById("linked-invoice-number");
  const originalEl = document.getElementById("original-total");
  const grandEl    = document.getElementById("grandtotal-summary");

  if (!summaryRow || !linkedEl || !originalEl || !grandEl) return;

  // Always show summary immediately after invoice loads
  summaryRow.classList.remove("hidden");
  summaryRow.style.display = "table-row";
  summaryRow.style.opacity = "1";

  // Fill in current info
  linkedEl.textContent = `#${invoiceId || "—"}`;
  const grand = parseFloat((grandEl.textContent || "").replace(/[^0-9.]/g, "")) || 0;
  originalEl.textContent = `$${grand.toFixed(2)}`;

  console.log(`💾 Summary shown independently for invoice #${invoiceId}, total $${grand.toFixed(2)}`);
}


// ===========================================================
// 🔁 RETURN MODE TOGGLE — Show Summary + Move Totals
// ===========================================================
document.getElementById("return-toggle-btn")?.addEventListener("click", () => {
  console.log("🔁 Return Mode ENABLED");

  // ----- Core Elements -----
  const summaryRow = document.getElementById("return-summary-row");
  const origTotalEl = document.getElementById("original-total");
  const linkedNum = document.getElementById("linked-invoice-number");
  const returnTotalEl = document.getElementById("return-total");
  const refundInput = document.getElementById("refund-amount");

  // ----- Active Totals -----
  const subEl = document.getElementById("subtotal-summary");
  const taxEl = document.getElementById("tax-summary");
  const grandEl = document.getElementById("grandtotal-summary");
  const paidEl = document.getElementById("amount-paid-display");
  const changeEl = document.getElementById("change-amount");

  // ✅ Parse the visible Grand Total from DOM
  const oldTotal = parseFloat(
    (grandEl?.textContent || "").replace(/[^0-9.-]/g, "")
  ) || 0;

  if (oldTotal === 0) {
    console.warn("⚠️ No grand total detected; cannot start return mode.");
    return;
  }

  // ✅ Reveal the Return Summary section
  if (summaryRow) {
    summaryRow.classList.remove("hidden");
    summaryRow.style.opacity = "1";
    summaryRow.style.display = "table-row";
  }

  // ✅ Move the old total into Return Summary
  if (origTotalEl) {
    origTotalEl.textContent = `$${oldTotal.toFixed(2)}`;
    origTotalEl.dataset.sourceGrand = oldTotal.toFixed(2);
    origTotalEl.style.color = "#A7E1EE";
    origTotalEl.style.opacity = "1";
  }

  // ✅ Copy the invoice number into summary
  const id = document.getElementById("invoice-search-input")?.value.trim();
  if (linkedNum) linkedNum.textContent = `#${id || "—"}`;

  // ✅ Reset all current totals for clean return input
  [subEl, taxEl, grandEl, paidEl, changeEl].forEach((el) => {
    if (el) {
      el.textContent = "$0.00";
      el.style.opacity = "0.6";
      el.style.fontStyle = "italic";
    }
  });

  // ✅ Initialize return tracking
  if (returnTotalEl) returnTotalEl.textContent = "$0.00";
  if (refundInput) refundInput.value = "0";

  // ✅ Add red visual cue for active return mode
  const panel = document.querySelector(".receipt");
  if (panel) {
    panel.style.boxShadow = "0 0 25px rgba(255, 90, 90, 0.35)";
    panel.style.borderColor = "rgba(255, 90, 90, 0.35)";
  }

  console.log(
    `🔁 Return Mode Active | Original Total: $${oldTotal.toFixed(2)}`
  );

  // Store that we’re in return mode
  window.returnMode = true;
});

// ===========================================================
// 🔄 AUTO-CALCULATE RETURN TOTALS (Live Updates)
// ===========================================================
function updateReturnTotal() {
  if (!window.returnMode) return;

  const rows = document.querySelectorAll(".receipt-table tr.return-item");
  const returnTotalEl = document.getElementById("return-total");
  const refundInput = document.getElementById("refund-amount");

  let returnTotal = 0;
  rows.forEach((row) => {
    const amount = parseFloat(
      (row.querySelector(".subtotal")?.textContent || "").replace(/[^0-9.-]/g, "")
    ) || 0;
    returnTotal += amount;
  });

  if (returnTotalEl) returnTotalEl.textContent = `$${returnTotal.toFixed(2)}`;
  if (refundInput) refundInput.value = returnTotal.toFixed(2);

  console.log(`↩️ Return total recalculated: $${returnTotal.toFixed(2)}`);
}

// 🔁 Example trigger: whenever you add or remove return rows
document.addEventListener("click", (e) => {
  if (e.target.closest(".del-btn") && window.returnMode) {
    setTimeout(updateReturnTotal, 200);
  }

// ===========================================================
// 🧊 KEEP ORIGINAL GRAND TOTAL FROZEN
// ===========================================================
const origTotalEl = document.getElementById("original-total");
if (origTotalEl && window.originalGrandLocked) {
  const lockedGrand = parseFloat(origTotalEl.dataset.originalGrand || 0);
  origTotalEl.textContent = `$${lockedGrand.toFixed(2)}`;
}
});

// You can also call `updateReturnTotal()` manually after adding each return SKU

// ===========================================================
// 🔁 LOAD PRODUCT CATALOG (deduplicates to newest version)
// ===========================================================
async function loadProductCatalog() {
  try {
    const res = await fetch(`${SHEET_API}?mode=pos`);
    const json = await res.json();

    const raw =
      json.data || json.records || json.values || json.products || json.items || json;

    // 🧩 Normalize sheet headers → consistent JS keys
    const normalized = raw.map((r) => {
      const clean = {};
      for (const k in r) clean[k.trim().toLowerCase()] = r[k];
      return {
        sku: clean["sku"] || "",
        name: clean["product title"] || "Unnamed Product",
        image:
          clean["image link"] ||
          clean["image"] ||
          clean["image url"] ||
          "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/default.png",
        retailPrice: parseFloat(clean["retail price"] || 0),
        discountPrice: parseFloat(clean["sale price"] || 0),
        cost: parseFloat(clean["unit cost"] || 0),
        stock: parseFloat(clean["in stock"] || 0),
        timestamp: new Date(clean["timestamp"] || 0).getTime() || 0,
        vendor: clean["vendor"] || "",
        description: clean["description"] || "",
        status: clean["status"] || "Active",
      };
    });

    // 🌿 Keep only the most recent entry per SKU
    const latestOnly = Object.values(
      normalized.reduce((acc, item) => {
        const existing = acc[item.sku];
        if (!existing || item.timestamp > existing.timestamp) {
          acc[item.sku] = item;
        }
        return acc;
      }, {})
    );

    console.log(
      `✅ Found ${latestOnly.length} latest products (deduplicated from ${normalized.length})`
    );

    // ✅ Render the deduped product list
    renderProducts(latestOnly);
  } catch (err) {
    console.error("❌ Failed to load or deduplicate catalog:", err);
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
// 🛍️ RENDER PRODUCTS — Grid + Click to Add to Receipt
// ===========================================================
function renderProducts(products) {
  const menu = document.getElementById("menu");
  if (!menu) return;

  // 🔹 Normalize product data
  const normalized = products.map((p) => {
    const sale =
      parseFloat(p.discountPrice || p["Sale Price"] || 0) || 0;
    const retail =
      parseFloat(p.retailPrice || p["Retail Price"] || 0) || 0;
    const final = sale > 0 && sale < retail ? sale : retail;

    return {
      sku: p.sku || p.Sku || "",
      name: p.name || p["Product Title"] || "Unnamed Product",
      salePrice: sale,
      retailPrice: retail,
      price: final,
      image:
        p.image ||
        p["Image Link"] ||
        p.Image ||
        "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/default.png",
    };
  });

  // 🔹 Build product grid
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
              p.salePrice > 0 && p.salePrice < p.retailPrice
                ? `<span style="color:#bffcff;">$${p.salePrice.toFixed(2)}</span>
                   <span style="text-decoration:line-through; color:#888; margin-left:4px;">$${p.retailPrice.toFixed(2)}</span>`
                : `<span style="color:#bffcff;">$${p.retailPrice.toFixed(2)}</span>`
            }
          </figcaption>
        </figure>`
    )
    .join("");

  // inside renderProducts(), replace the existing .menu-item click binding:
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", (ev) => {
      const name   = item.dataset.name;
      const sku    = item.dataset.sku;
      const retail = parseFloat(item.dataset.retail || "0");
      const sale   = parseFloat(item.dataset.sale   || "0");

      // unit price helper you already have:
      const unitPrice = getActiveUnitPrice(sale, retail);

      // Default in Return Mode = RETURN (-1). Hold Shift to ADD (+1).
      const isReturnMode = !!window.returnMode;
      const wantsAdd = isReturnMode && ev.shiftKey;   // Shift = add/exchange
      const qtyChange = isReturnMode
        ? (wantsAdd ? +1 : -1)
        : +1;

      if (typeof updateReceipt === "function") {
        updateReceipt({ name, sku, price: unitPrice, qtyChange });
        showToast(
          `${name} ${qtyChange > 0 ? (isReturnMode ? "added (exchange)" : "added") : "returned"}.`
        );
      } else {
        console.warn("⚠️ updateReceipt() missing — cannot modify receipt.");
      }
    });
  });

  console.log(`✅ Rendered ${normalized.length} products.`);
}

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
  // Detect whether the receipt already has items
  const hasActiveItems =
    (Array.isArray(window.cartItems) && window.cartItems.length > 0) ||
    document.querySelectorAll("#receipt-details tr:not(.original-item)").length > 0;

  // 1️⃣ If we’ve already *left* return mode once, don’t allow re-entry
  if (window.leftReturnMode && state === true) {
    alert("⚠️ You can’t re-enter Return Mode after leaving it. Please complete or clear this transaction first.");
    return;
  }

  // 2️⃣ If we’re trying to switch mid-session (with items already present)
  //     — but this is the *first* time leaving Return Mode — allow it.
  if (hasActiveItems && window.returnMode !== state) {
    if (window.returnMode && !window.leftReturnMode && state === false) {
      // 👇 This is the *one allowed* exit from Return Mode
      window.leftReturnMode = true;
      console.log("🟩 Exiting Return Mode once — allowed for exchange/sale items.");
    } else {
      alert("⚠️ You already have an active transaction. Please complete or clear it before switching modes.");
      return;
    }
  }

  // 3️⃣ Once items exist, lock session mode so it can’t reset
  if (hasActiveItems) window.activeSessionLocked = true;

  // ✅ Proceed with your existing UI + logic
  window.returnMode = state;
  sessionStorage.setItem("returnMode", state ? "true" : "false");
  document.body.classList.toggle("return-active", state);

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
  if (discountRow) discountRow.classList.toggle("hidden", state);

  // ---------- 4️⃣ KEEP ORIGINAL RECEIPT IN VIEW + RESET TOTALS ----------
  if (tableBody) {
    if (state) {
      // 🟥 ENTERING RETURN MODE
      console.log("↩️ Entering Return Mode — dim originals and reset totals");

      // 1️⃣ Dim existing rows
      tableBody.querySelectorAll("tr").forEach(row => {
        row.classList.add("original-item");
        row.style.opacity = "0.6";
        row.style.color = "#A7E1EE";
        row.style.borderLeft = "2px solid rgba(102,202,255,0.3)";
      });

      // 2️⃣ Reset live totals
      const subEl = document.getElementById("subtotal-summary");
      const taxEl = document.getElementById("tax-summary");
      const grandEl = document.getElementById("grandtotal-summary");
      const paidEl = document.getElementById("amount-paid-display");
      const changeEl = document.getElementById("change-amount");

      [subEl, taxEl, grandEl, paidEl, changeEl].forEach(el => {
        if (el) {
          el.textContent = "$0.00";
          el.style.opacity = "0.6";
          el.style.fontStyle = "italic";
        }
      });

      // ✅ Freeze the Original Total (always show locked grand total)
      const origTotalEl = document.getElementById("original-total");
      if (origTotalEl) {
        let locked = parseFloat(origTotalEl.dataset.originalGrand || 0);

        // 🧊 Fallback: if not already locked, use the last grandtotal-summary
        if (!locked || locked === 0) {
          const grandDisplay = document.getElementById("grandtotal-summary");
          if (grandDisplay) {
            locked = parseFloat(
              grandDisplay.textContent.replace(/[^0-9.]/g, "")
            ) || 0;
            origTotalEl.dataset.originalGrand = locked.toFixed(2);
            window.originalGrandLocked = true;
          }
        }

        origTotalEl.textContent = `$${locked.toFixed(2)}`;
        origTotalEl.style.opacity = "0.9";
        console.log(`🔒 Preserved original grand total: $${locked.toFixed(2)}`);
      }

      // 3️⃣ Visual cue
      const panel = document.querySelector(".receipt");
      if (panel) {
        panel.style.boxShadow = "0 0 25px rgba(255,90,90,0.25)";
        panel.style.borderColor = "rgba(255,90,90,0.25)";
      }

      // 4️⃣ Small helper tip
      const banner = document.getElementById("return-mode-banner");
      if (banner && !banner.querySelector(".exchange-tip")) {
        const tip = document.createElement("div");
        tip.className = "exchange-tip";
        tip.style.color = "#A7E1EE";
        tip.style.fontSize = "0.85em";
        tip.style.marginTop = "0.25rem";
        banner.appendChild(tip);
      }

    } else {
      // 🟩 EXITING RETURN MODE
      console.log("↩️ Exiting Return Mode — restore colors");

      tableBody.querySelectorAll("tr").forEach(row => {
        if (row.classList.contains("return-line")) {
          row.style.color = "#ff8080";
        } else if (row.classList.contains("original-item")) {
          row.style.opacity = "0.6";
          row.style.color = "#A7E1EE";
        } else {
          row.style.opacity = "1";
          row.style.color = "#bffcff";
        }
      });

      const panel = document.querySelector(".receipt");
      if (panel) {
        panel.style.boxShadow = "";
        panel.style.borderColor = "";
      }

      document.querySelector(".exchange-tip")?.remove();
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
      priceLine.innerHTML = `<span style="color:#bffcff;">$${retailPrice.toFixed(2)}</span>`;
    } else {
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
// 🧾 RECEIPT HANDLER — Handles Sale, Return, and Exchange lines
// ===========================================================
function updateReceipt(product) {
  const tableBody = document.getElementById("receipt-details");
  if (!tableBody) return;

  // 🧮 Detect mode & direction
  const isReturnMode = !!window.returnMode;
  const qtyChange = product.qtyChange ?? (isReturnMode ? -1 : 1);

  // 🧩 Helper to find existing non-return rows
  const findExistingRow = (sku) =>
    Array.from(tableBody.children).find(
      (row) => row.dataset.sku === sku && !row.classList.contains("return-line")
    );

  // ===========================================================
  // 🌿 1️⃣ NORMAL SALE MODE
  // ===========================================================
  if (!isReturnMode) {
    const existing = findExistingRow(product.sku);
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

  // ===========================================================
  // 🟥 2️⃣ RETURN MODE — RETURN (qtyChange < 0)
  // ===========================================================
  else if (isReturnMode && qtyChange < 0) {
    const newRow = document.createElement("tr");
    newRow.dataset.sku = product.sku;
    newRow.classList.add("return-line");

    const negPrice = -Math.abs(product.price);

    newRow.innerHTML = `
      <td style="color:#ff5252;">${product.name}</td>
      <td class="qty" style="color:#ff5252;">${qtyChange}</td>
      <td style="color:#ff5252;">$${product.price.toFixed(2)}</td>
      <td class="subtotal" style="color:#ff5252;">$${(negPrice * Math.abs(qtyChange)).toFixed(2)}</td>
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
          console.log(`♻️ Item ${sku}: restocked to inventory.`);
          break;
        case "Damaged (unsellable)":
          console.log(`💔 Item ${sku}: marked damaged.`);
          break;
      }
    });

    tableBody.appendChild(newRow);
  }

  // ===========================================================
  // 🟦 3️⃣ RETURN MODE — ADDING NEW ITEM (qtyChange > 0)
  // ===========================================================
  else if (isReturnMode && qtyChange > 0) {
    const existing = findExistingRow(product.sku);
    if (existing) {
      const qtyCell = existing.querySelector(".qty");
      const subCell = existing.querySelector(".subtotal");
      const qty = parseInt(qtyCell.textContent) + qtyChange;
      qtyCell.textContent = qty;
      subCell.textContent = `$${(qty * product.price).toFixed(2)}`;
      existing.style.opacity = "1";
      existing.style.color = "#bffcff";
    } else {
      const newRow = document.createElement("tr");
      newRow.dataset.sku = product.sku;
      newRow.innerHTML = `
        <td style="color:#bffcff;">${product.name}</td>
        <td class="qty" style="color:#bffcff;">${qtyChange}</td>
        <td style="color:#bffcff;">$${product.price.toFixed(2)}</td>
        <td class="subtotal" style="color:#bffcff;">$${(product.price * qtyChange).toFixed(2)}</td>
        <td><button class="del-btn"><i class="fas fa-trash"></i></button></td>
      `;
      newRow.style.opacity = "1";
      newRow.style.color = "#bffcff";
      tableBody.appendChild(newRow);
    }
  }

  // ===========================================================
  // ♻️ FINALIZE — UPDATE TOTALS + BUTTON STATES
  // ===========================================================
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
// 🛡️ Preserve Original Grand Total — never overwrite after lock
// ===========================================================
const origTotalEl = document.getElementById("original-total");
if (origTotalEl && origTotalEl.dataset.originalGrand && window.originalGrandLocked) {
  // Do nothing — keep the locked total
} else if (origTotalEl && !origTotalEl.dataset.originalGrand) {
  // Fallback: if somehow unlocked, reinitialize it using current grand total
  const currentGrand = document.getElementById("grandtotal-summary");
  if (currentGrand) {
    const value = parseFloat(currentGrand.textContent.replace(/[^0-9.]/g, "")) || 0;
    origTotalEl.dataset.originalGrand = value.toFixed(2);
    origTotalEl.textContent = `$${value.toFixed(2)}`;
    window.originalGrandLocked = true;
    console.log(`🧊 Re-locked original total at $${value.toFixed(2)}`);
  }
}

// ===========================================================
// 💸 UNIVERSAL TOTAL CALCULATION — Bulletproof Lock for Original Grand
// ===========================================================
function updateTotals() {
  const tableBody = document.getElementById("receipt-details");
  if (!tableBody) return;

  // ===========================================================
  // 🛡️ STEP 1: Preserve Locked Original Grand Total
  // ===========================================================
  const origTotalEl = document.getElementById("original-total");
  let lockedGrand = 0;
  if (origTotalEl) {
    lockedGrand = parseFloat(origTotalEl.dataset.originalGrand || 0);
    if (window.originalGrandLocked && lockedGrand > 0) {
      // Freeze visual + data immediately before recalculation
      origTotalEl.textContent = `$${lockedGrand.toFixed(2)}`;
      origTotalEl.dataset.locked = "true";
      console.log(`🧊 Original total preserved at $${lockedGrand.toFixed(2)}`);
    }
  }

  // ===========================================================
  // 🧮 STEP 2: Standard Totals Calculation
  // ===========================================================
  const taxRate = window.taxEnabled ? (window.taxRate || 0.07) : 0;
  const discountPercent = parseFloat(document.getElementById("discount-input")?.value || 0);
  const amountPaidDisplay = document.getElementById("amount-paid-display");
  const originalPaidValue = parseFloat(amountPaidDisplay?.dataset.originalPaid || 0) || 0;

  let saleSubtotal = 0;
  let returnSubtotal = 0;

  tableBody.querySelectorAll("tr").forEach(row => {
    if (row.classList.contains("original-item")) return;

    const sub = parseFloat(
      row.querySelector(".subtotal")?.textContent.replace(/[^0-9.-]/g, "") || 0
    );

    if (sub >= 0) saleSubtotal += sub;
    else returnSubtotal += Math.abs(sub);
  });

  const discountAmount = saleSubtotal * (discountPercent / 100);
  const discountedSubtotal = saleSubtotal - discountAmount;
  const saleTax = discountedSubtotal * taxRate;
  const returnTax = returnSubtotal * taxRate;
  const newPurchases = discountedSubtotal + saleTax;
  const returns = returnSubtotal + returnTax;
  const netSessionTotal = newPurchases - returns;
  const grandTotal = netSessionTotal - originalPaidValue;

  // ===========================================================
  // 💬 STEP 3: Update UI Elements
  // ===========================================================
  const subtotalEl = document.getElementById("subtotal-summary");
  const taxEl = document.getElementById("tax-summary");
  const returnEl = document.getElementById("return-total");
  const grandEl = document.getElementById("grandtotal-summary");
  const balanceLabel = document.getElementById("balance-label");
  const balanceAmount = document.getElementById("balance-amount");

  if (subtotalEl) subtotalEl.textContent = `$${discountedSubtotal.toFixed(2)}`;
  if (taxEl) taxEl.textContent = `$${saleTax.toFixed(2)}`;
  if (returnEl) returnEl.textContent = `$${returns.toFixed(2)}`;
  if (grandEl) grandEl.textContent = `$${netSessionTotal.toFixed(2)}`;

  const totalPaid = (window.cashMemory + window.cardMemory) || 0;
  const change = Math.max(totalPaid - netSessionTotal, 0);
  if (amountPaidDisplay) amountPaidDisplay.textContent = `$${totalPaid.toFixed(2)}`;
  document.getElementById("change-amount").textContent = `$${change.toFixed(2)}`;

  // ===========================================================
  // ♻️ STEP 4: Refund / Balance Logic
  // ===========================================================
  let label = "Even Exchange:";
  let color = "#A7E1EE";

  if (grandTotal > 0.01) {
    label = "Balance Due:";
    color = "#4FD9FF";
  } else if (grandTotal < -0.01) {
    label = "Refund Due:";
    color = "#ff8080";
  }

  if (balanceLabel) balanceLabel.textContent = label;
  if (balanceAmount) {
    balanceAmount.style.color = color;
    balanceAmount.textContent = `$${Math.abs(grandTotal).toFixed(2)}`;
  }

  // ===========================================================
  // 🧊 STEP 5: Reapply Frozen Original Total After All Updates
  // ===========================================================
  if (origTotalEl && window.originalGrandLocked && lockedGrand > 0) {
    origTotalEl.textContent = `$${lockedGrand.toFixed(2)}`;
    origTotalEl.dataset.originalGrand = lockedGrand.toFixed(2);
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
    netSessionTotal,
    grandTotal,
    lockedGrand
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
  const isReturnMode = !!window.returnMode;

  // ===========================================================
  // 🧭 Logic: Sales vs Returns
  // ===========================================================
  let readyToSubmit = false;

  if (isReturnMode) {
    // 🔴 RETURN MODE → allow submission for ANY valid return (refund or balance owed)
    const refundOrBalance = total !== 0 && Math.abs(total) > 0.01;
    readyToSubmit = hasItems && validEmail && refundOrBalance;
  } else {
    // 🟢 SALE MODE → allow submission for any nonzero total (positive = sale, negative = owed/refund)
    const nonZeroMovement = total !== 0 && Math.abs(total) > 0.01;
    readyToSubmit = hasItems && validEmail && nonZeroMovement;
  }


  // ===========================================================
// 💳 Show / Hide Buttons — based on email + payment conditions
// ===========================================================
if (calcBtn) {
  // Only show Paypad if there are items and not in return mode
  calcBtn.style.display = (!isReturnMode && hasItems) ? "inline-flex" : "none";
}

if (footerBtn) {
  // 🧭 New: Ready when email is filled AND payment matches/exceeds total
  const emailFilled = email.length > 0 && validEmail;
  const paymentSufficient =
    (total > 0 && (cash + card) >= total) || // paid enough for sale
    (total < 0); // negative = refund / return

  const readyToSubmit = hasItems && emailFilled && paymentSufficient;

  footerBtn.style.display = readyToSubmit ? "inline-flex" : "none";
  footerBtn.disabled = !readyToSubmit;
}

submitRow.style.display = hasItems ? "flex" : "none";

console.log(
  `🧾 Button state: ${isReturnMode ? "Return" : "Sale"} | ready=${readyToSubmit ? "✅" : "❌"} | total=${total} | items=${hasItems} | payment=${cash + card} | email=${email}`
);

}

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
      // After submitting a sale or return
      setGridLock(true);
    }

    // ============================================================
    // 🧾 POST-MAPPING: Add mode + correct transaction info
    // ============================================================
    rows.forEach((r) => {
      // Always mark the mode for backend routing
      r.Mode = "saleEntry";

      // Grand total: negative for returns
      const total = parseFloat(r.Subtotal || 0) * 1.07; // include tax if needed
      r["Grand Total"] = window.returnMode
        ? -Math.abs(total.toFixed(2))
        : total.toFixed(2);

      // Transaction type based on return mode
      r["Transaction Type"] = window.returnMode ? "Return" : "Sale";
    });

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

    // ✅ Only call showReturnSummary if it actually exists
    if (typeof showReturnSummary === "function") {
      const invoiceId = window.nextInvoiceNumber || originalInvoice || "TEMP";
      showReturnSummary(invoiceId);
    }

    // ✅ Recalculate totals safely
    if (typeof updateTotals === "function") updateTotals();

    // ✅ Reset memory + refresh UI
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
// 🧹 CLEAR BUTTON HANDLER (Mobile/Desktop Safe)
// ===========================================================
const clearBtn = document.getElementById("clear-btn");
if (clearBtn) {
  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.target.blur(); // 🩵 removes stuck focus highlight on mobile
    resetOrder(true);
    showToast("Cleared all fields");
  });
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

  // After page refresh or new sale start
  setGridLock(false);

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

// // ===========================================================
// // 🪟 PRODUCT MODAL (MOBILE + DESKTOP SAFE)
// // ===========================================================
// document.addEventListener("DOMContentLoaded", () => {
//   const openMenuBtn = document.getElementById("open-menu-modal");
//   const closeMenuBtn = document.getElementById("close-menu-modal");
//   const menuModal = document.getElementById("menu-modal");
//   const modalMenuGrid = document.getElementById("modal-menu-grid");

//   if (!openMenuBtn || !menuModal || !modalMenuGrid) {
//     console.warn("🪟 Modal elements not found — skipping setup.");
//     return;
//   }

//   console.log("openMenuBtn found?", !!openMenuBtn);

//   // ===========================================================
//   // 📲 OPEN MODAL
//   // ===========================================================
//   openMenuBtn.addEventListener("click", () => {
//     console.log("🪟 View Products button clicked!");
//     menuModal.classList.add("active");
//     document.body.style.overflow = "hidden";

//     // 🔁 Copy existing product cards
//     const menu = document.getElementById("menu");
//     if (menu && modalMenuGrid) {
//       modalMenuGrid.innerHTML = menu.innerHTML;
//       modalMenuGrid.querySelectorAll(".menu-item").forEach((item) => {
//         item.addEventListener("click", () => {
//           const name = item.dataset.name || "Unknown";
//           const sku = item.dataset.sku || "";
//           const retail = parseFloat(item.dataset.retail || "0");
//           const sale = parseFloat(item.dataset.sale || "0");
//           const price = (sale > 0 && sale < retail) ? sale : retail;
//           if (typeof updateReceipt === "function") updateReceipt({ name, sku, price, qtyChange: 1 });
//         });
//       });
//     }
//   });

//   // ===========================================================
//   // ❌ CLOSE MODAL
//   // ===========================================================
//   closeMenuBtn.addEventListener("click", () => {
//     menuModal.classList.remove("active");
//     document.body.style.overflow = "";
//   });

//   document.addEventListener("DOMContentLoaded", () => {
//   const openMenuBtn = document.getElementById("open-menu-modal");
//   const menuModal = document.getElementById("menu-modal");
//   const closeMenuBtn = document.getElementById("close-menu-modal");

//   if (!openMenuBtn || !menuModal) {
//     console.warn("Modal elements not found");
//     return;
//   }

//   openMenuBtn.addEventListener("click", () => {
//     console.log("🪟 Opening modal...");
//     menuModal.classList.add("active");
//     document.body.style.overflow = "hidden";
//   });

//   closeMenuBtn?.addEventListener("click", () => {
//     menuModal.classList.remove("active");
//     document.body.style.overflow = "";
//   });
// });

// });

}); // ✅ closes document.addEventListener("DOMContentLoaded", async () => {

 
