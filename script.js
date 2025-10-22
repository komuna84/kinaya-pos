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
// PAYMENT + PAYPAD
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

function updatePaypadDisplay() {
  const display = document.getElementById("paypad-display");
  const cents = parseFloat(currentInput);
  const numeric = isNaN(cents) ? 0 : cents / 100;
  if (display) display.textContent = `$${numeric.toFixed(2)}`;
}

// --- Open & Close Overlay ---
function openPaypad(method) {
  activeMethod = method;

  // 🟢 Preload previous payment (if any)
  const prev = order._payment[method] || 0;
  currentInput = prev > 0 ? String(Math.round(prev * 100)) : "";
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
    toggleSubmitVisibility();
  });
});

function finalizePaypadAmount() {
  const cents = parseFloat(currentInput);
  const amount = isNaN(cents) ? 0 : cents / 100;
  if (amount <= 0 || !activeMethod) {
    alert("Enter a valid amount");
    return;
  }

  // 🟢 Replace previous amount instead of adding
  order._payment[activeMethod] = Utilities.roundToTwo(amount);

  closePaypad();
  updatePaymentUI();
  toggleSubmitVisibility();
}

// ===========================================================
// TOOLBAR BUTTONS
// ===========================================================
const clearOrderBtn = document.getElementById("clear-order-btn");

if (clearOrderBtn) {
  clearOrderBtn.addEventListener("click", () => {
    if (!order._order.length) {
      alert("🧾 No items to clear.");
      return;
    }
    if (confirm("⚠️ Clear the current order?")) {
      order._order = [];
      order._payment = { cash: 0, card: 0 };
      Ui.receiptDetails(order);
      Ui.updateTotals(order);
      updatePaymentUI(true);
      toggleSubmitVisibility();
      alert("🗑️ Order cleared.");
    }
  });
}

// ===========================================================
// SUBMIT + EMAIL + TOGGLE VISIBILITY FIX
// ===========================================================
const emailInput = document.getElementById("customer-email");
const submitRow = document.getElementById("submit-row");
const submitBtn = document.getElementById("submit-sale");


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
    splitInfoEl.textContent =
      cash && card
        ? `${Utilities.convertFloatToString(cash)} Cash + ${Utilities.convertFloatToString(card)} Card`
        : cash
        ? `${Utilities.convertFloatToString(cash)} Cash`
        : card
        ? `${Utilities.convertFloatToString(card)} Card`
        : "None";
}

async function submitSale() {
  const { subtotal, tax, total } = (() => {
    const subtotal = order._order.reduce((s, l) => s + l.subtotal, 0);
    const tax = order._order.reduce((s, l) => s + l.tax, 0);
    return { subtotal, tax, total: subtotal + tax };
  })();

  const date = new Date().toLocaleDateString("en-US");
  const email = (emailInput && emailInput.value.trim()) || "";
  const split = splitInfoEl ? splitInfoEl.textContent : "";

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
    Email: email,
    Payment: split
  }));

  try {
    await fetch("https://script.google.com/macros/s/AKfycbxrv2qEiZ5mOIa9w_cnde4n9rZdJERT08bqja7gUz2V_4GtkwAYodfuufIroRCwUVolnw/exec", {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows)
    });

    alert("✅ Sale submitted successfully! Check your sheet for confirmation.");

    // --- Reset everything ---
    order._order = [];
    order._payment = { cash: 0, card: 0 };
    Ui.receiptDetails(order);
    Ui.updateTotals(order);

    // --- Reset payment info display ---
    updatePaymentUI(true);
    toggleSubmitVisibility();
    if (paymentTypeEl) paymentTypeEl.textContent = "—";
    if (splitInfoEl) splitInfoEl.textContent = "None";

    // --- Clear email + stored value ---
    sessionStorage.removeItem("lastCustomerEmail");
    if (emailInput) emailInput.value = "";
  } catch (err) {
    alert("⚠️ Error submitting sale: " + err.message);
    console.error(err);
  }
}

// ===========================================================
// MENU CLICK HANDLERS
// ===========================================================
loadMenuFromSheet(sheetCsvUrl).then(rows => {
  order.menu = rows;
  Ui.renderMenu(order);

  const menuContainer = document.getElementById("menu");
  if (menuContainer) {
    menuContainer.addEventListener("click", e => {
      const figure = e.target.closest(".menu-item");
      if (!figure) return;

      const data = figure.getAttribute("data-sku");
      if (!data) return;

      order.addOrderLine(1, data, isReturnMode);
    });
  }
});

// ===========================================================
// RETURN MODE
// ===========================================================
const returnBtn = document.getElementById("toggle-return");
if (returnBtn) {
  returnBtn.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();

    isReturnMode = !isReturnMode;

    // 🔁 Toggle .active visually on both the button and icon
    returnBtn.classList.toggle("active", isReturnMode);
    const icon = returnBtn.querySelector("i");
    if (icon) icon.classList.toggle("active", isReturnMode);

    // 🔁 Toggle background mode
    document.body.classList.toggle("return-mode", isReturnMode);

    // 🔁 Update header label
    const header = document.querySelector("header h1");
    if (header) {
      header.textContent = isReturnMode
        ? "🔴 RETURN MODE ACTIVE"
        : "Kinaya Rising Purchase Order";
    }
  });
}

// ===========================================================
// SUBMIT TOGGLE + MODAL CONFIRMATION LOGIC
// ===========================================================
function toggleSubmitVisibility() {
  const ready = totalPaid() >= orderTotal();
  const hasEmail = emailInput && emailInput.value.trim().length > 0;
  const hasItems = order._order && order._order.length > 0;

  if (!submitRow) return;

  if (ready && hasEmail && hasItems) {
    submitRow.style.display = "block"; // visible on all layouts
    submitRow.classList.add("visible");
  } else {
    submitRow.style.display = "none";
    submitRow.classList.remove("visible");
  }
}

// --- Watch for email input changes ---
if (emailInput) {
  emailInput.addEventListener("input", toggleSubmitVisibility);
}

// --- Optional modal confirmation ---
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("submit-modal");
  const modalCancel = document.getElementById("modal-cancel");
  const modalOk = document.getElementById("modal-ok");

  if (submitBtn && modal) {
    submitBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  }

  if (modalCancel && modal) {
    modalCancel.addEventListener("click", () => modal.classList.add("hidden"));
  }

  if (modalOk && modal) {
    modalOk.addEventListener("click", () => {
      modal.classList.add("hidden");
      submitSale();
    });
  }
});

// --- Enter key to confirm payment ---
document.addEventListener("keydown", e => {
  if (paymentOverlay?.classList.contains("active") && e.key === "Enter") {
    finalizePaypadAmount();
  }
});

// ===========================================================
// VIEW SWITCHER — Sales ↔ Inventory
// ===========================================================
const navSales = document.getElementById("nav-sales");
const navInventory = document.getElementById("nav-inventory");
const salesView = document.getElementById("sales-view");
const inventoryView = document.getElementById("inventory-view");

function switchView(target) {
  if (target === "sales") {
    salesView.style.display = "flex";
    inventoryView.style.display = "none";
    navSales.classList.add("active");
    navInventory.classList.remove("active");
  } else {
    salesView.style.display = "none";
    inventoryView.style.display = "flex";
    navSales.classList.remove("active");
    navInventory.classList.add("active");
  }
}

if (navSales && navInventory) {
  navSales.addEventListener("click", () => switchView("sales"));
  navInventory.addEventListener("click", () => switchView("inventory"));
}


// ===========================================================
// FINAL INITIALIZATION
// ===========================================================
updatePaymentUI();
toggleSubmitVisibility();
