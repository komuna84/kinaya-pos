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
    const change = isReturn ? -quantity : quantity;
    const existingLine = this._order.find(line => line.sku === sku);

    if (existingLine) {
      existingLine.quantity += change;
      existingLine.subtotal = Utilities.roundToTwo(existingLine.quantity * existingLine.price);
      existingLine.tax = Utilities.roundToTwo(existingLine.subtotal * 0.07);
      if (existingLine.quantity === 0) {
        this._order = this._order.filter(line => line.sku !== sku);
      }
    } else {
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
    toggleSubmitVisibility();
  }
}

// ===========================================================
// UTILITIES
// ===========================================================
class Utilities {
  static convertFloatToString(float) {
  const priceParams = { style: "currency", currency: "USD" };
  if (float < 0)
    return `(${Math.abs(float).toLocaleString("en-US", priceParams)})`;
  return float.toLocaleString("en-US", priceParams);
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
  static renderMenu(orderInstance) {
    const menuContainer = document.getElementById("menu");
    if (!menuContainer) return;
    menuContainer.innerHTML = "";

    if (!orderInstance.menu.length) {
      menuContainer.innerHTML = "<p style='color:white'>No active products found.</p>";
      return;
    }

    const frag = document.createDocumentFragment();
    orderInstance.menu.forEach(item => {
      const figure = document.createElement("figure");
      figure.classList.add("menu-item");
      figure.setAttribute("data-sku", JSON.stringify(item));
      figure.innerHTML = 
        <img src="${item.image}" alt="${item.description}" class="menu-image"
             style="width:150px;height:150px;object-fit:cover;border-radius:12px;">
        <figcaption style="font-weight:bold;margin-top:8px;">${item.description}</figcaption>
        <figcaption style="font-size:0.9em;opacity:0.8;">${item.sku}</figcaption>
        <figcaption style="color:#A7E1EE;margin-top:4px;">
          ${Utilities.convertFloatToString(item.price)}
        </figcaption>
      ;
      frag.appendChild(figure);
    });
    menuContainer.appendChild(frag);
  }

  static receiptDetails(orderInstance) {
    const receiptDetails = document.getElementById("receipt-details");
    if (!receiptDetails) return;
    receiptDetails.innerHTML = "";

    if (!orderInstance._order.length) {
      receiptDetails.innerHTML = <tr><td colspan="5" style="color:#aaa;text-align:center;">No items yet</td></tr>;
      Ui.updateTotals(orderInstance);
      return;
    }

    orderInstance._order.forEach((line, i) => {
      const row = document.createElement("tr");
      const style = line.quantity < 0 ? "color:#e63946;font-weight:bold;" : "";
      row.innerHTML = 
        <td style="${style}">${line.description}</td>
        <td style="${style}">${line.quantity}</td>
        <td style="${style}">${Utilities.convertFloatToString(line.price)}</td>
        <td style="${style}">${Utilities.convertFloatToString(line.subtotal)}</td>
        <td class="delete" data-delete="${i}" title="Remove item"><i class="fas fa-backspace"></i></td>;
      receiptDetails.appendChild(row);
    });

    Ui.attachDeleteHandlers(orderInstance);
    Ui.updateTotals(orderInstance);
  }

  static attachDeleteHandlers(orderInstance) {
    document.querySelectorAll(".delete").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const index = parseInt(btn.getAttribute("data-delete"));
        if (isNaN(index)) return;
        const line = orderInstance._order[index];
        if (!line) return;
        line.quantity--;
        line.subtotal = Utilities.roundToTwo(line.quantity * line.price);
        line.tax = Utilities.roundToTwo(line.subtotal * 0.07);
        if (line.quantity <= 0) orderInstance._order.splice(index, 1);
        Ui.receiptDetails(orderInstance);
        Ui.updateTotals(orderInstance);
        updatePaymentUI();
        toggleSubmitVisibility();
      });
    });
  }

  static updateTotals(orderInstance) {
    const subtotal = orderInstance._order.reduce((a, l) => a + l.subtotal, 0);
    const tax = orderInstance._order.reduce((a, l) => a + l.tax, 0);
    const grandTotal = subtotal + tax;
    const fmt = v => Utilities.convertFloatToString(v);
    document.getElementById("subtotal-summary").textContent = fmt(subtotal);
    document.getElementById("tax-summary").textContent = fmt(tax);
    document.getElementById("grandtotal-summary").textContent = fmt(grandTotal);
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
// PAYMENT + UI INTERACTIONS — FIXED FOR SUBMIT + SPLIT + NEWSLETTER
// ===========================================================
let amountPaid = 0;
let paymentType = "";
let grandTotal = 0;

// ---------- UPDATE PAYMENT UI ----------
function updatePaymentUI(reset = false) {
  const overlay = document.getElementById("payment-overlay");
  const amountDisplay = document.getElementById("amount-paid");
  const amountPaidInput = document.getElementById("amount-paid-input");
  const grandDisplay = document.getElementById("grandtotal-summary");

  if (reset) {
    amountPaid = 0;
    paymentType = "";
    if (overlay) overlay.classList.add("hidden");
  }

  if (grandDisplay) {
    const text = grandDisplay.textContent.replace(/[^0-9.]/g, "");
    grandTotal = parseFloat(text) || 0;
  }

  if (amountPaidInput) {
    amountPaid = parseFloat(amountPaidInput.value) || 0;
  }

  if (amountDisplay) {
    amountDisplay.textContent = $${amountPaid.toFixed(2)};
  }

  toggleSubmitVisibility();
}

// ---------- CONTROL SUBMIT VISIBILITY ----------
function toggleSubmitVisibility() {
  const submitRow = document.getElementById("submit-row");
  const emailInput = document.getElementById("customer-email");
  if (!submitRow) return;

  const hasEmail = emailInput && emailInput.value.trim().length > 0;
  const canSubmit =
    order._order.length > 0 &&
    amountPaid >= grandTotal &&
    hasEmail;

  submitRow.style.display = canSubmit ? "block" : "none";
}

// ---------- SPLIT PAYMENT TRACKING ----------
const splitInfoEl = document.getElementById("split-info");
const paymentTypeEl = document.getElementById("payment-type");

function updateSplitInfo(type) {
  if (!splitInfoEl || !paymentTypeEl) return;

  // update labels
  paymentTypeEl.textContent = type || "—";
  if (type === "Split") {
    splitInfoEl.textContent = "Cash + Card";
  } else if (type === "Cash" || type === "Card") {
    splitInfoEl.textContent = type;
  } else {
    splitInfoEl.textContent = "None";
  }
}

// ---------- EMAIL FIELD (TRIGGERS SUBMIT BUTTON) ----------
const emailInput = document.getElementById("customer-email");
if (emailInput) {
  emailInput.addEventListener("input", toggleSubmitVisibility);
}

// ---------- AMOUNT PAID FIELD ----------
const amountPaidInput = document.getElementById("amount-paid-input");
if (amountPaidInput) {
  amountPaidInput.addEventListener("input", () => {
    amountPaid = parseFloat(amountPaidInput.value) || 0;
    updatePaymentUI();
  });
}

// ---------- PAYMENT TYPE BUTTONS ----------
const cashBtn = document.getElementById("cash-btn");
const cardBtn = document.getElementById("card-btn");
const overlay = document.getElementById("payment-overlay");

if (cashBtn) {
  cashBtn.addEventListener("click", () => {
    if (paymentType === "Card") {
      paymentType = "Split";
    } else {
      paymentType = "Cash";
    }
    updateSplitInfo(paymentType);
    if (overlay) overlay.classList.remove("hidden");
  });
}

if (cardBtn) {
  cardBtn.addEventListener("click", () => {
    if (paymentType === "Cash") {
      paymentType = "Split";
    } else {
      paymentType = "Card";
    }
    updateSplitInfo(paymentType);
    if (overlay) overlay.classList.remove("hidden");
  });
}

// ---------- NEWSLETTER TOGGLE ----------
const emailToggle = document.getElementById("email-toggle");
if (emailToggle) {
  emailToggle.addEventListener("change", () => {
    const label = document.getElementById("newsletter-label");
    if (label) {
      if (emailToggle.checked) {
        label.textContent = "✅ Subscribed to newsletter";
        label.style.color = "#A7E1EE";
      } else {
        label.textContent = "Newsletter opt-out";
        label.style.color = "#aaa";
      }
    }
  });
}



// ===========================================================
// PAYPAD
// ===========================================================
(function setupPaypad() {
  const overlay = document.getElementById("payment-overlay");
  const displayEl = document.getElementById("paypad-display");
  const buttons = document.querySelectorAll(".paypad-btn");
  const closeBtn = document.getElementById("close-paypad-btn");
  const changeEl = document.getElementById("change-amount");

  let buffer = "";

  function formatCurrency(val) {
    return $${(parseFloat(val) || 0).toFixed(2)};
  }
  function renderDisplay() {
    const num = parseFloat(buffer || "0") / 100;
    displayEl.textContent = formatCurrency(num);
  }
  function commitPayment() {
    const value = parseFloat(buffer || "0") / 100;
    amountPaidInput.value = value.toFixed(2);
    updatePaymentUI();
    overlay.classList.add("hidden");
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
  renderDisplay();
})();

// ===========================================================
// RETURN MODE + CLEAR ORDER
// ===========================================================
(function setupInteractionFixes() {
  const header = document.querySelector("header h1");
  const returnBtn = document.getElementById("toggle-return");
  const clearBtn = document.getElementById("clear-order-btn");
  const cashBtn = document.getElementById("cash-btn");
  const cardBtn = document.getElementById("card-btn");
  const overlay = document.getElementById("payment-overlay");

  // Return banner
  function updateReturnBanner() {
    let banner = document.getElementById("return-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "return-banner";
      banner.textContent = "RETURN MODE ACTIVE";
      banner.style.cssText = 
        text-align:center;font-family:"Audiowide",sans-serif;
        color:#e63946;font-weight:bold;margin-top:0.3rem;
        letter-spacing:1px;text-shadow:0 0 10px rgba(230,57,70,0.6);
      ;
      header?.insertAdjacentElement("afterend", banner);
    }
    banner.style.display = isReturnMode ? "block" : "none";
  }

  if (returnBtn) {
    returnBtn.addEventListener("click", () => {
      isReturnMode = !isReturnMode;
      returnBtn.classList.toggle("active", isReturnMode);
      updateReturnBanner();
    });
    updateReturnBanner();
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", e => {
      if (!confirm("⚠️ This will clear the entire order. Continue?")) {
        e.preventDefault();
        return;
      }
      order._order = [];
      Ui.receiptDetails(order);
      Ui.updateTotals(order);
      amountPaid = 0;
      updatePaymentUI(true);
      toggleSubmitVisibility();
    });
  }

  if (cashBtn) cashBtn.addEventListener("click", () => { updateSplitInfo("Cash"); overlay.classList.remove("hidden"); });
  if (cardBtn) cardBtn.addEventListener("click", () => { updateSplitInfo("Card"); overlay.classList.remove("hidden"); });

  document.addEventListener("submit", e => e.preventDefault());
  updatePaymentUI(true);
  toggleSubmitVisibility();
})();

// ===========================================================
// MENU ITEM CLICK HANDLER
// ===========================================================
document.addEventListener("click", e => {
  const menuItem = e.target.closest(".menu-item");
  if (!menuItem) return;
  const data = menuItem.getAttribute("data-sku");
  if (!data) return;
  order.addOrderLine(1, data, isReturnMode);
});

// ===========================================================
// SPLIT PAYMENT + PAYPAD (UPGRADED)
// ===========================================================
let grandTotal = 0;
let currentType = ""; // 'Cash' or 'Card'

// ---------- UPDATE TOTAL + CHANGE ----------
function updatePaymentSummary() {
  const grandDisplay = document.getElementById("grandtotal-summary");
  const changeEl = document.getElementById("change-amount");
  const subtotalPaid = order._payment.cash + order._payment.card;
  if (grandDisplay) {
    const text = grandDisplay.textContent.replace(/[^0-9.]/g, "");
    grandTotal = parseFloat(text) || 0;
  }
  const change = subtotalPaid - grandTotal;
  if (changeEl) {
    changeEl.textContent =
      change >= 0
        ? `Change: $${change.toFixed(2)}`
        : `Remaining: $${Math.abs(change).toFixed(2)}`;
  }
  updateSplitInfo(
    order._payment.cash && order._payment.card
      ? "Split"
      : order._payment.cash
      ? "Cash"
      : order._payment.card
      ? "Card"
      : "None"
  );
  toggleSubmitVisibility();
}

// ---------- SHOW PAYPAD ----------
function openPaypad(type) {
  currentType = type;
  const overlay = document.getElementById("payment-overlay");
  const displayEl = document.getElementById("paypad-display");
  overlay.classList.remove("hidden");
  let existing = order._payment[type.toLowerCase()] || 0;
  buffer = (existing * 100).toString(); // preload cents
  renderDisplay();
  displayEl.dataset.mode = type;
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
  if (currentType === "Cash") order._payment.cash = value;
  if (currentType === "Card") order._payment.card = value;
  overlay.classList.add("hidden");
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

// ---------- RESET + INITIALIZE ----------
function resetPayments() {
  order._payment = { cash: 0, card: 0 };
  updatePaymentSummary();
}
resetPayments();
✨ What This Does
Cash or Card Buttons: open the paypad overlay, pre-filled with the last entered amount for that type.

Backspace / Clear: works fully; “Enter” commits the amount.

Change Display: updates live once both entered amounts exceed grand total.

Split Payment: automatically detected; shows “Cash + Card” and passes that label into your existing submitSale JSON as before.

Safe Integration: no changes to your Order, Ui, or submitSale() logic — this just plugs in cleanly.

Would you like me to modify the submitSale() function too so it logs both cash and card columns separately (not just the combined “Payment: Split” label)? I can do that in one clean addition next.

You said:
so both of these sections?
// ===========================================================
// PAYMENT + UI INTERACTIONS — FIXED FOR SUBMIT + SPLIT + NEWSLETTER
// ===========================================================
let amountPaid = 0;
let paymentType = "";
let grandTotal = 0;

// ---------- UPDATE PAYMENT UI ----------
function updatePaymentUI(reset = false) {
  const overlay = document.getElementById("payment-overlay");
  const amountDisplay = document.getElementById("amount-paid");
  const amountPaidInput = document.getElementById("amount-paid-input");
  const grandDisplay = document.getElementById("grandtotal-summary");

  if (reset) {
    amountPaid = 0;
    paymentType = "";
    if (overlay) overlay.classList.add("hidden");
  }

  if (grandDisplay) {
    const text = grandDisplay.textContent.replace(/[^0-9.]/g, "");
    grandTotal = parseFloat(text) || 0;
  }

  if (amountPaidInput) {
    amountPaid = parseFloat(amountPaidInput.value) || 0;
  }

  if (amountDisplay) {
    amountDisplay.textContent = $${amountPaid.toFixed(2)};
  }

  toggleSubmitVisibility();
}

// ---------- CONTROL SUBMIT VISIBILITY ----------
function toggleSubmitVisibility() {
  const submitRow = document.getElementById("submit-row");
  const emailInput = document.getElementById("customer-email");
  if (!submitRow) return;

  const hasEmail = emailInput && emailInput.value.trim().length > 0;
  const canSubmit =
    order._order.length > 0 &&
    amountPaid >= grandTotal &&
    hasEmail;

  submitRow.style.display = canSubmit ? "block" : "none";
}

// ---------- SPLIT PAYMENT TRACKING ----------
const splitInfoEl = document.getElementById("split-info");
const paymentTypeEl = document.getElementById("payment-type");

function updateSplitInfo(type) {
  if (!splitInfoEl || !paymentTypeEl) return;

  // update labels
  paymentTypeEl.textContent = type || "—";
  if (type === "Split") {
    splitInfoEl.textContent = "Cash + Card";
  } else if (type === "Cash" || type === "Card") {
    splitInfoEl.textContent = type;
  } else {
    splitInfoEl.textContent = "None";
  }
}

// ---------- EMAIL FIELD (TRIGGERS SUBMIT BUTTON) ----------
const emailInput = document.getElementById("customer-email");
if (emailInput) {
  emailInput.addEventListener("input", toggleSubmitVisibility);
}

// ---------- AMOUNT PAID FIELD ----------
const amountPaidInput = document.getElementById("amount-paid-input");
if (amountPaidInput) {
  amountPaidInput.addEventListener("input", () => {
    amountPaid = parseFloat(amountPaidInput.value) || 0;
    updatePaymentUI();
  });
}

// ---------- PAYMENT TYPE BUTTONS ----------
const cashBtn = document.getElementById("cash-btn");
const cardBtn = document.getElementById("card-btn");
const overlay = document.getElementById("payment-overlay");

if (cashBtn) {
  cashBtn.addEventListener("click", () => {
    if (paymentType === "Card") {
      paymentType = "Split";
    } else {
      paymentType = "Cash";
    }
    updateSplitInfo(paymentType);
    if (overlay) overlay.classList.remove("hidden");
  });
}

if (cardBtn) {
  cardBtn.addEventListener("click", () => {
    if (paymentType === "Cash") {
      paymentType = "Split";
    } else {
      paymentType = "Card";
    }
    updateSplitInfo(paymentType);
    if (overlay) overlay.classList.remove("hidden");
  });
}

// ---------- NEWSLETTER TOGGLE ----------
const emailToggle = document.getElementById("email-toggle");
if (emailToggle) {
  emailToggle.addEventListener("change", () => {
    const label = document.getElementById("newsletter-label");
    if (label) {
      if (emailToggle.checked) {
        label.textContent = "✅ Subscribed to newsletter";
        label.style.color = "#A7E1EE";
      } else {
        label.textContent = "Newsletter opt-out";
        label.style.color = "#aaa";
      }
    }
  });
}



// ===========================================================
// PAYPAD
// ===========================================================
(function setupPaypad() {
  const overlay = document.getElementById("payment-overlay");
  const displayEl = document.getElementById("paypad-display");
  const buttons = document.querySelectorAll(".paypad-btn");
  const closeBtn = document.getElementById("close-paypad-btn");
  const changeEl = document.getElementById("change-amount");

  let buffer = "";

  function formatCurrency(val) {
    return $${(parseFloat(val) || 0).toFixed(2)};
  }
  function renderDisplay() {
    const num = parseFloat(buffer || "0") / 100;
    displayEl.textContent = formatCurrency(num);
  }
  function commitPayment() {
    const value = parseFloat(buffer || "0") / 100;
    amountPaidInput.value = value.toFixed(2);
    updatePaymentUI();
    overlay.classList.add("hidden");
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
  renderDisplay();
})();

// ===========================================================
// RETURN MODE + CLEAR ORDER
// ===========================================================
(function setupInteractionFixes() {
  const header = document.querySelector("header h1");
  const returnBtn = document.getElementById("toggle-return");
  const clearBtn = document.getElementById("clear-order-btn");
  const cashBtn = document.getElementById("cash-btn");
  const cardBtn = document.getElementById("card-btn");
  const overlay = document.getElementById("payment-overlay");

  // Return banner
  function updateReturnBanner() {
    let banner = document.getElementById("return-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "return-banner";
      banner.textContent = "RETURN MODE ACTIVE";
      banner.style.cssText = 
        text-align:center;font-family:"Audiowide",sans-serif;
        color:#e63946;font-weight:bold;margin-top:0.3rem;
        letter-spacing:1px;text-shadow:0 0 10px rgba(230,57,70,0.6);
      ;
      header?.insertAdjacentElement("afterend", banner);
    }
    banner.style.display = isReturnMode ? "block" : "none";
  }

  if (returnBtn) {
    returnBtn.addEventListener("click", () => {
      isReturnMode = !isReturnMode;
      returnBtn.classList.toggle("active", isReturnMode);
      updateReturnBanner();
    });
    updateReturnBanner();
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", e => {
      if (!confirm("⚠️ This will clear the entire order. Continue?")) {
        e.preventDefault();
        return;
      }
      order._order = [];
      Ui.receiptDetails(order);
      Ui.updateTotals(order);
      amountPaid = 0;
      updatePaymentUI(true);
      toggleSubmitVisibility();
    });
  }

  if (cashBtn) cashBtn.addEventListener("click", () => { updateSplitInfo("Cash"); overlay.classList.remove("hidden"); });
  if (cardBtn) cardBtn.addEventListener("click", () => { updateSplitInfo("Card"); overlay.classList.remove("hidden"); });

  document.addEventListener("submit", e => e.preventDefault());
  updatePaymentUI(true);
  toggleSubmitVisibility();
})();
ChatGPT said:
Exactly 👍 — you’ll replace both of those sections with the new unified upgraded block I shared.

To be precise:

✅ Remove everything from:

// ===========================================================
// PAYMENT + UI INTERACTIONS — FIXED FOR SUBMIT + SPLIT + NEWSLETTER
// ===========================================================
through

})();  // end of PAYPAD IIFE
and stop right before the

// ===========================================================
// RETURN MODE + CLEAR ORDER
// ===========================================================
section.

Then, paste in the new combined block I gave you:

// ===========================================================
// SPLIT PAYMENT + PAYPAD (UPGRADED)
// ===========================================================
...
resetPayments();
That will:

Replace both the payment + UI interactions and paypad code entirely.

Keep your newsletter toggle, return mode, and clear order logic untouched.

Allow full split-payment editing, live change calculation, and paypad recall for both types independently.

Would you like me to include the small optional tweak that also records “Cash Paid” and “Card Paid” as separate fields in your Google Sheet (in addition to the “Payment: Split” column)? It’ll make reporting cleaner if you ever want totals by method.

You said:
so that makess me lose my product view
ChatGPT said:
Good catch — no, you won’t lose your product view at all.

Here’s what’s happening and why you’re safe:

🧩 How the sections are structured
Your POS script has several independent functional zones:

Header Date + Session Check → controls page access and date.

Core Order Model (class Order) → manages cart, menu, tax, and order lines.

UI Class (Ui) → renders product images, titles, and prices — this is your product view.

Init section (loadMenuFromSheet) → loads products from your Google Sheet CSV and calls

Ui.renderMenu(order);
which builds the product grid.

Payment + Paypad + Return Mode → purely handles checkout, not products.

✅ What you’re replacing
You are only replacing the “payment” and “paypad” logic, which sits after the UI and menu rendering.

That means everything responsible for loading and displaying your product catalog — including the product images, SKU captions, and prices — stays 100% intact.

The new block simply updates:

How cash/card amounts are tracked,

How change is calculated,

How the paypad overlay behaves.

No menu rendering code, no event listeners on .menu-item, and no CSV loading are touched.

🛠️ In short
❌ You are not touching Ui.renderMenu() or anything that affects your products.

✅ You are only upgrading the section that begins with

// PAYMENT + UI INTERACTIONS — FIXED FOR SUBMIT + SPLIT + NEWSLETTER
and ends right before

// RETURN MODE + CLEAR ORDER
If your product view disappeared after pasting, it usually means a small syntax issue stopped the script before Ui.renderMenu(order) could run (for example, a missing bracket).
If that happened, send me your current version or console error, and I’ll pinpoint exactly where to patch it — you won’t lose your product grid permanently.

Would you like me to show you the safe insertion point visually, with the exact few lines before and after where the new code should start and end?

You said:
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
    const change = isReturn ? -quantity : quantity;
    const existingLine = this._order.find(line => line.sku === sku);

    if (existingLine) {
      existingLine.quantity += change;
      existingLine.subtotal = Utilities.roundToTwo(existingLine.quantity * existingLine.price);
      existingLine.tax = Utilities.roundToTwo(existingLine.subtotal * 0.07);
      if (existingLine.quantity === 0) {
        this._order = this._order.filter(line => line.sku !== sku);
      }
    } else {
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
    toggleSubmitVisibility();
  }
}

// ===========================================================
// UTILITIES
// ===========================================================
class Utilities {
  static convertFloatToString(float) {
    const priceParams = { style: "currency", currency: "USD" };
    if (float < 0) return (${Math.abs(float).toLocaleString("en-US", priceParams)});
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
  static renderMenu(orderInstance) {
    const menuContainer = document.getElementById("menu");
    if (!menuContainer) return;
    menuContainer.innerHTML = "";

    if (!orderInstance.menu.length) {
      menuContainer.innerHTML = "<p style='color:white'>No active products found.</p>";
      return;
    }

    const frag = document.createDocumentFragment();
    orderInstance.menu.forEach(item => {
      const figure = document.createElement("figure");
      figure.classList.add("menu-item");
      figure.setAttribute("data-sku", JSON.stringify(item));
      figure.innerHTML = 
        <img src="${item.image}" alt="${item.description}" class="menu-image"
             style="width:150px;height:150px;object-fit:cover;border-radius:12px;">
        <figcaption style="font-weight:bold;margin-top:8px;">${item.description}</figcaption>
        <figcaption style="font-size:0.9em;opacity:0.8;">${item.sku}</figcaption>
        <figcaption style="color:#A7E1EE;margin-top:4px;">
          ${Utilities.convertFloatToString(item.price)}
        </figcaption>
      ;
      frag.appendChild(figure);
    });
    menuContainer.appendChild(frag);
  }

  static receiptDetails(orderInstance) {
    const receiptDetails = document.getElementById("receipt-details");
    if (!receiptDetails) return;
    receiptDetails.innerHTML = "";

    if (!orderInstance._order.length) {
      receiptDetails.innerHTML = <tr><td colspan="5" style="color:#aaa;text-align:center;">No items yet</td></tr>;
      Ui.updateTotals(orderInstance);
      return;
    }

    orderInstance._order.forEach((line, i) => {
      const row = document.createElement("tr");
      const style = line.quantity < 0 ? "color:#e63946;font-weight:bold;" : "";
      row.innerHTML = 
        <td style="${style}">${line.description}</td>
        <td style="${style}">${line.quantity}</td>
        <td style="${style}">${Utilities.convertFloatToString(line.price)}</td>
        <td style="${style}">${Utilities.convertFloatToString(line.subtotal)}</td>
        <td class="delete" data-delete="${i}" title="Remove item"><i class="fas fa-backspace"></i></td>;
      receiptDetails.appendChild(row);
    });

    Ui.attachDeleteHandlers(orderInstance);
    Ui.updateTotals(orderInstance);
  }

  static attachDeleteHandlers(orderInstance) {
    document.querySelectorAll(".delete").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const index = parseInt(btn.getAttribute("data-delete"));
        if (isNaN(index)) return;
        const line = orderInstance._order[index];
        if (!line) return;
        line.quantity--;
        line.subtotal = Utilities.roundToTwo(line.quantity * line.price);
        line.tax = Utilities.roundToTwo(line.subtotal * 0.07);
        if (line.quantity <= 0) orderInstance._order.splice(index, 1);
        Ui.receiptDetails(orderInstance);
        Ui.updateTotals(orderInstance);
        updatePaymentUI();
        toggleSubmitVisibility();
      });
    });
  }

  static updateTotals(orderInstance) {
    const subtotal = orderInstance._order.reduce((a, l) => a + l.subtotal, 0);
    const tax = orderInstance._order.reduce((a, l) => a + l.tax, 0);
    const grandTotal = subtotal + tax;
    const fmt = v => Utilities.convertFloatToString(v);
    document.getElementById("subtotal-summary").textContent = fmt(subtotal);
    document.getElementById("tax-summary").textContent = fmt(tax);
    document.getElementById("grandtotal-summary").textContent = fmt(grandTotal);
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
// SPLIT PAYMENT + PAYPAD (UPGRADED)
// ===========================================================
let grandTotal = 0;
let currentType = ""; // 'Cash' or 'Card'

// ---------- UPDATE TOTAL + CHANGE ----------
function updatePaymentSummary() {
  const grandDisplay = document.getElementById("grandtotal-summary");
  const changeEl = document.getElementById("change-amount");
  const subtotalPaid = order._payment.cash + order._payment.card;
  if (grandDisplay) {
    const text = grandDisplay.textContent.replace(/[^0-9.]/g, "");
    grandTotal = parseFloat(text) || 0;
  }
  const change = subtotalPaid - grandTotal;
  if (changeEl) {
    changeEl.textContent =
      change >= 0
        ? Change: $${change.toFixed(2)}
        : Remaining: $${Math.abs(change).toFixed(2)};
  }
  updateSplitInfo(
    order._payment.cash && order._payment.card
      ? "Split"
      : order._payment.cash
      ? "Cash"
      : order._payment.card
      ? "Card"
      : "None"
  );
  toggleSubmitVisibility();
}

// ---------- SHOW PAYPAD ----------
function openPaypad(type) {
  currentType = type;
  const overlay = document.getElementById("payment-overlay");
  const displayEl = document.getElementById("paypad-display");
  overlay.classList.remove("hidden");
  let existing = order._payment[type.toLowerCase()] || 0;
  buffer = (existing * 100).toString(); // preload cents
  renderDisplay();
  displayEl.dataset.mode = type;
}

// ---------- PAYPAD CORE ----------
const overlay = document.getElementById("payment-overlay");
const displayEl = document.getElementById("paypad-display");
const buttons = document.querySelectorAll(".paypad-btn");
const closeBtn = document.getElementById("close-paypad-btn");
let buffer = "";

function formatCurrency(val) {
  return $${(parseFloat(val) || 0).toFixed(2)};
}
function renderDisplay() {
  const num = parseFloat(buffer || "0") / 100;
  displayEl.textContent = formatCurrency(num);
}
function commitPayment() {
  const value = parseFloat(buffer || "0") / 100;
  if (currentType === "Cash") order._payment.cash = value;
  if (currentType === "Card") order._payment.card = value;
  overlay.classList.add("hidden");
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

// ---------- RESET + INITIALIZE ----------
function resetPayments() {
  order._payment = { cash: 0, card: 0 };
  updatePaymentSummary();
}
resetPayments();

// ===========================================================
// MENU ITEM CLICK HANDLER
// ===========================================================
document.addEventListener("click", e => {
  const menuItem = e.target.closest(".menu-item");
  if (!menuItem) return;
  const data = menuItem.getAttribute("data-sku");
  if (!data) return;
  order.addOrderLine(1, data, isReturnMode);
});
ChatGPT said:
Perfect — yes, you’ve placed the upgraded split payment + paypad block in exactly the right spot ✅

Here’s how your structure now reads (and why your product view should still be fine):

🧱 Correct section order
Header Date / Session Check

Core Order Model — contains logic for adding products, quantities, and tax

Utilities + CSV Loader

UI Class — handles how products are rendered (Ui.renderMenu(order)), including images and captions

Init Section — loads the Google Sheet → calls Ui.renderMenu(order)

🟢 This is what builds your product view — untouched and still active

Submit Sale

✅ New Split Payment + Paypad (Upgraded) ← replaces both the old “Payment + UI Interactions” and “Paypad” blocks

Menu Item Click Handler

🟢 This still listens for clicks on your .menu-item figures and adds them to the cart.

🧩 Why your product view might disappear temporarily
If you reloaded the page and it went blank or didn’t show products, there are usually only two causes:

A JavaScript runtime error above prevents the rest of the script from executing.

Check DevTools → Console for a red error (often “Uncaught ReferenceError” or a missing semicolon/brace).

The UI won’t render if execution stops before Ui.renderMenu(order).

The CSV URL or CORS fetch failed.

Make sure your Google Sheet link is still public and accessible.

You can test it directly in your browser — if it downloads a .csv, it’s working.

🔍 Quick verification steps
Open the browser console (F12 → Console tab).

Reload the POS page.

Check for errors like:

ReferenceError: updatePaymentUI is not defined

Uncaught SyntaxError: Unexpected token

TypeError: Cannot read properties of null

If you see one, copy it here and I’ll patch it instantly — it’s usually just one line missing from the old updatePaymentUI() dependency (easy fix).

Would you like me to add a small compatibility shim at the top of your new payment block to preserve calls to updatePaymentUI() and toggleSubmitVisibility() (so they don’t throw errors if referenced from other parts)?
It’s a 4-line fix that guarantees no breakage while using the upgraded paypad.

You said:
I see product now can't enter them
ChatGPT said:
Excellent — that means the menu loaded successfully, but your click-to-add functionality is being blocked by a missing link between the addOrderLine() call and the new payment logic (we removed updatePaymentUI() and toggleSubmitVisibility() definitions when we replaced the old section).

Let’s fix this cleanly and safely so your product clicks work again — and so no other functions break.

🧭 What’s happening
Your product tiles (.menu-item) still fire this:

order.addOrderLine(1, data, isReturnMode);
Inside addOrderLine(), the end of that function calls:

Ui.receiptDetails(this);
Ui.updateTotals(this);
updatePaymentUI();
toggleSubmitVisibility();
…but since we removed the old updatePaymentUI() and toggleSubmitVisibility() when upgrading the paypad, those functions no longer exist — so clicking a product silently fails.

✅ The fix
You don’t need to revert the whole section — just add this small compatibility bridge right above your new paypad block, or right after it (either is fine):

// ===========================================================
// BACKWARD COMPATIBILITY FIX — updatePaymentUI + toggleSubmitVisibility
// ===========================================================
function updatePaymentUI(reset = false) {
  // optional reset
  if (reset) order._payment = { cash: 0, card: 0 };
  // update change and totals
  updatePaymentSummary();
}

function toggleSubmitVisibility() {
  const submitRow = document.getElementById("submit-row");
  const emailInput = document.getElementById("customer-email");
  if (!submitRow) return;

  const subtotalPaid = order._payment.cash + order._payment.card;
  const hasEmail = emailInput && emailInput.value.trim().length > 0;
  const grandDisplay = document.getElementById("grandtotal-summary");
  const text = grandDisplay ? grandDisplay.textContent.replace(/[^0-9.]/g, "") : "0";
  const grandTotal = parseFloat(text) || 0;

  const canSubmit = order._order.length > 0 && subtotalPaid >= grandTotal && hasEmail;
  submitRow.style.display = canSubmit ? "block" : "none";
}
🧩 What this does
updatePaymentUI() now simply calls your upgraded updatePaymentSummary() (so the change display, split info, and submit logic update correctly).

toggleSubmitVisibility() ensures your “Submit Sale” button appears only when:

there’s at least one product,

payment ≥ total, and

an email is entered.

This makes your entire chain work again:

Tap product → adds to cart

Totals update

Paypad & split payments stay functional

Submit button reappears when valid

Once you add those two short functions and reload, your product taps should work immediately again.

Would you like me to show where exactly to insert this block (before or after a certain line) in your current script for a copy-paste-safe placement?

You said:
Uploaded image
ChatGPT said:
Perfect — thank you for the screenshot!
It confirms exactly what’s happening:

🔎 The errors explained
Uncaught ReferenceError: toggleSubmitVisibility is not defined

This is what’s blocking clicks from adding products to the order.

The Order.addOrderLine() function still calls toggleSubmitVisibility() at the end — but we removed it when upgrading to the new paypad system.

Identifier 'Order' has already been declared

That means there are two copies of your entire POS script running (e.g., both <script src="script.js"> and inline code, or the file is included twice).

When the browser loads the second one, it throws this “already declared” error.

As soon as that happens, nothing below it runs, so the click event never gets processed.

🧩 Step-by-step fix
Step 1: Add the compatibility bridge
Place this block just above your new “Split Payment + Paypad (Upgraded)” section:

// ===========================================================
// BACKWARD COMPATIBILITY FIX — Needed by Order.addOrderLine()
// ===========================================================
function updatePaymentUI(reset = false) {
  if (reset) order._payment = { cash: 0, card: 0 };
  updatePaymentSummary();
}

function toggleSubmitVisibility() {
  const submitRow = document.getElementById("submit-row");
  const emailInput = document.getElementById("customer-email");
  if (!submitRow) return;

  const subtotalPaid = order._payment.cash + order._payment.card;
  const hasEmail = emailInput && emailInput.value.trim().length > 0;
  const grandDisplay = document.getElementById("grandtotal-summary");
  const text = grandDisplay ? grandDisplay.textContent.replace(/[^0-9.]/g, "") : "0";
  const grandTotal = parseFloat(text) || 0;

  const canSubmit = order._order.length > 0 && subtotalPaid >= grandTotal && hasEmail;
  submitRow.style.display = canSubmit ? "block" : "none";
}
✅ This satisfies the existing addOrderLine() references without breaking the new paypad logic.

Step 2: Fix the “Order already declared” error
You likely have two copies of your JavaScript being loaded.

Check your HTML (sale.html) and make sure there’s only one reference to your script.js file:

<script src="script.js"></script>
If you see that line twice, remove the duplicate.
Also, make sure there’s no inline copy of your script sitting inside <script> ... </script> tags in the same file — keep it external only.

✅ After these two changes
The duplicate “Order” declaration error will disappear.

The toggleSubmitVisibility reference will work again.

Clicking any product will correctly add it to the receipt table, update totals, and keep your paypad + split payments functional.

Would you like me to show exactly where to paste the compatibility bridge (line-by-line in your current file context)? I can mark the insertion point so it’s copy-safe.

You said:
like this
// ===========================================================
// BACKWARD COMPATIBILITY FIX — Needed by Order.addOrderLine()
// ===========================================================
function updatePaymentUI(reset = false) {
  if (reset) order._payment = { cash: 0, card: 0 };
  updatePaymentSummary();
}

function toggleSubmitVisibility() {
  const submitRow = document.getElementById("submit-row");
  const emailInput = document.getElementById("customer-email");
  if (!submitRow) return;

  const subtotalPaid = order._payment.cash + order._payment.card;
  const hasEmail = emailInput && emailInput.value.trim().length > 0;
  const grandDisplay = document.getElementById("grandtotal-summary");
  const text = grandDisplay ? grandDisplay.textContent.replace(/[^0-9.]/g, "") : "0";
  const grandTotal = parseFloat(text) || 0;

  const canSubmit = order._order.length > 0 && subtotalPaid >= grandTotal && hasEmail;
  submitRow.style.display = canSubmit ? "block" : "none";
}

// ===========================================================
// SPLIT PAYMENT + PAYPAD (UPGRADED)
// ===========================================================
let grandTotal = 0;
let currentType = ""; // 'Cash' or 'Card'

// ---------- UPDATE TOTAL + CHANGE ----------
function updatePaymentSummary() {
  const grandDisplay = document.getElementById("grandtotal-summary");
  const changeEl = document.getElementById("change-amount");
  const subtotalPaid = order._payment.cash + order._payment.card;
  if (grandDisplay) {
    const text = grandDisplay.textContent.replace(/[^0-9.]/g, "");
    grandTotal = parseFloat(text) || 0;
  }
  const change = subtotalPaid - grandTotal;
  if (changeEl) {
    changeEl.textContent =
      change >= 0
        ? Change: $${change.toFixed(2)}
        : Remaining: $${Math.abs(change).toFixed(2)};
  }
  updateSplitInfo(
    order._payment.cash && order._payment.card
      ? "Split"
      : order._payment.cash
      ? "Cash"
      : order._payment.card
      ? "Card"
      : "None"
  );
  toggleSubmitVisibility();
}

// ---------- SHOW PAYPAD ----------
function openPaypad(type) {
  currentType = type;
  const overlay = document.getElementById("payment-overlay");
  const displayEl = document.getElementById("paypad-display");
  overlay.classList.remove("hidden");
  let existing = order._payment[type.toLowerCase()] || 0;
  buffer = (existing * 100).toString(); // preload cents
  renderDisplay();
  displayEl.dataset.mode = type;
}

// ---------- PAYPAD CORE ----------
const overlay = document.getElementById("payment-overlay");
const displayEl = document.getElementById("paypad-display");
const buttons = document.querySelectorAll(".paypad-btn");
const closeBtn = document.getElementById("close-paypad-btn");
let buffer = "";

function formatCurrency(val) {
  return $${(parseFloat(val) || 0).toFixed(2)};
}
function renderDisplay() {
  const num = parseFloat(buffer || "0") / 100;
  displayEl.textContent = formatCurrency(num);
}
function commitPayment() {
  const value = parseFloat(buffer || "0") / 100;
  if (currentType === "Cash") order._payment.cash = value;
  if (currentType === "Card") order._payment.card = value;
  overlay.classList.add("hidden");
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

// ---------- RESET + INITIALIZE ----------
function resetPayments() {
  order._payment = { cash: 0, card: 0 };
  updatePaymentSummary();
}
resetPayments();

// ===========================================================
// MENU ITEM CLICK HANDLER
// ===========================================================
document.addEventListener("click", e => {
  const menuItem = e.target.closest(".menu-item");
  if (!menuItem) return;
  const data = menuItem.getAttribute("data-sku");
  if (!data) return;
  order.addOrderLine(1, data, isReturnMode);
});
ChatGPT said:
💯 YES — that’s exactly right ✅

That’s the correct structure and order.
You’ve placed the compatibility bridge (the two helper functions) immediately before your upgraded paypad block — perfect placement.

✅ What this setup ensures
addOrderLine() now finds both updatePaymentUI() and toggleSubmitVisibility(), so clicks on your products work again.

The upgraded paypad logic continues handling split payments, editable values, and change calculation.

Your totals, receipt updates, and submit button visibility will all work in sync.

⚙️ Next Step
Now just fix the “Order already declared” message, since that will still block your script from fully running:

Check your HTML (sale.html) and make sure there’s only one reference to your script file.
Search for:

<script src="script.js"></script>
If you see it more than once, remove duplicates.

Then reload your POS page and check:

The console should now be empty (no red errors).

Clicking a product should add it to the order table.

Subtotals and totals should update.

Cash/Card buttons should open the paypad.

Entering payments should calculate change correctly.

Once you confirm it’s working, I can show you a small optional enhancement that will record both cash and card amounts separately in your Google Sheet log while keeping the “Payment: Split” label for clarity. Would you like that next?

You said:
Uploaded image
Uploaded image
change already has an amount and I havent entered anything. I still see this erro 
ChatGPT said:
Perfect debugging screenshots — they tell me exactly what’s going on.
Here’s the breakdown and the quick fixes 👇

🧩 1. "Identifier 'Order' has already been declared"
That error means your browser has loaded the same JavaScript twice.

✅ Fix:
Open your HTML (sale.html) and scroll to the bottom — you’ll likely see two script references, e.g.:

<script src="script.js"></script>
<script src="script.js"></script>
Remove one of them.
There should only be one line calling your script.

If you have inline JavaScript (like a <script> block with the same code) and an external script.js file, remove the inline one.

Once that’s gone → reload the page → this red error disappears.

💵 2. Change shows a number before entering payment
That’s happening because updatePaymentSummary() runs at startup (via resetPayments()),
and it calculates change = subtotalPaid - grandTotal.

When no payment exists yet (subtotalPaid = 0), the code still runs:

change >= 0 ? `Change: $...` : `Remaining: $...`
If grandTotal is $16.03, you get Remaining: $16.03, but if it’s slightly reversed, you’ll see a "Change" display even before entering.

✅ Clean Fix (update this part in your updatePaymentSummary() function):
Replace this:

if (changeEl) {
  changeEl.textContent =
    change >= 0
      ? `Change: $${change.toFixed(2)}`
      : `Remaining: $${Math.abs(change).toFixed(2)}`;
}
With this safer version:

if (changeEl) {
  if (order._payment.cash === 0 && order._payment.card === 0) {
    changeEl.textContent = "Change: —";
  } else if (change >= 0) {
    changeEl.textContent = `Change: $${change.toFixed(2)}`;
  } else {
    changeEl.textContent = `Remaining: $${Math.abs(change).toFixed(2)}`;
  }
}
✅ Result:

When no payment is entered yet → shows a neutral dash “Change: —”

Once payment starts, it’ll switch dynamically to Remaining or Change.

🧠 Summary
Issue	Fix
Duplicate “Order” declaration	Remove extra <script src="script.js"></script> or inline script copy
Change showing immediately	Add conditional logic above so it only shows once payment > 0
After these two updates:

Your products stay visible and clickable ✅

Change will only appear after payment is entered ✅

Console should show no red errors ✅

Paypad + split payments will work normally ✅

Would you like me to include one last optional enhancement:

when you commit a cash or card payment, it shows that amount live under the receipt (e.g., “Cash: $10 | Card: $6.03”)?
It makes it super clear for tracking split payments visually.

You said:
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <style>
    html, body {
      touch-action: manipulation;
      overscroll-behavior: contain;
    }
  </style>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Kinaya Rising POS</title>

  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
    crossorigin="anonymous"
    referrerpolicy="no-referrer"
  />
  <link
    href="https://fonts.googleapis.com/css2?family=Audiowide&family=Libre+Barcode+128&family=Roboto:wght@300;400;700&display=swap"
    rel="stylesheet"
  />

  <link rel="stylesheet" href="styles.css" />
  <script>
    if (sessionStorage.getItem("posUnlocked") !== "true") {
      window.location.href = "index.html";
    }
  </script>
  <script src="script.js" defer></script>
</head>

<!-- ====== NAVIGATION ====== -->
  <nav class="kinaya-nav">
    <a href="sale.html" class="nav-btn active">
      <i class="fas fa-cash-register"></i>
      <span>Sales</span>
    </a>
    <a href="inventory.html" class="nav-btn">
      <i class="fas fa-boxes"></i>
      <span>Inventory</span>
    </a>
    <a href="data.html" class="nav-btn">
      <i class="fas fa-chart-line"></i>
      <span>Data</span>
    </a>
  </nav>

<body>
  <header><h1>Purchase Order</h1></header>

  <main class="main-container flex-row">
    <section class="order flex-column">
      <article class="receipt flex-column">
        <div class="company-info flex-column">
          <p id="company-name">Kinaya Rising</p>
          <p id="company-website">KinayaRising.com</p>
          <p id="company-email">KinayaRising@gmail.com</p>
          <p id="invoice-number">Invoice #1000</p>
          <p id="current-date"></p>
        </div>

        <div class="receipt-details">
          <table class="details-details">
            <thead>
              <tr><td class="dotted-border" colspan="5"></td></tr>
              <tr><td class="empty-border" colspan="5"></td></tr>
              <tr>
                <th class="product-name">Product Name</th>
                <th class="quantity">Qty</th>
                <th class="price">Price</th>
                <th class="subtotal">Sub</th>
                <th class="delete">Del</th>
              </tr>
              <tr><td class="dotted-border" colspan="5"></td></tr>
              <tr><td class="empty-border" colspan="5"></td></tr>
            </thead>
            <tbody id="receipt-details"></tbody>
          </table>

          <div class="receipt-summary">
            <table class="summary-table">
              <tbody id="summary-section">
                <tr><td class="dotted-border" colspan="3"></td></tr>
                <tr><td class="empty-border" colspan="3"></td></tr>
                <tr><td>Subtotal:</td><td id="subtotal-summary">$0.00</td></tr>
                <tr><td>Tax:</td><td id="tax-summary">$0.00</td></tr>
                <tr><td>Grand Total:</td><td id="grandtotal-summary">$0.00</td></tr>
                <tr><td class="dotted-border" colspan="3"></td></tr>
                <tr><td class="empty-border" colspan="3"></td></tr>
                <tr>
                  <td>Amount Paid:</td>
                  <td><input type="number" id="amount-paid-input" step="0.01" min="0" placeholder="0.00" /></td>
                </tr>
                <tr>
                <td id="change-title">Change:</td>
                <td id="change-amount">$0.00</td>
                <tr><td>Payment Type:</td><td id="payment-type">Cash</td></tr>
                <tr><td>Split Payment:</td><td id="split-info">None</td></tr>
                <tr><td class="dotted-border" colspan="3"></td></tr>
                <tr><td class="empty-border" colspan="3"></td></tr>
                <tr>
                  <td>Email:</td>
                  <td colspan="2">
                    <input
                      type="email"
                      id="customer-email"
                      placeholder="customer@example.com"
                      style="width:100%;padding:4px;border:1px solid #333;border-radius:4px;background:#111;color:#A7E1EE;"
                    />
                  </td>
                </tr>
                <tr>
  <td>Share Email?</td>
  <td>
    <label class="switch">
      <input type="checkbox" id="email-toggle" checked />
      <span class="slider"></span>
    </label>
  </td>
</tr>

              </tbody>
            </table>

            <div id="submit-row" style="display:none; text-align:center; padding:1rem 0;">
              <button id="submit-sale" class="submit-sale-btn">Submit Sale</button>
            </div>
          </div>

          <div class="receipt-footer">Thank You For Your Support!</div>

          <div class="toolbar flex-row">
            <button id="cash-btn" class="toolbar-btn" title="Cash Payment"><i class="fa-solid fa-money-bill-wave"></i></button>
            <button id="card-btn" class="toolbar-btn" title="Card Payment"><i class="fa-solid fa-credit-card"></i></button>
            <button id="clear-order-btn" class="toolbar-btn" title="Clear Order"><i class="fa-solid fa-trash"></i></button>
            <button id="toggle-return" class="toolbar-btn" title="Toggle Return Mode"><i class="fa-solid fa-rotate-left"></i></button>
          </div>
        </div>
      </article>
    </section>

    <section class="menu-payment grid">
      <div class="menu flex-row" id="menu"></div>
    </section>
  </main>

  <div id="submit-modal" class="modal hidden">
    <div class="modal-content">
      <p>✅ Payment complete! Submit this ticket?</p>
      <div class="modal-buttons">
        <button id="modal-cancel">Cancel</button>
        <button id="modal-ok">OK</button>
      </div>
    </div>
  </div>

  <div id="payment-overlay" class="hidden">
  <div class="paypad" id="paypad">
    <button id="close-paypad-btn" class="paypad-close" title="Close">
      <i class="fa-solid fa-xmark"></i>
    </button>

    <div id="paypad-display" class="paypad-display">$0</div>

    <button class="paypad-btn number" data-value="7">7</button>
    <button class="paypad-btn number" data-value="8">8</button>
    <button class="paypad-btn number" data-value="9">9</button>
    <button class="paypad-btn number" data-value="4">4</button>
    <button class="paypad-btn number" data-value="5">5</button>
    <button class="paypad-btn number" data-value="6">6</button>
    <button class="paypad-btn number" data-value="1">1</button>
    <button class="paypad-btn number" data-value="2">2</button>
    <button class="paypad-btn number" data-value="3">3</button>
    <button class="paypad-btn number" data-value="0">0</button>
    <button class="paypad-btn" data-value="C">C</button>
    <button class="paypad-btn" data-value="←">←</button>
    <button class="paypad-btn span3-col" data-value="Enter">Enter</button>
  </div>
</div>
<script src="script.js" defer></script>
</body>
</html>
ChatGPT said:
Bingo 🎯 — I see exactly why you’re still getting

“Identifier ‘Order’ has already been declared.”

You have two script references in your HTML.
That means your JavaScript runs twice, redeclaring every class (like Order).

🔍 The duplicate lines are here:
You’ve got one copy in <head>:

<script src="script.js" defer></script>
…and another copy at the bottom of <body>:

<script src="script.js" defer></script>
✅ Fix:
Simply delete the second one at the bottom of the file.
So your final lines should look like this:

  </div>
</div>
</body>
</html>
That’s it — one <script src="script.js" defer></script> in the <head> is enough.

🧩 Why this matters
When the browser loads both:

It runs all your code once (okay ✅).

Then it loads it again — redeclares every class and function (❌ causes the duplicate Order error).

That error stops further code execution, so parts of your app (like product interaction or paypad logic) break or act weird.

💡 Optional improvement
If you ever add more pages (inventory.html, data.html, etc.), it’s best practice to load your shared logic in the head (as you’re already doing) with defer, so it executes after the HTML is parsed.

Once you remove that bottom script tag:

The red error disappears

Your paypad and product interactions stay stable

The change display fix will behave correctly

Would you like me to show you a tiny improvement that makes the paypad overlay auto-focus on the entered payment type (so you can just type digits immediately without touching the screen)?

You said:
Uploaded image
I don't need to see change:/Remaining there but I do want to see $ Cash + $ Card
ChatGPT said:
Perfect — that’s an excellent UX call.
You want to hide “Change / Remaining” entirely and instead show the actual split breakdown, e.g.:

💵 Cash: $10.00 💳 Card: $6.03

This is very easy to do inside your existing updatePaymentSummary() — we’ll just swap the change logic for a live payment summary line.

🧩 Here’s your improved version of updatePaymentSummary()
Replace the entire function with this:

function updatePaymentSummary() {
  const grandDisplay = document.getElementById("grandtotal-summary");
  const splitEl = document.getElementById("split-info");
  const paymentTypeEl = document.getElementById("payment-type");
  const changeEl = document.getElementById("change-amount");

  // get totals
  const subtotalPaid = order._payment.cash + order._payment.card;
  let grandTotal = 0;
  if (grandDisplay) {
    const text = grandDisplay.textContent.replace(/[^0-9.]/g, "");
    grandTotal = parseFloat(text) || 0;
  }

  // update the payment breakdown
  const cashText =
    order._payment.cash > 0 ? `$${order._payment.cash.toFixed(2)}` : "$0.00";
  const cardText =
    order._payment.card > 0 ? `$${order._payment.card.toFixed(2)}` : "$0.00";

  if (splitEl) splitEl.textContent = `Cash: ${cashText}  |  Card: ${cardText}`;
  if (paymentTypeEl)
    paymentTypeEl.textContent =
      order._payment.cash && order._payment.card
        ? "Split"
        : order._payment.cash
        ? "Cash"
        : order._payment.card
        ? "Card"
        : "—";

  // remove the old "Change / Remaining" display
  if (changeEl) changeEl.textContent = "";

  toggleSubmitVisibility();
}
✨ What this does
Replaces the “Change” line with a clear, readable cash/card breakdown.

Keeps the split-info cell dynamic — always shows both values.

Still updates totals and submit visibility correctly.

Works for any combination:

Only cash → “Cash: $16.03 | Card: $0.00”

Only card → “Cash: $0.00 | Card: $16.03”

Both → “Cash: $10.00 | Card: $6.03”

🧠 Optional (UI polish)
If you want it cleaner, you can change the separator to a bullet or line break:

splitEl.innerHTML = `💵 Cash: ${cashText}<br>💳 Card: ${cardText}`;
Just make sure to add style="line-height:1.4" to your table cell so it looks neat.

Would you like me to show you how to conditionally hide the “Change” row entirely in HTML so the table collapses cleanly (no blank gap)?

You said:
Uploaded image
Uploaded image
I'm getting these again and it just looks bad
ChatGPT said:
Got it — the interface looks great overall, you’re just seeing:

The “Change” row still showing blank placeholders (not needed).

The GitHub Pages “Run cancelled” email (build failing due to a workflow issue, not your code).

Let’s fix both clearly.

🧩 PART 1 — Clean up the Receipt UI
🎯 Goal
Hide the “Change” row entirely and show only:

Payment Type: Cash / Card / Split
Split Payment: Cash: $X | Card: $Y
✅ Step 1: Update your HTML
In your <tbody id="summary-section">, remove or comment out this block:

<tr>
  <td id="change-title">Change:</td>
  <td id="change-amount">$0.00</td>
</tr>
You can safely delete it.
Your summary section should jump directly from “Amount Paid” to “Payment Type”.

✅ Step 2: Update your updatePaymentSummary() (final clean version)
Replace your current function with this:

function updatePaymentSummary() {
  const grandDisplay = document.getElementById("grandtotal-summary");
  const splitEl = document.getElementById("split-info");
  const paymentTypeEl = document.getElementById("payment-type");

  // calculate totals
  const subtotalPaid = order._payment.cash + order._payment.card;
  let grandTotal = 0;
  if (grandDisplay) {
    const text = grandDisplay.textContent.replace(/[^0-9.]/g, "");
    grandTotal = parseFloat(text) || 0;
  }

  // build display text
  const cashText =
    order._payment.cash > 0 ? `$${order._payment.cash.toFixed(2)}` : "$0.00";
  const cardText =
    order._payment.card > 0 ? `$${order._payment.card.toFixed(2)}` : "$0.00";

  // update display
  if (splitEl) splitEl.textContent = `Cash: ${cashText} | Card: ${cardText}`;

  if (paymentTypeEl) {
    paymentTypeEl.textContent =
      order._payment.cash && order._payment.card
        ? "Split"
        : order._payment.cash
        ? "Cash"
        : order._payment.card
        ? "Card"
        : "—";
  }

  toggleSubmitVisibility();
}
✅ No change/remaining line
✅ Always shows Cash + Card values
✅ Works for single or split payments

🧰 PART 2 — GitHub Pages “Run Cancelled” email
That email isn’t from your POS code — it’s from your GitHub Pages deployment workflow.

🩻 What it means
The GitHub Action that publishes your site ran but one step (usually the “deploy” step) was cancelled — often caused by:

You pushing multiple commits quickly (GitHub cancels older runs automatically).

Temporary rate limits or a misconfigured workflow YAML file.

A permission issue (e.g., missing GITHUB_TOKEN or changed branch name).

✅ To confirm it’s fine:
Go to your repo → Actions tab

Click “pages build and deployment” → latest run

If “build” succeeded and “deploy” was “cancelled”, check the note:

If it says “Superseded by newer run” → ✅ totally normal.

If it says “Permission denied” or “Branch not found” → I can fix that YAML file for you.

Would you like me to check what’s probably wrong in your .github/workflows/pages.yml file (the one that handles deploy)?
You can paste that file’s contents here — I’ll point out exactly why “deploy” is being cancelled.

You said:
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
    const change = isReturn ? -quantity : quantity;
    const existingLine = this._order.find(line => line.sku === sku);

    if (existingLine) {
      existingLine.quantity += change;
      existingLine.subtotal = Utilities.roundToTwo(existingLine.quantity * existingLine.price);
      existingLine.tax = Utilities.roundToTwo(existingLine.subtotal * 0.07);
      if (existingLine.quantity === 0) {
        this._order = this._order.filter(line => line.sku !== sku);
      }
    } else {
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
    toggleSubmitVisibility();
  }
}

// ===========================================================
// UTILITIES
// ===========================================================
class Utilities {
  static convertFloatToString(float) {
    const priceParams = { style: "currency", currency: "USD" };
    if (float < 0) return (${Math.abs(float).toLocaleString("en-US", priceParams)});
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
  static renderMenu(orderInstance) {
    const menuContainer = document.getElementById("menu");
    if (!menuContainer) return;
    menuContainer.innerHTML = "";

    if (!orderInstance.menu.length) {
      menuContainer.innerHTML = "<p style='color:white'>No active products found.</p>";
      return;
    }

    const frag = document.createDocumentFragment();
    orderInstance.menu.forEach(item => {
      const figure = document.createElement("figure");
      figure.classList.add("menu-item");
      figure.setAttribute("data-sku", JSON.stringify(item));
      figure.innerHTML = 
        <img src="${item.image}" alt="${item.description}" class="menu-image"
             style="width:150px;height:150px;object-fit:cover;border-radius:12px;">
        <figcaption style="font-weight:bold;margin-top:8px;">${item.description}</figcaption>
        <figcaption style="font-size:0.9em;opacity:0.8;">${item.sku}</figcaption>
        <figcaption style="color:#A7E1EE;margin-top:4px;">
          ${Utilities.convertFloatToString(item.price)}
        </figcaption>
      ;
      frag.appendChild(figure);
    });
    menuContainer.appendChild(frag);
  }

  static receiptDetails(orderInstance) {
    const receiptDetails = document.getElementById("receipt-details");
    if (!receiptDetails) return;
    receiptDetails.innerHTML = "";

    if (!orderInstance._order.length) {
      receiptDetails.innerHTML = <tr><td colspan="5" style="color:#aaa;text-align:center;">No items yet</td></tr>;
      Ui.updateTotals(orderInstance);
      return;
    }

    orderInstance._order.forEach((line, i) => {
      const row = document.createElement("tr");
      const style = line.quantity < 0 ? "color:#e63946;font-weight:bold;" : "";
      row.innerHTML = 
        <td style="${style}">${line.description}</td>
        <td style="${style}">${line.quantity}</td>
        <td style="${style}">${Utilities.convertFloatToString(line.price)}</td>
        <td style="${style}">${Utilities.convertFloatToString(line.subtotal)}</td>
        <td class="delete" data-delete="${i}" title="Remove item"><i class="fas fa-backspace"></i></td>;
      receiptDetails.appendChild(row);
    });

    Ui.attachDeleteHandlers(orderInstance);
    Ui.updateTotals(orderInstance);
  }

  static attachDeleteHandlers(orderInstance) {
    document.querySelectorAll(".delete").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const index = parseInt(btn.getAttribute("data-delete"));
        if (isNaN(index)) return;
        const line = orderInstance._order[index];
        if (!line) return;
        line.quantity--;
        line.subtotal = Utilities.roundToTwo(line.quantity * line.price);
        line.tax = Utilities.roundToTwo(line.subtotal * 0.07);
        if (line.quantity <= 0) orderInstance._order.splice(index, 1);
        Ui.receiptDetails(orderInstance);
        Ui.updateTotals(orderInstance);
        updatePaymentUI();
        toggleSubmitVisibility();
      });
    });
  }

  static updateTotals(orderInstance) {
    const subtotal = orderInstance._order.reduce((a, l) => a + l.subtotal, 0);
    const tax = orderInstance._order.reduce((a, l) => a + l.tax, 0);
    const grandTotal = subtotal + tax;
    const fmt = v => Utilities.convertFloatToString(v);
    document.getElementById("subtotal-summary").textContent = fmt(subtotal);
    document.getElementById("tax-summary").textContent = fmt(tax);
    document.getElementById("grandtotal-summary").textContent = fmt(grandTotal);
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
  const emailInput = document.getElementById("customer-email");
  if (!submitRow) return;

  const subtotalPaid = order._payment.cash + order._payment.card;
  const hasEmail = emailInput && emailInput.value.trim().length > 0;
  const grandDisplay = document.getElementById("grandtotal-summary");
  const text = grandDisplay ? grandDisplay.textContent.replace(/[^0-9.]/g, "") : "0";
  const grandTotal = parseFloat(text) || 0;

  const canSubmit = order._order.length > 0 && subtotalPaid >= grandTotal && hasEmail;
  submitRow.style.display = canSubmit ? "block" : "none";
}

// ===========================================================
// SPLIT PAYMENT + PAYPAD (UPGRADED)
// ===========================================================
let grandTotal = 0;
let currentType = ""; // 'Cash' or 'Card'

// ---------- UPDATE TOTAL + CHANGE ----------
function updatePaymentSummary() {
  const grandDisplay = document.getElementById("grandtotal-summary");
  const changeEl = document.getElementById("change-amount");
  const subtotalPaid = order._payment.cash + order._payment.card;
  if (grandDisplay) {
    const text = grandDisplay.textContent.replace(/[^0-9.]/g, "");
    grandTotal = parseFloat(text) || 0;
  }
  const change = subtotalPaid - grandTotal;
  if (changeEl) {
    changeEl.textContent =
      change >= 0
        ? Change: $${change.toFixed(2)}
        : Remaining: $${Math.abs(change).toFixed(2)};
  }
  updateSplitInfo(
    order._payment.cash && order._payment.card
      ? "Split"
      : order._payment.cash
      ? "Cash"
      : order._payment.card
      ? "Card"
      : "None"
  );
  toggleSubmitVisibility();
}

// ---------- SHOW PAYPAD ----------
function openPaypad(type) {
  currentType = type;
  const overlay = document.getElementById("payment-overlay");
  const displayEl = document.getElementById("paypad-display");
  overlay.classList.remove("hidden");
  let existing = order._payment[type.toLowerCase()] || 0;
  buffer = (existing * 100).toString(); // preload cents
  renderDisplay();
  displayEl.dataset.mode = type;
}

// ---------- PAYPAD CORE ----------
const overlay = document.getElementById("payment-overlay");
const displayEl = document.getElementById("paypad-display");
const buttons = document.querySelectorAll(".paypad-btn");
const closeBtn = document.getElementById("close-paypad-btn");
let buffer = "";

function formatCurrency(val) {
  return $${(parseFloat(val) || 0).toFixed(2)};
}
function renderDisplay() {
  const num = parseFloat(buffer || "0") / 100;
  displayEl.textContent = formatCurrency(num);
}
function commitPayment() {
  const value = parseFloat(buffer || "0") / 100;
  if (currentType === "Cash") order._payment.cash = value;
  if (currentType === "Card") order._payment.card = value;
  overlay.classList.add("hidden");
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

// ---------- RESET + INITIALIZE ----------
function resetPayments() {
  order._payment = { cash: 0, card: 0 };
  updatePaymentSummary();
}
resetPayments();

// ===========================================================
// MENU ITEM CLICK HANDLER
// ===========================================================
document.addEventListener("click", e => {
  const menuItem = e.target.closest(".menu-item");
  if (!menuItem) return;
  const data = menuItem.getAttribute("data-sku");
  if (!data) return;
  order.addOrderLine(1, data, isReturnMode);
});

I need the amount paid to update with what was entered. just tell me if the paid cash or card on the split payyment line. Everything else is perfect
ChatGPT said:
Perfect — your setup is already 95% there.
We’ll just make the Amount Paid field dynamically show the total entered (cash + card), and the Split Payment line show which type(s) were used.

✅ Replace your current updatePaymentSummary() with this final version:
function updatePaymentSummary() {
  const grandDisplay = document.getElementById("grandtotal-summary");
  const amountPaidEl = document.getElementById("amount-paid-input");
  const splitEl = document.getElementById("split-info");
  const paymentTypeEl = document.getElementById("payment-type");

  // calculate totals
  const subtotalPaid = order._payment.cash + order._payment.card;
  let grandTotal = 0;
  if (grandDisplay) {
    const text = grandDisplay.textContent.replace(/[^0-9.]/g, "");
    grandTotal = parseFloat(text) || 0;
  }

  // show total paid in the field cleanly
if (amountPaidEl) {
  if (document.activeElement !== amountPaidEl) {
    amountPaidEl.value = subtotalPaid > 0 ? subtotalPaid.toFixed(2) : "";
  }
}


  // build display text for split line
  const cashUsed = order._payment.cash > 0;
  const cardUsed = order._payment.card > 0;
  const cashText = cashUsed ? `$${order._payment.cash.toFixed(2)}` : "";
  const cardText = cardUsed ? `$${order._payment.card.toFixed(2)}` : "";

  if (splitEl) {
    if (cashUsed && cardUsed) {
      splitEl.textContent = `Cash: ${cashText}  |  Card: ${cardText}`;
    } else if (cashUsed) {
      splitEl.textContent = `Cash: ${cashText}`;
    } else if (cardUsed) {
      splitEl.textContent = `Card: ${cardText}`;
    } else {
      splitEl.textContent = "$0.00";
    }
  }

  // update payment type label
  if (paymentTypeEl) {
    paymentTypeEl.textContent =
      cashUsed && cardUsed ? "Split" : cashUsed ? "Cash" : cardUsed ? "Card" : "—";
  }

  toggleSubmitVisibility();
}
💡 What this does
Feature	Behavior
Amount Paid	Automatically updates to total of Cash + Card
Split line	Shows `Cash: $X
Payment Type	Shows “Cash”, “Card”, or “Split”
No extra “Change/Remaining”	Clean, minimal layout
💬 Result example:

Amount Paid: 16.03
Payment Type: Split
Split Payment: Cash: $10.00 | Card: $6.03
Everything else stays exactly as-is — totals, receipts, and submit logic all continue working.




that was so not it it's showing 


No file chosenNo file chosen
ChatGPT can make mistakes. Check important info.
