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
// SESSION CHECK (new, replaces old gate)
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
// Kinaya Rising POS — Full Stable Version (Split Payment)
// ===========================================================

const TAX_RATE = 0.07;
const ENDPOINT = "https://script.google.com/macros/s/14LQqEsRumpXVeC7ZKEd8CX2FHZoztKHsuROG6DQg4uR_iZOBgcX9esxj/exec";

let order = [];
let cashPaid = 0;
let cardPaid = 0;
let isReturnMode = false;
let currentMethod = null;
let currentInput = "";

// ---------- Utility ----------
const fmt = num => `$${parseFloat(num || 0).toFixed(2)}`;

// ---------- Load Menu ----------
document.addEventListener("DOMContentLoaded", () => {
  const menu = document.getElementById("menu");
  const products = [
    { sku: "B0F8NFSWXW", name: "Book - AoL Part 1", price: 14.98 },
    { sku: "BKM-001", name: "Bookmarks", price: 2.00 },
    { sku: "Button-001", name: "Buttons (individual)", price: 5.00 },
    { sku: "Button-001-5pk", name: "Buttons (5 pack)", price: 15.00 },
    { sku: "Cos-001", name: "Coaster", price: 10.00 },
    { sku: "Jou-001", name: "Journal", price: 14.00 },
    { sku: "Mug-sm-001", name: "Mug", price: 12.00 },
    { sku: "posh-sm-nat-001", name: "Poster - Sonavra", price: 30.00 },
    { sku: "posh-sm-nat-002", name: "Poster - Word of Understanding", price: 30.00 },
    { sku: "TBA-001", name: "Tote Bag", price: 20.00 },
  ];

  // Render product tiles
  menu.innerHTML = products.map(
    p => `
      <figure class="menu-item" data-sku="${p.sku}" data-name="${p.name}" data-price="${p.price}">
        <img src="https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/${p.sku}.png"
             alt="${p.name}" class="menu-image" />
        <figcaption>${p.name}</figcaption>
        <figcaption>${p.sku}</figcaption>
        <figcaption>$${p.price.toFixed(2)}</figcaption>
      </figure>`
  ).join("");

  // Attach product click events
  document.querySelectorAll(".menu-item").forEach(item =>
    item.addEventListener("click", () => addItem(item.dataset))
  );

  // Toolbar buttons
  document.getElementById("cash-btn").onclick = () => openPaypad("cash");
  document.getElementById("card-btn").onclick = () => openPaypad("card");
  document.getElementById("clear-order-btn").onclick = clearOrder;
  document.getElementById("toggle-return").onclick = toggleReturn;
});

// ---------- Add / Remove ----------
function addItem({ sku, name, price }) {
  const existing = order.find(p => p.sku === sku);
  if (existing) existing.qty++;
  else order.push({ sku, name, price: parseFloat(price), qty: 1 });
  updateUI();
}

function removeItem(sku) {
  order = order.filter(p => p.sku !== sku);
  updateUI();
}

// ---------- Totals ----------
function calcTotals() {
  const subtotal = order.reduce((s, i) => s + i.qty * i.price, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

// ---------- Update UI ----------
function updateUI() {
  const body = document.getElementById("receipt-details");
  body.innerHTML = "";
  order.forEach(item => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.qty}</td>
      <td>${fmt(item.price)}</td>
      <td>${fmt(item.qty * item.price)}</td>
      <td class="delete" onclick="removeItem('${item.sku}')"><i class="fa-solid fa-xmark"></i></td>`;
    body.appendChild(row);
  });

  const { subtotal, tax, total } = calcTotals();
  document.getElementById("subtotal-summary").textContent = fmt(subtotal);
  document.getElementById("tax-summary").textContent = fmt(tax);
  document.getElementById("grandtotal-summary").textContent = fmt(total);

  const split = [];
  if (cashPaid) split.push(fmt(cashPaid) + " Cash");
  if (cardPaid) split.push(fmt(cardPaid) + " Card");
  document.getElementById("split-info").textContent = split.join(" / ") || "None";

  document.getElementById("amount-paid-input").value =
    fmt(cashPaid + cardPaid);
  document.getElementById("submit-row").style.display =
    order.length && (cashPaid + cardPaid) >= total ? "block" : "none";
}

// ---------- Clear / Return ----------
function clearOrder() {
  if (!confirm("Clear current order?")) return;
  order = [];
  cashPaid = cardPaid = 0;
  updateUI();
}

function toggleReturn() {
  isReturnMode = !isReturnMode;
  document.getElementById("toggle-return").classList.toggle("active", isReturnMode);
}

// ---------- Paypad ----------
function openPaypad(method) {
  currentMethod = method;
  currentInput = "";
  updatePaypadDisplay();
  document.getElementById("payment-overlay").classList.add("active");

  // Buttons
  document.querySelectorAll(".paypad-btn").forEach(btn => {
    btn.onclick = () => handlePaypad(btn.dataset.id);
  });
  document.getElementById("close-paypad-btn").onclick = closePaypad;
}

function handlePaypad(id) {
  if (id === "clear") currentInput = "";
  else if (id === "back") currentInput = currentInput.slice(0, -1);
  else if (id === "close-sale") finalizePaypad();
  else if (!isNaN(id)) currentInput += id;
  updatePaypadDisplay();
}

function updatePaypadDisplay() {
  document.getElementById("paypad-display").textContent =
    fmt(parseFloat(currentInput || 0) / 100);
}

function closePaypad() {
  document.getElementById("payment-overlay").classList.remove("active");
}

function finalizePaypad() {
  const amount = parseFloat(currentInput || 0) / 100;
  if (amount <= 0) return;
  if (currentMethod === "cash") cashPaid += amount;
  if (currentMethod === "card") cardPaid += amount;
  closePaypad();
  updateUI();
}

// ---------- Submit ----------
async function submitSale() {
  const { subtotal, tax, total } = calcTotals();
  const date = new Date().toLocaleDateString("en-US");
  const email = document.getElementById("customer-email").value.trim();
  const payment = [cashPaid ? fmt(cashPaid) + " Cash" : "", cardPaid ? fmt(cardPaid) + " Card" : ""]
    .filter(Boolean)
    .join(" ");

  const rows = order.map(i => ({
    Date: date,
    Sku: i.sku,
    ProductTitle: i.name,
    Quantity: i.qty,
    Price: i.price,
    Subtotal: i.qty * i.price,
    Tax: tax,
    Total: total,
    Email: email,
    Payment: payment,
  }));

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      body: JSON.stringify(rows),
      headers: { "Content-Type": "application/json" },
    });
    const text = await res.text();
    if (text.includes("Success")) {
      alert("✅ Sale recorded!");
      clearOrder();
    } else {
      alert("❌ Error saving sale.");
    }
  } catch (err) {
    alert("Error submitting sale: " + err);
  }
}

// Submit button handler
document.addEventListener("click", e => {
  if (e.target && e.target.id === "submit-sale") submitSale();
});


// ===========================================================
// FINAL INITIALIZATION
// ===========================================================
updatePaymentUI();
toggleSubmitVisibility();
