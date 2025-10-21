// ===========================================================
// Kinaya Rising POS (Stable October 2025) - FIXED PAYPAD OVERLAY
// ===========================================================

// ---------- SAFETY GUARD ----------
if (!window.order) window.order = new Order();

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
  const PASSCODE = "Lumina2025";

  if (!gate || !input || !button) {
    console.error("❌ Passcode elements missing.");
    return;
  }

  function unlockPOS() {
    console.log("🔓 Unlocking POS...");
    gate.style.transition = "opacity 0.4s ease";
    gate.style.opacity = "0";

    // Fix Safari mobile lag
    void gate.offsetWidth;

    setTimeout(() => {
      gate.style.display = "none";
      gate.style.pointerEvents = "none";
      sessionStorage.setItem("posUnlocked", "true");

      // Initialize POS
      Ui.renderMenu(order);
      Ui.receiptDetails(order);
      Ui.updateTotals(order);
      updatePaymentUI();
      toggleSubmitVisibility();

      // ---------- PRODUCT LISTENERS (fixed double-add) ----------
      const menuContainer = document.getElementById("menu");
      if (menuContainer) {
        const cleanMenu = menuContainer.cloneNode(true);
        menuContainer.parentNode.replaceChild(cleanMenu, menuContainer);

        cleanMenu.querySelectorAll(".menu-item").forEach(item => {
          item.addEventListener("click", () => {
            const data = item.getAttribute("data-sku");
            if (data) order.addOrderLine(1, data, order.isReturn || false);
          });
        });
      }

      console.log("✅ POS fully unlocked");
    }, 500);
  }

  // ---------- CLEAR ORDER & RETURN BUTTONS ----------
  const clearBtn = document.getElementById("clear-order-btn");
  const returnBtn = document.getElementById("toggle-return");

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      order._order = [];
      Ui.receiptDetails(order);
      Ui.updateTotals(order);
      updatePaymentUI(true);
      toggleSubmitVisibility();
    });
  }

  if (returnBtn) {
    returnBtn.addEventListener("click", () => {
      returnBtn.classList.toggle("active");
      order.isReturn = returnBtn.classList.contains("active");
    });
  }

  function tryUnlock() {
    const entered = input.value.trim();
    console.log("🔐 Entered:", entered);
    if (entered === PASSCODE) {
      unlockPOS();
    } else {
      errorMsg.style.display = "block";
      input.value = "";
    }
  }

  // Auto-unlock for active session
  if (sessionStorage.getItem("posUnlocked") === "true") {
    gate.style.display = "none";
    unlockPOS();
    return;
  }

  // Button & Enter key
  button.addEventListener("click", tryUnlock);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") tryUnlock();
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
    this.isReturn = false;
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

loadMenuFromSheet(sheetCsvUrl).then(rows => {
  order.menu = rows;
  Ui.renderMenu(order);
});

// ===========================================================
// PAYMENT + PAYPAD FIXED
// ===========================================================
document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("payment-overlay");
  const display = document.querySelector(".paypad-display");
  const numberBtns = document.querySelectorAll(".paypad-btn.number");
  const enterBtn = document.querySelector(".paypad-btn.span3-col");
  const closeBtn = document.getElementById("close-paypad-btn");
  const amountInput = document.getElementById("amount-paid-input");

  let currentValue = "";

  const updateDisplay = () => {
    display.textContent = currentValue || "0";
  };

  function openPaypad() {
    overlay.classList.add("active");
    document.body.classList.add("overlay-active");
    currentValue = "";
    updateDisplay();
  }

  function closePaypad() {
    overlay.classList.remove("active");
    document.body.classList.remove("overlay-active");
  }

  numberBtns.forEach(btn => {
    btn.onclick = () => {
      const val = btn.textContent.trim();
      if (currentValue.length < 8) {
        currentValue += val;
        updateDisplay();
      }
    };
  });

  enterBtn.onclick = () => {
    const cents = parseFloat(currentValue);
    const amount = isNaN(cents) ? 0 : cents / 100;
    if (amount > 0) {
      order._payment.cash = Utilities.roundToTwo(order._payment.cash + amount);
      updatePaymentUI();
      toggleSubmitVisibility();
      document.querySelector("#submit-sale")?.click(); // ✅ auto-submit sale
    }
    closePaypad();
  };

  closeBtn.onclick = closePaypad;
  amountInput.addEventListener("focus", openPaypad);
});

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
  const amountInput = document.getElementById("amount-paid-input");
  const changeEl = document.getElementById("change-amount");
  const splitInfoEl = document.getElementById("split-info");
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
  const splitInfoEl = document.getElementById("split-info");
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
