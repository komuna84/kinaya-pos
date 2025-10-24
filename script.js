// ===========================================================
// Kinaya Rising POS (Stable October 2025) — FINAL BUILD
// ===========================================================

// ---------- HEADER DATE ----------
document.addEventListener("DOMContentLoaded", () => {
  const dateEl = document.getElementById("current-date");
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
});

// ===========================================================
// SESSION CHECK
// ===========================================================
if (sessionStorage.getItem("posUnlocked") !== "true") {
  window.location.href = "index.html";
}

// ===========================================================
// CORE ORDER MODEL
// ===========================================================
class Order {
  constructor() {
    this._menu = [];
    this._order = [];
    this._payment = { cash: 0, card: 0 };
  }

  set menu(rows) {
    this._menu = [];
    if (!rows || rows.length < 2) return;

    const headers = rows[0].map(h =>
      String(h || "")
        .replace(/^\uFEFF/, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
    );

    const findIndex = name => headers.findIndex(h => h.includes(name.toLowerCase()));
    const col = {
      sku: findIndex("sku"),
      title: findIndex("product"),
      image: findIndex("image"),
      price: findIndex("price"),
      vendor: findIndex("vendor"),
      status: findIndex("status"),
    };

    rows.slice(1).forEach(r => {
      const get = j => (j >= 0 ? String(r[j] || "").trim() : "");
      const sku = get(col.sku);
      const title = get(col.title);
      const image = get(col.image);
      const vendor = get(col.vendor);
      const status = get(col.status).toLowerCase();
      const rawPrice = get(col.price).replace(/[^\d.]/g, "");
      const price = parseFloat(rawPrice) || 0;

      if (!sku || !title || !image || price <= 0) return;
      if (status && !status.startsWith("active")) return;

      this._menu.push({ sku, description: title, image, vendor, price });
    });
  }

  get menu() {
    return this._menu;
  }

  addOrderLine(quantity, data, isReturn = false) {
  const lineData = JSON.parse(data);
  const sku = lineData.sku;
  const change = isReturn ? -Math.abs(quantity) : Math.abs(quantity);
  const existingLine = this._order.find(line => line.sku === sku);

  if (existingLine) {
    existingLine.quantity += change;
    // Remove if quantity hits 0
    if (existingLine.quantity === 0) {
      this._order = this._order.filter(line => line.sku !== sku);
    } else {
      existingLine.subtotal = Utilities.roundToTwo(existingLine.quantity * existingLine.price);
      existingLine.tax = Utilities.roundToTwo(existingLine.subtotal * 0.07);
    }
  } else {
    // Create new line
    const currentLine = {
      sku,
      description: lineData.description,
      quantity: change,
      price: Utilities.roundToTwo(parseFloat(lineData.price)),
      subtotal: Utilities.roundToTwo(change * parseFloat(lineData.price)),
      tax: Utilities.roundToTwo(change * parseFloat(lineData.price) * 0.07),
    };
    this._order.push(currentLine);
  }

  Ui.receiptDetails(this);
  Ui.updateTotals(this);
  updatePaymentUI();
}
} 
  

// ===========================================================
// UTILITIES
// ===========================================================
class Utilities {
  static convertFloatToString(float) {
    const priceParams = { style: "currency", currency: "USD" };
    if (float < 0) return `(${Math.abs(float).toLocaleString("en-US", priceParams)})`;
    return float.toLocaleString("en-US", priceParams);
  }
  static roundToTwo(num) {
    return +(Math.round(num * 100) / 100);
  }
}

// ===========================================================
// CSV LOADER
// ===========================================================
async function loadMenuFromSheet(url) {
  const response = await fetch(url, { mode: "cors" });
  const text = await response.text();
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map(line => {
      const cells = [];
      let insideQuotes = false, current = "";
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && line[i + 1] === '"') {
          current += '"'; i++;
        } else if (ch === '"') {
          insideQuotes = !insideQuotes;
        } else if (ch === "," && !insideQuotes) {
          cells.push(current.trim()); current = "";
        } else {
          current += ch;
        }
      }
      cells.push(current.trim());
      return cells;
    });
  return rows;
}

// ===========================================================
// UI CLASS
// ===========================================================
class Ui {
  // 🌿 Render products into both desktop and mobile grids
  static renderMenu(orderInstance) {
    const grids = [
      document.getElementById("menu"),
      document.getElementById("overlay-grid")
    ].filter(Boolean);

    if (!grids.length) return;

    grids.forEach(grid => {
      grid.innerHTML = "";

      if (!orderInstance.menu.length) {
        grid.innerHTML = "<p style='color:white;text-align:center;'>No active products found.</p>";
        return;
      }

      const frag = document.createDocumentFragment();
      orderInstance.menu.forEach(item => {
        const figure = document.createElement("figure");
        figure.classList.add("menu-item");
        figure.setAttribute("data-sku", JSON.stringify(item));
        figure.innerHTML = `
          <img src="${item.image}" alt="${item.description}" class="menu-image"
               style="width:150px;height:150px;object-fit:cover;border-radius:12px;">
          <figcaption style="font-weight:bold;margin-top:8px;">${item.description}</figcaption>
          <figcaption style="font-size:0.9em;opacity:0.8;">${item.sku}</figcaption>
          <figcaption style="color:#A7E1EE;margin-top:4px;">
            ${Utilities.convertFloatToString(item.price)}
          </figcaption>
        `;
        frag.appendChild(figure);
      });
      grid.appendChild(frag);
    });
  }

  // 🌿 Receipt details rendering
  static receiptDetails(orderInstance) {
    const receiptDetails = document.getElementById("receipt-details");
    if (!receiptDetails) return;
    receiptDetails.innerHTML = "";

    if (!orderInstance._order.length) {
      receiptDetails.innerHTML = `<tr><td colspan="5" style="color:#aaa;text-align:center;">No items yet</td></tr>`;
      Ui.updateTotals(orderInstance);
      return;
    }

    orderInstance._order.forEach((line, i) => {
      const row = document.createElement("tr");
      const style = line.quantity < 0 ? "color:#e63946;font-weight:bold;" : "";
      row.innerHTML = `
        <td style="${style}">${line.description}</td>
        <td style="${style}">${line.quantity}</td>
        <td style="${style}">${Utilities.convertFloatToString(line.price)}</td>
        <td style="${style}">${Utilities.convertFloatToString(line.subtotal)}</td>
        <td class="delete" data-delete="${i}" title="Remove item"><i class="fas fa-backspace"></i></td>`;
      receiptDetails.appendChild(row);
    });

    Ui.attachDeleteHandlers(orderInstance);
    Ui.updateTotals(orderInstance);
  }

  // 🌿 Deletion handlers
  static attachDeleteHandlers(orderInstance) {
    document.querySelectorAll(".delete").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const index = parseInt(btn.getAttribute("data-delete"));
        if (isNaN(index)) return;
        const line = orderInstance._order[index];
        if (!line) return;

        const change = isReturnMode ? -1 : 1;
        line.quantity -= change;

        if (line.quantity === 0) {
          orderInstance._order.splice(index, 1);
        } else {
          line.subtotal = Utilities.roundToTwo(line.quantity * line.price);
          line.tax = Utilities.roundToTwo(line.subtotal * 0.07);
        }

        Ui.receiptDetails(orderInstance);
        Ui.updateTotals(orderInstance);
        updatePaymentUI();
        toggleSubmitVisibility();
      });
    });
  }

  // 🌿 Totals update
  static updateTotals(orderInstance) {
    const subtotal = orderInstance._order.reduce((a, l) => a + l.subtotal, 0);
    const tax = orderInstance._order.reduce((a, l) => a + l.tax, 0);
    const grandTotal = subtotal + tax;
    const fmt = v => Utilities.convertFloatToString(v);

    const subtotalEl = document.getElementById("subtotal-summary");
    const overlaySubtotalEl = document.getElementById("overlay-subtotal-summary");
    const taxEl = document.getElementById("tax-summary");
    const grandEl = document.getElementById("grandtotal-summary");

    if (subtotalEl) subtotalEl.textContent = fmt(subtotal);
    if (overlaySubtotalEl) overlaySubtotalEl.textContent = fmt(subtotal);
    if (taxEl) taxEl.textContent = fmt(tax);
    if (grandEl) grandEl.textContent = fmt(grandTotal);
  }
}

// ===========================================================
// INIT
// ===========================================================
const sheetCsvUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT8TYrKVClp5GXP5Sx7NYGpfRvEMCCNuL40vbcyhdwP6bnvQeQRqJ4xTv6BZUnC5nm7N2N_KwQlHZ2H/pub?gid=30403628&single=true&output=csv";

const order = new Order();
let isReturnMode = false;

loadMenuFromSheet(sheetCsvUrl).then(rows => {
  order.menu = rows;
  Ui.renderMenu(order);
});

// ===========================================================
// SPLIT PAYMENT TRACKING
// ===========================================================
const splitInfoEl = document.getElementById("split-info");
const paymentTypeEl = document.getElementById("payment-type");
function updateSplitInfo(type) {
  if (splitInfoEl && paymentTypeEl) {
    splitInfoEl.textContent = type === "Split" ? "Cash + Card" : type || "None";
    paymentTypeEl.textContent = type || "—";
  }
}

// ===========================================================
// SUBMIT SALE
// ===========================================================
async function submitSale() {
  const { subtotal, tax, total } = (() => {
    const subtotal = order._order.reduce((s, l) => s + l.subtotal, 0);
    const tax = order._order.reduce((s, l) => s + l.tax, 0);
    return { subtotal, tax, total: subtotal + tax };
  })();

  const date = new Date().toLocaleDateString("en-US");
  const emailInput = document.getElementById("customer-email");
  const email = (emailInput && emailInput.value.trim()) || "";
  const isNoReceipt = ["no", "n/a", "none", "no receipt", "no email"].includes(email.toLowerCase());
  const subscribe = isNoReceipt ? "No" : "Yes";
  const split = splitInfoEl ? splitInfoEl.textContent.trim() : "";
  const invoice = Math.floor(Date.now() / 1000).toString().slice(-4);

  const rows = order._order.map(l => ({
    Date: date,
    Sku: l.sku,
    "Product Title": l.description,
    Quantity: l.quantity,
    Price: l.price,
    Subtotal: l.subtotal,
    Tax: l.tax,
    Total: Utilities.roundToTwo(l.subtotal + l.tax),
    "Invoice #": invoice,
    Email: email || "—",
    Subscribe: subscribe,
    Payment: split
  }));

  try {
    await fetch(
      "https://script.google.com/macros/s/AKfycbz1Z9NnfDCxWSxirvAE2tKK-mB9135X_uEuei2Wg-r-qptcpT2sNCPWObcGTbAibCZBFw/exec",
      {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows)
      }
    );

    alert("✅ Sale submitted successfully!");

    order._order = [];
    order._payment = { cash: 0, card: 0 };
    Ui.receiptDetails(order);
    Ui.updateTotals(order);
    updatePaymentUI(true);
    toggleSubmitVisibility();
    updateSplitInfo("None");
    if (emailInput) emailInput.value = "";
  } catch (err) {
    alert("⚠️ Error submitting sale: " + err.message);
    console.error(err);
  }
}
// ===========================================================
// BACKWARD COMPATIBILITY FIX — Needed by Order.addOrderLine()
// ===========================================================
function updatePaymentUI(reset = false) {
  if (reset) order._payment = { cash: 0, card: 0 };
  updatePaymentSummary();
}

function toggleSubmitVisibility() {
  const submitRow = document.getElementById("submit-row");
  if (!submitRow) return;

  const emailInput = document.getElementById("customer-email");
  const grandDisplay = document.getElementById("grandtotal-summary");

  const hasOrder = order._order.length > 0;
  const emailValue = (emailInput && emailInput.value.trim().toLowerCase()) || "";

  // ✅ Allow actual emails OR "no receipt" keywords
  const validEmail =
    emailValue.length > 0 &&
    (emailValue.includes("@") ||
      ["no", "none", "n/a", "no receipt", "no email"].includes(emailValue));

  const subtotalPaid = (order._payment.cash || 0) + (order._payment.card || 0);
  const grandText = grandDisplay ? grandDisplay.textContent.replace(/[^0-9.]/g, "") : "0";
  const grandTotal = parseFloat(grandText) || 0;

  // ✅ Only show button if all conditions are met
  const canSubmit = hasOrder && validEmail && subtotalPaid >= grandTotal;
  submitRow.style.display = canSubmit ? "block" : "none";
}

// 🔁 Auto-trigger when email changes
document.addEventListener("input", e => {
  if (e.target && e.target.id === "customer-email") {
    toggleSubmitVisibility();
  }
});


// ===========================================================
// SPLIT PAYMENT + PAYPAD (UPGRADED)
// ===========================================================
let grandTotal = 0;
let currentType = ""; // 'Cash' or 'Card'

function updatePaymentSummary() {
  const grandDisplay = document.getElementById("grandtotal-summary");
  const amountPaidEl = document.getElementById("amount-paid-input");
  const changeEl = document.getElementById("change-amount");
  const splitEl = document.getElementById("split-info");
  const paymentTypeEl = document.getElementById("payment-type");

  // --- get grand total ---
  let grandTotal = 0;
  if (grandDisplay) {
    const text = grandDisplay.textContent.replace(/[^0-9.]/g, "");
    grandTotal = parseFloat(text) || 0;
  }

  // --- calculate totals ---
  const cash = order._payment.cash || 0;
  const card = order._payment.card || 0;
  const subtotalPaid = cash + card;

  // --- update Amount Paid field ---
  if (amountPaidEl) amountPaidEl.value = subtotalPaid.toFixed(2);

  // --- determine payment type / split label ---
  let typeText = "—";
  let splitText = "None";
  if (cash && card) {
    typeText = "Split";
    splitText = "Cash + Card";
  } else if (cash) {
    typeText = "Cash";
    splitText = "Cash";
  } else if (card) {
    typeText = "Card";
    splitText = "Card";
  }

  if (paymentTypeEl) paymentTypeEl.textContent = typeText;
  if (splitEl) splitEl.textContent = splitText;

  // --- compute change or remaining ---
  const difference = subtotalPaid - grandTotal;
  if (changeEl) {
    if (subtotalPaid === 0) {
      changeEl.textContent = "$0.00";
    } else if (difference >= 0) {
      changeEl.textContent = `Change: $${difference.toFixed(2)}`;
    } else {
      changeEl.textContent = `Remaining: $${Math.abs(difference).toFixed(2)}`;
    }
  }

  toggleSubmitVisibility();
}

// ---------- SHOW PAYPAD ----------
function openPaypad(type) {
  currentPaymentType = type; // store active payment method
  if (!paypadOverlay) return;

  const owedEl = document.getElementById("paypad-owed");
  const grandEl = document.getElementById("grandtotal-summary");
  let owed = 0;
  if (grandEl) {
    owed = parseFloat(grandEl.textContent.replace(/[^0-9.]/g, "")) || 0;
  }
  if (owedEl) owedEl.textContent = `$${owed.toFixed(2)}`;

  paypadValue = "";
  paypadOverlay.classList.remove("hidden");
  updatePaypadDisplay();
}


// ---------- PAYPAD CORE ----------
const overlay = document.getElementById("payment-overlay");
const displayEl = document.getElementById("paypad-display");
const buttons = document.querySelectorAll(".paypad-btn");
const closeBtn = document.getElementById("close-paypad-btn");
let buffer = "";

function formatCurrency(val) {
  return `$${(parseFloat(val) || 0).toFixed(2)}`;
}

function renderDisplay() {
  const num = parseFloat(buffer || "0") / 100;
  displayEl.textContent = formatCurrency(num);
}

function commitPayment() {
  const value = parseFloat(buffer || "0") / 100;

  // --- apply to correct type ---
  if (currentType === "Cash") order._payment.cash = value;
  if (currentType === "Card") order._payment.card = value;

  // --- close pad and update totals ---
  overlay.classList.add("hidden");

  // --- instantly update "Amount Paid" + Change ---
  updatePaymentSummary();
}

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    const val = btn.dataset.value;
    if (val === "C") buffer = "";
    else if (val === "←") buffer = buffer.slice(0, -1);
    else if (val === "Enter") return commitPayment();
    else buffer += val;
    renderDisplay();
  });
});

if (closeBtn) closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));

// ---------- PAYMENT BUTTONS ----------
const cashBtn = document.getElementById("cash-btn");
const cardBtn = document.getElementById("card-btn");

if (cashBtn)
  cashBtn.addEventListener("click", () => openPaypad("Cash"));
if (cardBtn)
  cardBtn.addEventListener("click", () => openPaypad("Card"));
// ===========================================================
// ✅ Confirm Payment Button Logic
// ===========================================================
const confirmPaymentBtn = document.getElementById("confirm-payment-btn");

confirmPaymentBtn?.addEventListener("click", () => {
  const enteredAmount = parseFloat(paypadValue || "0");
  if (isNaN(enteredAmount) || enteredAmount <= 0) {
    alert("Please enter a valid payment amount.");
    return;
  }

  const grandEl = document.getElementById("grandtotal-summary");
  let grandTotal = 0;
  if (grandEl) {
    grandTotal = parseFloat(grandEl.textContent.replace(/[^0-9.]/g, "")) || 0;
  }

  // ✅ Apply amount to correct field
  const amountPaidEl = document.getElementById("amount-paid");
  const changeEl = document.getElementById("change-amount");

  if (amountPaidEl) amountPaidEl.textContent = `$${enteredAmount.toFixed(2)}`;

  // Compute change or remaining
  const diff = enteredAmount - grandTotal;
  if (changeEl) {
    changeEl.textContent =
      diff >= 0
        ? `Change: $${diff.toFixed(2)}`
        : `Remaining: $${Math.abs(diff).toFixed(2)}`;
  }

  console.log(`✅ ${currentPaymentType} payment confirmed: $${enteredAmount}`);

  // Hide overlay + reset
  paypadOverlay.classList.add("hidden");
  paypadValue = "";
  updatePaypadDisplay();
});


// ---------- RESET + INITIALIZE ----------
function resetPayments() {
  order._payment = { cash: 0, card: 0 };
  updatePaymentSummary();
}
resetPayments();


// ===========================================================
// MENU + CONTROL BUTTON HANDLERS (Overlay + Return Mode)
// ===========================================================
window.addEventListener("load", () => {
  const openBtn = document.getElementById("open-product-overlay");
  const closeBtn = document.getElementById("close-product-overlay");
  const overlay = document.getElementById("product-overlay");
  const overlayGrid = document.getElementById("overlay-grid");
  const menu = document.getElementById("menu");
  const originalParent = menu?.parentElement;

  // --- Open Overlay ---
  function openOverlay() {
  overlay.classList.add("active");
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}


// --- Close Overlay ---
function closeOverlay() {
  overlay.classList.remove("active");
  setTimeout(() => overlay.classList.add("hidden"), 300);
  document.body.style.overflow = "";
}

  // --- Handle Buttons ---
  openBtn?.addEventListener("click", openOverlay);
  closeBtn?.addEventListener("click", closeOverlay);

  // --- Handle Click Events ---
    // --- Handle Click Events ---
  document.addEventListener("click", e => {
    // Product tile clicked
    const menuItem = e.target.closest(".menu-item");
    if (menuItem) {
      const data = menuItem.getAttribute("data-sku");
      if (data) {
        order.addOrderLine(1, data, isReturnMode);
        updatePaymentSummary();
      }
      // close overlay automatically after adding
      closeOverlay();
      return;
    }

    // Clear Order
    if (e.target.closest("#clear-order-btn")) {
      clearOrder();
      return;
    }

    // Return Mode Toggle
    if (e.target.closest("#toggle-return")) {
      isReturnMode = !isReturnMode;
      const btn = document.getElementById("toggle-return");
      const icon = btn?.querySelector("i");
      const banner = document.getElementById("return-mode-banner");

      btn?.classList.toggle("active", isReturnMode);

      // 🌟 Add glow + color change when active
      if (icon) {
        icon.style.color = isReturnMode ? "#e63946" : "#A7E1EE";
        icon.style.textShadow = isReturnMode ? "0 0 12px #e63946" : "none";
      }

      if (banner) banner.style.display = isReturnMode ? "block" : "none";

      console.log(`↩️ Return mode ${isReturnMode ? "ENABLED" : "DISABLED"}`);
      return;
    }
  });
});

// ===========================================================
// CLEAR + RETURN FUNCTIONS
// ===========================================================
function clearOrder() {
  order._order = [];
  order._payment = { cash: 0, card: 0 };
  Ui.receiptDetails(order);
  Ui.updateTotals(order);
  updatePaymentSummary();
  toggleSubmitVisibility();
  console.log("🧹 Order cleared");
}
