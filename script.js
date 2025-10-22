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
          current += '"';
          i++;
        } else if (ch === '"') {
          insideQuotes = !insideQuotes;
        } else if (ch === "," && !insideQuotes) {
          cells.push(current.trim());
          current = "";
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
    menuContainer.appendChild(frag);
  }

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
// SUBMIT SALE TO GOOGLE SHEETS
// ===========================================================
async function submitSale() {
  const { subtotal, tax, total } = (() => {
    const subtotal = order._order.reduce((s, l) => s + l.subtotal, 0);
    const tax = order._order.reduce((s, l) => s + l.tax, 0);
    return { subtotal, tax, total: subtotal + tax };
  })();

  const date = new Date().toLocaleDateString("en-US");
  const email = (emailInput && emailInput.value.trim()) || "";
  const split = splitInfoEl ? splitInfoEl.textContent : "";
  const emailToggle = document.getElementById("email-toggle");
  const sharedEmail = emailToggle && emailToggle.checked ? "Yes" : "No";

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
    "Email Shared?": sharedEmail,
    Payment: split
  }));

  try {
    await fetch("https://script.google.com/macros/s/AKfycbz1Z9NnfDCxWSxirvAE2tKK-mB9135X_uEuei2Wg-r-qptcpT2sNCPWObcGTbAibCZBFw/exec", {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows)
    });

    alert("✅ Sale submitted successfully!");

    order._order = [];
    order._payment = { cash: 0, card: 0 };
    Ui.receiptDetails(order);
    Ui.updateTotals(order);
    updatePaymentUI(true);
    toggleSubmitVisibility();
    if (paymentTypeEl) paymentTypeEl.textContent = "—";
    if (splitInfoEl) splitInfoEl.textContent = "None";
    if (emailInput) emailInput.value = "";
  } catch (err) {
    alert("⚠️ Error submitting sale: " + err.message);
    console.error(err);
  }
}

// ===========================================================
// PAYMENT + UI INTERACTIONS — FINAL BUILD
// ===========================================================

// ---------- GLOBAL UI HANDLERS ----------
let amountPaid = 0;
let paymentType = "";
let grandTotal = 0;

function updatePaymentUI(reset = false) {
  const overlay = document.getElementById("payment-overlay");
  const amountDisplay = document.getElementById("amount-paid");
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

  if (amountDisplay) {
    amountDisplay.textContent = `$${amountPaid.toFixed(2)}`;
  }

  toggleSubmitVisibility();
}

function toggleSubmitVisibility() {
  const submitRow = document.getElementById("submit-row");
  const emailInput = document.getElementById("email-input");
  if (!submitRow) return;

  const emailEntered = emailInput && emailInput.value.trim().length > 0;
  const canSubmit = amountPaid >= grandTotal && emailEntered && order._order.length > 0;

  submitRow.style.display = canSubmit ? "block" : "none";
}

// ===========================================================
// PAYPAD / PAYMENT LOGIC — FINAL FORMATTED VERSION
// ===========================================================
(function setupPaypad() {
  const overlay = document.getElementById("payment-overlay");
  const displayEl = document.getElementById("paypad-display");
  const buttons = document.querySelectorAll(".paypad-btn");
  const closeBtn = document.getElementById("close-paypad-btn");

  const amountPaidInput = document.getElementById("amount-paid-input");
  const changeEl = document.getElementById("change-amount");
  const submitRow = document.getElementById("submit-row");
  const emailInput = document.getElementById("email-input");

  let buffer = ""; // holds digits only

  function formatCurrency(val) {
    return `$${(parseFloat(val) || 0).toFixed(2)}`;
  }

  // --- Display value, moving decimal left by 2
  function renderDisplay() {
    const num = parseFloat(buffer || "0") / 100;
    displayEl.textContent = formatCurrency(num);
  }

  function recalcTotals() {
    const subtotal = order._order.reduce((a, l) => a + l.subtotal, 0);
    const tax = order._order.reduce((a, l) => a + l.tax, 0);
    const grandTotal = subtotal + tax;

    const paid = parseFloat(amountPaidInput.value) || 0;
    const change = paid - grandTotal;

    // show change as read-only, color coded
    changeEl.textContent = formatCurrency(change);
    changeEl.style.color = change >= 0 ? "#A7E1EE" : "#e63946";

    const emailOk = emailInput && emailInput.value.trim().length > 0;
    submitRow.style.display =
      paid >= grandTotal && emailOk && order._order.length > 0 ? "block" : "none";
  }

  // --- When user presses Enter on paypad
  function commitPayment() {
    const value = parseFloat(buffer || "0") / 100;
    amountPaidInput.value = value.toFixed(2);
    recalcTotals();
    overlay.classList.add("hidden");
  }

  // --- Paypad buttons
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

  amountPaidInput.addEventListener("input", recalcTotals);
  amountPaidInput.addEventListener("blur", () => {
    const val = parseFloat(amountPaidInput.value) || 0;
    amountPaidInput.value = val.toFixed(2);
    recalcTotals();
  });
  if (emailInput) emailInput.addEventListener("input", recalcTotals);

  renderDisplay();
})();

// ===========================================================
// RETURN MODE + CLEAR ORDER + EVENT GUARDS
// ===========================================================
(function setupInteractionFixes() {
  const header = document.querySelector("header h1");
  const returnBtn = document.getElementById("toggle-return");
  const clearBtn = document.getElementById("clear-order-btn");
  const cashBtn = document.getElementById("cash-btn");
  const cardBtn = document.getElementById("card-btn");
  const overlay = document.getElementById("payment-overlay");
  const paymentTypeEl = document.getElementById("payment-type");
  const emailInput = document.getElementById("email-input");

  // --- Return banner ---
  function updateReturnBanner() {
    let banner = document.getElementById("return-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "return-banner";
      banner.textContent = "RETURN MODE ACTIVE";
      banner.style.cssText = `
        text-align:center;
        font-family:"Audiowide",sans-serif;
        color:#e63946;
        font-weight:bold;
        margin-top:0.3rem;
        letter-spacing:1px;
        text-shadow:0 0 10px rgba(230,57,70,0.6);
      `;
      header?.insertAdjacentElement("afterend", banner);
    }
    banner.style.display = isReturnMode ? "block" : "none";
  }

  // --- Toggle return mode ---
  if (returnBtn) {
    returnBtn.addEventListener("click", () => {
      isReturnMode = !isReturnMode;
      returnBtn.classList.toggle("active", isReturnMode);
      updateReturnBanner();
    });
    updateReturnBanner();
  }

  // --- Clear order confirmation ---
  if (clearBtn) {
    clearBtn.addEventListener("click", e => {
      if (!confirm("⚠️ This will clear the entire order. Continue?")) {
        e.preventDefault();
        e.stopPropagation();
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

  // --- Paypad openers ---
  function openPaypad(type) {
    paymentType = type;
    if (paymentTypeEl) paymentTypeEl.textContent = type;
    if (overlay) overlay.classList.remove("hidden");
  }

  if (cashBtn) cashBtn.addEventListener("click", () => openPaypad("Cash"));
  if (cardBtn) cardBtn.addEventListener("click", () => openPaypad("Card"));

  // --- Email input triggers submit visibility ---
  if (emailInput) {
    emailInput.addEventListener("input", toggleSubmitVisibility);
  }

  // --- Prevent accidental form reloads ---
  document.addEventListener("submit", e => e.preventDefault());

  // --- Initialize on load ---
  updatePaymentUI(true);
  toggleSubmitVisibility();
})();

// ===========================================================
// MENU ITEM CLICK HANDLER (Add Products to Order)
// ===========================================================
document.addEventListener("click", e => {
  const menuItem = e.target.closest(".menu-item");
  if (!menuItem) return;

  const data = menuItem.getAttribute("data-sku");
  if (!data) return;

  // Add the product to the current order
  order.addOrderLine(1, data, isReturnMode);
});
