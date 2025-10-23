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
// SPLIT PAYMENT TRACKING + IMPROVED LOGIC
// ===========================================================
let amountPaidCash = 0;
let amountPaidCard = 0;
let grandTotal = 0;
let activePaymentType = ""; // "Cash", "Card", "Split"

// cache elements
const splitInfoEl = document.getElementById("split-info");
const paymentTypeEl = document.getElementById("payment-type");
const changeEl = document.getElementById("change-amount");

// update totals and display logic
function updatePaymentUI(reset = false) {
  const grandDisplay = document.getElementById("grandtotal-summary");

  if (reset) {
    amountPaidCash = 0;
    amountPaidCard = 0;
    activePaymentType = "";
    if (splitInfoEl) splitInfoEl.textContent = "None";
    if (paymentTypeEl) paymentTypeEl.textContent = "—";
    if (changeEl) {
      changeEl.textContent = "$0.00";
      changeEl.style.color = "#A7E1EE";
    }
  }

  if (grandDisplay) {
    const text = grandDisplay.textContent.replace(/[^0-9.]/g, "");
    grandTotal = parseFloat(text) || 0;
  }

  const totalPaid = amountPaidCash + amountPaidCard;
  const diff = totalPaid - grandTotal;

  if (changeEl) {
    if (diff >= 0) {
      changeEl.textContent = `$${diff.toFixed(2)} change`;
      changeEl.style.color = "#A7E1EE";
    } else {
      changeEl.textContent = `$${Math.abs(diff).toFixed(2)} owed`;
      changeEl.style.color = "#e63946";
    }
  }

  // Update type display
  if (paymentTypeEl && splitInfoEl) {
    if (amountPaidCash > 0 && amountPaidCard > 0) {
      activePaymentType = "Split";
      paymentTypeEl.textContent = "Split";
      splitInfoEl.textContent = `$${amountPaidCash.toFixed(2)} Cash + $${amountPaidCard.toFixed(2)} Card`;
    } else if (amountPaidCash > 0) {
      activePaymentType = "Cash";
      paymentTypeEl.textContent = "Cash";
      splitInfoEl.textContent = "None";
    } else if (amountPaidCard > 0) {
      activePaymentType = "Card";
      paymentTypeEl.textContent = "Card";
      splitInfoEl.textContent = "None";
    } else {
      activePaymentType = "";
      paymentTypeEl.textContent = "—";
      splitInfoEl.textContent = "None";
    }
  }

  toggleSubmitVisibility();
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
  const newsletterToggle = document.getElementById("email-toggle");
  const subscribe = newsletterToggle && newsletterToggle.checked ? "Yes" : "No";

  const paymentSummary =
    activePaymentType === "Split"
      ? `$${amountPaidCash.toFixed(2)} Cash + $${amountPaidCard.toFixed(2)} Card`
      : activePaymentType || "None";

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
    Payment: paymentSummary
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

    // Reset
    order._order = [];
    order._payment = { cash: 0, card: 0 };
    Ui.receiptDetails(order);
    Ui.updateTotals(order);
    updatePaymentUI(true);
    toggleSubmitVisibility();

    if (emailInput) emailInput.value = "";
  } catch (err) {
    alert("⚠️ Error submitting sale: " + err.message);
    console.error(err);
  }
}

// ===========================================================
// EMAIL + SUBMIT VISIBILITY
// ===========================================================
function toggleSubmitVisibility() {
  const submitRow = document.getElementById("submit-row");
  const emailInput = document.getElementById("customer-email");
  if (!submitRow) return;

  const hasEmail = emailInput && emailInput.value.trim().length > 0;
  const totalPaid = amountPaidCash + amountPaidCard;
  const canSubmit =
    order._order.length > 0 &&
    totalPaid >= grandTotal &&
    hasEmail;

  submitRow.style.display = canSubmit ? "block" : "none";
}

const emailInput = document.getElementById("customer-email");
if (emailInput) {
  emailInput.addEventListener("input", toggleSubmitVisibility);
}

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
// PAYPAD (SPLIT READY)
// ===========================================================
(function setupPaypad() {
  const overlay = document.getElementById("payment-overlay");
  const displayEl = document.getElementById("paypad-display");
  const buttons = document.querySelectorAll(".paypad-btn");
  const closeBtn = document.getElementById("close-paypad-btn");

  let buffer = "";
  let activeMode = null; // "Cash" or "Card"

  function formatCurrency(val) {
    return `$${(parseFloat(val) || 0).toFixed(2)}`;
  }
  function renderDisplay() {
    const num = parseFloat(buffer || "0") / 100;
    displayEl.textContent = formatCurrency(num);
  }
  function commitPayment() {
    const value = parseFloat(buffer || "0") / 100;
    if (activeMode === "Cash") amountPaidCash = value;
    if (activeMode === "Card") amountPaidCard = value;
    buffer = "";
    updatePaymentUI();
    overlay.classList.add("hidden");
  }

  // keypad input
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

  // close button
  if (closeBtn) closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));

  // open from cash/card buttons
  const cashBtn = document.getElementById("cash-btn");
  const cardBtn = document.getElementById("card-btn");

  if (cashBtn) {
    cashBtn.addEventListener("click", () => {
      activeMode = "Cash";
      overlay.classList.remove("hidden");
      buffer = "";
      renderDisplay();
    });
  }

  if (cardBtn) {
    cardBtn.addEventListener("click", () => {
      activeMode = "Card";
      overlay.classList.remove("hidden");
      buffer = "";
      renderDisplay();
    });
  }

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
      banner.style.cssText = `
        text-align:center;font-family:"Audiowide",sans-serif;
        color:#e63946;font-weight:bold;margin-top:0.3rem;
        letter-spacing:1px;text-shadow:0 0 10px rgba(230,57,70,0.6);
      `;
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
