// ===========================================================
// Kinaya Rising POS (Stable October 2025) - script.js
// ===========================================================

// ---------- Header Date ----------
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

// ---------- Core Models ----------
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

// ---------- CSV ----------
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

// ---------- Utils ----------
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

// ---------- UI ----------
class Ui {
  static renderMenu(orderInstance) {
    const menuContainer = document.getElementById("menu");
    if (!menuContainer) return;
    menuContainer.innerHTML = "";

    if (!orderInstance.menu || orderInstance.menu.length === 0) {
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

    if (orderInstance._order.length === 0) {
      receiptDetails.innerHTML = `<tr><td colspan="5" style="color:#aaa;text-align:center;">No items yet</td></tr>`;
      Ui.updateTotals(orderInstance);
      return;
    }

    orderInstance._order.forEach((orderLine, index) => {
      const row = document.createElement("tr");
      row.classList.add("receipt-row");
      row.setAttribute("data-index", index);

      const isReturn = orderLine.quantity < 0;
      const returnStyle = isReturn ? "color:#e63946;font-weight:bold;" : "";

      row.innerHTML = `
        <td class="description" style="${returnStyle}">${orderLine.description}</td>
        <td class="quantity" style="${returnStyle}">${orderLine.quantity}</td>
        <td class="price" style="${returnStyle}">${Utilities.convertFloatToString(orderLine.price)}</td>
        <td class="subtotal" style="${returnStyle}">${Utilities.convertFloatToString(orderLine.subtotal)}</td>
        <td class="delete" data-delete="${index}" title="Remove item">
          <i class="fas fa-backspace"></i>
        </td>
      `;
      receiptDetails.appendChild(row);
    });

    Ui.attachDeleteHandlers(orderInstance);
    Ui.updateTotals(orderInstance);
  }

  static attachDeleteHandlers(orderInstance) {
    document.querySelectorAll(".delete").forEach(button => {
      button.addEventListener("click", e => {
        e.stopPropagation();
        const index = parseInt(button.getAttribute("data-delete"));
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

    const fmt = val =>
      val < 0 ? `(${Utilities.convertFloatToString(Math.abs(val))})` : Utilities.convertFloatToString(val);

    document.getElementById("subtotal-summary").textContent = fmt(subtotal);
    document.getElementById("tax-summary").textContent = fmt(tax);
    document.getElementById("grandtotal-summary").textContent = fmt(grandTotal);
  }
}

// ---------- Init ----------
const sheetCsvUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT8TYrKVClp5GXP5Sx7NYGpfRvEMCCNuL40vbcyhdwP6bnvQeQRqJ4xTv6BZUnC5nm7N2N_KwQlHZ2H/pub?gid=30403628&single=true&output=csv";

let isReturnMode = false;
const returnButton = document.getElementById("toggle-return");
const order = new Order();

loadMenuFromSheet(sheetCsvUrl).then(menuData => {
  order.menu = menuData;
  Ui.renderMenu(order);
});

if (returnButton) {
  returnButton.addEventListener("click", () => {
    isReturnMode = !isReturnMode;
    returnButton.classList.toggle("active");
  });
}

document.addEventListener("click", e => {
  const card = e.target.closest(".menu-item");
  if (!card) return;
  const data = card.getAttribute("data-sku");
  order.addOrderLine(1, data, isReturnMode);
});

// =======================================================
// PAYMENT & SPLIT LOGIC
// =======================================================
const paymentOverlay = document.getElementById("payment-overlay");
const closePaypadIcon = document.querySelector(".paypad-close");
const cashBtn = document.getElementById("cash-btn");
const cardBtn = document.getElementById("card-btn");
const clearBtn = document.getElementById("clear-btn");
const manualAmountInput = document.getElementById("amount-paid-input");
const paymentTypeEl = document.getElementById("payment-type");
const changeEl = document.getElementById("change-amount");
const splitInfoEl = document.getElementById("split-info");

let activeMethod = null;
let currentInput = "";

function openPaypad(method) {
  activeMethod = method;
  currentInput = "";
  const display = document.getElementById("paypad-display");
  if (display) display.textContent = "$0.00";
  paymentOverlay.classList.add("active");
  paymentTypeEl.textContent = method[0].toUpperCase() + method.slice(1);
}
function closePaypad() {
  activeMethod = null;
  currentInput = "";
  paymentOverlay.classList.remove("active");
}

if (closePaypadIcon) closePaypadIcon.addEventListener("click", closePaypad);
if (cashBtn) cashBtn.addEventListener("click", () => openPaypad("cash"));
if (cardBtn) cardBtn.addEventListener("click", () => openPaypad("card"));

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (!confirm("Clear current order?")) return;
    order._order = [];
    order._payment = { cash: 0, card: 0 };
    Ui.receiptDetails(order);
    Ui.updateTotals(order);
    updatePaymentUI(true);
    toggleSubmitVisibility();
  });
}

// Paypad buttons
document.querySelectorAll(".paypad-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-id");
    if (!id) return;

    if (id === "clear") currentInput = "";
    else if (id === "back") currentInput = currentInput.slice(0, -1);
    else if (id === "close-sale") finalizePaypadAmount();
    else if (!isNaN(id)) currentInput += id;

    const display = document.getElementById("paypad-display");
    const cents = parseFloat(currentInput);
    const numeric = isNaN(cents) ? 0 : cents / 100;
    if (display) display.textContent = `$${numeric.toFixed(2)}`;
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
  const paid = totalPaid();
  if (manualAmountInput) manualAmountInput.value = paid.toFixed(2);

  updatePaymentUI();
  toggleSubmitVisibility();
  closePaypad();
}

if (manualAmountInput) {
  manualAmountInput.addEventListener("input", () => {
    const typed = parseFloat(manualAmountInput.value);
    const total = isNaN(typed) ? 0 : Math.max(0, typed);
    const bucket = activeMethod || "cash";
    const other = bucket === "cash" ? "card" : "cash";
    order._payment[bucket] = Utilities.roundToTwo(total);
    order._payment[other] = 0;
    paymentTypeEl.textContent = bucket[0].toUpperCase() + bucket.slice(1);
    updatePaymentUI();
    toggleSubmitVisibility();
  });
}

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

  if (manualAmountInput && !reset) {
    manualAmountInput.value = paid ? paid.toFixed(2) : "";
  }
  if (changeEl) {
    changeEl.textContent = Utilities.convertFloatToString(change);
  }

  // ---- Split Payment Display ----
  const cash = order._payment.cash;
  const card = order._payment.card;
  if (splitInfoEl) {
    if (cash > 0 && card > 0) {
      splitInfoEl.textContent = `${Utilities.convertFloatToString(cash)} Cash + ${Utilities.convertFloatToString(card)} Card`;
    } else if (cash > 0) {
      splitInfoEl.textContent = `${Utilities.convertFloatToString(cash)} Cash`;
    } else if (card > 0) {
      splitInfoEl.textContent = `${Utilities.convertFloatToString(card)} Card`;
    } else {
      splitInfoEl.textContent = "None";
    }
  }

  let statusEl = document.getElementById("payment-status");
  if (!statusEl) {
    statusEl = document.createElement("div");
    statusEl.id = "payment-status";
    statusEl.style.position = "fixed";
    statusEl.style.bottom = "6px";
    statusEl.style.left = "50%";
    statusEl.style.transform = "translateX(-50%)";
    statusEl.style.fontWeight = "600";
    statusEl.style.color = "#A7E1EE";
    document.body.appendChild(statusEl);
  }
  statusEl.textContent = `Paid: ${Utilities.convertFloatToString(paid)} / ${Utilities.convertFloatToString(total)} ${paid >= total ? "✔︎" : ""}`;
}

// =======================================================
// SUBMIT SALE (FINAL VERSION - works from GitHub Pages)
// =======================================================
const submitRow = document.getElementById("submit-row");
const submitBtn = document.getElementById("submit-sale");
const emailInput = document.getElementById("customer-email");
const modal = document.getElementById("submit-modal");
const modalCancel = document.getElementById("modal-cancel");
const modalOk = document.getElementById("modal-ok");

function toggleSubmitVisibility() {
  const ready = totalPaid() >= orderTotal();
  const hasEmail = !!(emailInput && emailInput.value.trim());
  if (submitRow)
    submitRow.style.display = ready && hasEmail && order._order.length
      ? "table-row"
      : "none";
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
  const inv = document.getElementById("invoice-number");
  const transactionID = inv
    ? inv.textContent.replace(/^\s*Invoice\s*#\s*/i, "").trim()
    : "";
  const splitDetails = splitInfoEl ? splitInfoEl.textContent : "";

  const rows = order._order.map(line => ({
    Date: date,
    Sku: line.sku,
    ProductTitle: line.description,
    Quantity: line.quantity,
    Price: line.price,
    Subtotal: line.subtotal,
    Tax: line.tax,
    Total: Utilities.roundToTwo(line.subtotal + line.tax),
    TransactionID: transactionID,
    Email: email,
    SplitPayment: splitDetails,
  }));

  // ✅ Use your Google Apps Script endpoint, not GitHub Pages
  const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwR4o7kNq6Ne0w3vwOFdUxnnHC39LAcad4X8rD4sdMz7Y5J5vQPQleCGV9IQYwAZI2pQA/exec";

  fetch(WEB_APP_URL, {
    method: "POST",
    mode: "no-cors", // ✅ important for GitHub + phone
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows),
  })
    .then(() => {
      // no-cors doesn’t return response text, so we just assume success
      alert("✅ Sale submitted successfully! Check your Google Sheet for confirmation.");
      // Optionally clear the order
      order._order = [];
      Ui.receiptDetails(order);
      Ui.updateTotals(order);
      updatePaymentUI(true);
      toggleSubmitVisibility();
    })
    .catch(err => alert("⚠️ Error submitting sale: " + err));
}

// ---------- Initialize ----------
updatePaymentUI();
toggleSubmitVisibility();

// =======================================================
// MOBILE SWIPE-UP PRODUCT DRAWER
// =======================================================
function setupProductDrawer() {
  const drawer = document.querySelector(".menu-payment");
  if (!drawer) return;

  let startY = 0;
  let isDragging = false;

  drawer.addEventListener("touchstart", e => {
    if (window.innerWidth > 768) return; // only mobile
    startY = e.touches[0].clientY;
    isDragging = true;
  });

  drawer.addEventListener("touchend", e => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startY - e.changedTouches[0].clientY;

    // swipe up to expand
    if (diff > 50 && !drawer.classList.contains("expanded")) {
      drawer.classList.add("expanded");
      document.body.classList.add("menu-expanded");
    }
    // swipe down to collapse
    if (diff < -50 && drawer.classList.contains("expanded")) {
      drawer.classList.remove("expanded");
      document.body.classList.remove("menu-expanded");
    }
  });
}

document.addEventListener("DOMContentLoaded", setupProductDrawer);

