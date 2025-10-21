// ===========================================================
// Kinaya Rising POS (Stable October 2025) - FIXED PAYPAD OVERLAY
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
// ACCESS GATE - Require passcode before using POS
// ===========================================================
window.addEventListener("load", () => {
  const gate = document.getElementById("passcode-screen");
  const input = document.getElementById("passcode-input");
  const button = document.getElementById("passcode-btn");
  const errorMsg = document.getElementById("passcode-error");

  if (!gate || !input || !button) return;

  const PASSCODE = "Lumina2025"; // 🌿 Change to your preferred code

  if (sessionStorage.getItem("posUnlocked") === "true") {
    gate.style.display = "none";
    return;
  }

  const unlock = () => {
    if (input.value.trim() === PASSCODE) {
      gate.style.opacity = "0";
      setTimeout(() => {
        gate.style.display = "none";
        sessionStorage.setItem("posUnlocked", "true");
      }, 400);
    } else {
      errorMsg.style.display = "block";
      input.value = "";
    }
  };

  button.addEventListener("click", unlock);
  input.addEventListener("keypress", e => {
    if (e.key === "Enter") unlock();
  });
});

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
// PAYMENT + PAYPAD FIXED
// ===========================================================
const paymentOverlay = document.getElementById("payment-overlay");
const closeBtn = document.getElementById("close-paypad-btn");
const cashBtn = document.getElementById("cash-btn");
const cardBtn = document.getElementById("card-btn");
const amountInput = document.getElementById("amount-paid-input");
const paymentTypeEl = document.getElementById("payment-type");
const changeEl = document.getElementById("change-amount");
const splitInfoEl = document.getElementById("split-info");

let activeMethod = null;
let currentInput = "";

// Live display updater
function updatePaypadDisplay() {
  const display = document.getElementById("paypad-display");
  const cents = parseFloat(currentInput);
  const numeric = isNaN(cents) ? 0 : cents / 100;
  if (display) display.textContent = `$${numeric.toFixed(2)}`;
}

// --- Open & Close Overlay Safely ---
function openPaypad(method) {
  activeMethod = method;
  currentInput = "";
  updatePaypadDisplay();

  if (paymentOverlay) {
    paymentOverlay.style.display = "flex";
    paymentOverlay.style.pointerEvents = "all";
    paymentOverlay.classList.add("active");
  }

  if (paymentTypeEl) paymentTypeEl.textContent = method.toUpperCase();
}

function closePaypad() {
  activeMethod = null;
  currentInput = "";

  if (paymentOverlay) {
    paymentOverlay.classList.remove("active");
    paymentOverlay.style.pointerEvents = "none";
    paymentOverlay.style.opacity = "0";
    // Smooth fade-out
    setTimeout(() => {
      paymentOverlay.style.display = "none";
      paymentOverlay.style.opacity = "1";
    }, 250);
  }
}

if (cashBtn) cashBtn.addEventListener("click", () => openPaypad("cash"));
if (cardBtn) cardBtn.addEventListener("click", () => openPaypad("card"));
if (closeBtn) closeBtn.addEventListener("click", closePaypad);

document.querySelectorAll(".paypad-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-id");
    if (!id) return;
    if (id === "clear") currentInput = "";
    else if (id === "back") currentInput = currentInput.slice(0, -1);
    else if (id === "close-sale") finalizePaypadAmount();
    else if (!isNaN(id)) currentInput += id;
    updatePaypadDisplay();
  });
});

function finalizePaypadAmount() {
  const cents = parseFloat(currentInput);
  const amount = isNaN(cents) ? 0 : cents / 100;
  if (amount <= 0 || !activeMethod) {
    alert("Enter a valid amount");
    return;
  }
  order._payment[activeMethod] = Utilities.roundToTwo(order._payment[activeMethod] + amount);
  updatePaymentUI();
  toggleSubmitVisibility();
  closePaypad();
}

// ===========================================================
// PAYMENT UI + SUBMISSION
// ===========================================================
function orderTotal() {
  return order._order.reduce((a, l) => a + l.subtotal + l.tax, 0);
}
function totalPaid() {
  return Object.values(order._payment).reduce((a, b) => a + b, 0);
}
function updatePaymentUI(reset = false) {
  const total = orderTotal();
  const paid = reset ? 0 : totalPaid();
  const change = Math.max(0, paid - total);
  if (amountInput) amountInput.value = paid ? paid.toFixed(2) : "";
  if (changeEl) changeEl.textContent = Utilities.convertFloatToString(change);
  const cash = order._payment.cash, card = order._payment.card;
  if (splitInfoEl)
    splitInfoEl.textContent = cash && card ? `${Utilities.convertFloatToString(cash)} Cash + ${Utilities.convertFloatToString(card)} Card`
      : cash ? `${Utilities.convertFloatToString(cash)} Cash`
      : card ? `${Utilities.convertFloatToString(card)} Card`
      : "None";
}

// ===========================================================
// SALE SUBMIT
// ===========================================================
const submitRow = document.getElementById("submit-row");
const submitBtn = document.getElementById("submit-sale");
const emailInput = document.getElementById("customer-email");
const modal = document.getElementById("submit-modal");
const modalCancel = document.getElementById("modal-cancel");
const modalOk = document.getElementById("modal-ok");

function toggleSubmitVisibility() {
  const ready = totalPaid() >= orderTotal();
  const hasEmail = emailInput && emailInput.value.trim();
  if (submitRow) submitRow.style.display = ready && hasEmail && order._order.length ? "table-row" : "none";
}
if (emailInput) emailInput.addEventListener("input", toggleSubmitVisibility);

if (submitBtn) submitBtn.addEventListener("click", () => modal.classList.remove("hidden"));
if (modalCancel) modalCancel.addEventListener("click", () => modal.classList.add("hidden"));
if (modalOk) modalOk.addEventListener("click", () => {
  modal.classList.add("hidden");
  submitSale();
});

function submitSale() {
  const email = (emailInput && emailInput.value.trim()) || "";
  const date = new Date().toLocaleDateString("en-US");
  const split = splitInfoEl ? splitInfoEl.textContent : "";
  const rows = order._order.map(l => ({
    Date: date,
    Sku: l.sku,
    Product: l.description,
    Qty: l.quantity,
    Price: l.price,
    Subtotal: l.subtotal,
    Tax: l.tax,
    Total: Utilities.roundToTwo(l.subtotal + l.tax),
    Email: email,
    SplitPayment: split,
  }));

  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxrv2qEiZ5mOIa9w_cnde4n9rZdJERT08bqja7gUz2V_4GtkwAYodfuufIroRCwUVolnw/exec";

  fetch(WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows),
  })
    .then(() => {
      alert("✅ Sale submitted successfully! Check your sheet for confirmation.");
      order._order = [];
      order._payment = { cash: 0, card: 0 };
      Ui.receiptDetails(order);
      Ui.updateTotals(order);
      updatePaymentUI(true);
      toggleSubmitVisibility();
    })
    .catch(err => {
      alert("⚠️ Error submitting sale: " + err.message);
      console.error(err);
    });
}

// ===========================================================
// FINAL INITIALIZATION
// ===========================================================
updatePaymentUI();
toggleSubmitVisibility();

// ===================== RECONNECT BUTTONS AFTER UNLOCK =====================
document.addEventListener("DOMContentLoaded", () => {
  const passcodeScreen = document.getElementById("passcode-screen");
  const passcodeInput = document.getElementById("passcode-input");
  const passcodeBtn = document.getElementById("passcode-btn");
  const passcodeError = document.getElementById("passcode-error");

  const CORRECT_CODE = "2025"; // set your access code here

  passcodeBtn.addEventListener("click", () => {
    if (passcodeInput.value === CORRECT_CODE) {
      passcodeScreen.style.opacity = "0";
      setTimeout(() => {
        passcodeScreen.style.display = "none";
        initPOS(); // load POS logic AFTER unlock
      }, 400);
    } else {
      passcodeError.style.display = "block";
    }
  });

  passcodeInput.addEventListener("keypress", e => {
    if (e.key === "Enter") passcodeBtn.click();
  });
});

// ===================== MAIN POS INITIALIZATION =====================
function initPOS() {
  console.log("🔓 POS unlocked and initialized");

  const clearBtn = document.getElementById("clear-btn");
  const toggleReturnBtn = document.getElementById("toggle-return");
  const menuContainer = document.getElementById("menu");
  const receiptDetails = document.getElementById("receipt-details");

  let returnMode = false;

  // CLEAR ORDER
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      receiptDetails.innerHTML = "";
      updateTotals();
    });
  }

  // TOGGLE RETURN MODE
  if (toggleReturnBtn) {
    toggleReturnBtn.addEventListener("click", () => {
      returnMode = !returnMode;
      toggleReturnBtn.classList.toggle("active", returnMode);
      console.log("🔁 Return mode:", returnMode);
    });
  }

  // ADD PRODUCT FROM MENU
  if (menuContainer) {
    menuContainer.addEventListener("click", (e) => {
      const item = e.target.closest(".menu-item");
      if (!item) return;

      const name = item.querySelector("figcaption:nth-child(2)")?.innerText || "Unknown";
      const priceText = item.querySelector("figcaption:last-child")?.innerText || "$0.00";
      const price = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${name}</td>
        <td class="quantity">1</td>
        <td class="price">$${price.toFixed(2)}</td>
        <td class="subtotal">$${price.toFixed(2)}</td>
        <td class="delete"><i class="fa-solid fa-xmark"></i></td>
      `;
      receiptDetails.appendChild(tr);
      updateTotals();
    });
  }

  // DELETE ITEM
  receiptDetails.addEventListener("click", (e) => {
    if (e.target.closest(".delete")) {
      e.target.closest("tr").remove();
      updateTotals();
    }
  });

  // CALCULATOR EVENTS
  const overlay = document.getElementById("payment-overlay");
  const closeBtn = document.getElementById("close-paypad-btn");
  const enterBtn = document.querySelector('[data-id="close-sale"]');

  if (closeBtn) closeBtn.addEventListener("click", () => overlay.classList.remove("active"));
  if (enterBtn) enterBtn.addEventListener("click", () => overlay.classList.remove("active"));
}

// ===================== BASIC TOTALS CALC =====================
function updateTotals() {
  let subtotal = 0;
  document.querySelectorAll("#receipt-details tr").forEach(row => {
    const sub = parseFloat(row.querySelector(".subtotal")?.innerText.replace(/[^0-9.]/g, "")) || 0;
    subtotal += sub;
  });

  const tax = subtotal * 0.07;
  const grand = subtotal + tax;

  document.getElementById("subtotal-summary").textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById("tax-summary").textContent = `$${tax.toFixed(2)}`;
  document.getElementById("grandtotal-summary").textContent = `$${grand.toFixed(2)}`;
}
