// ===========================================================
// 🌿 Kinaya Rising POS — FINAL VERIFIED UNLOCK SYSTEM
// ===========================================================

let order;
let isReturnMode = false;
let posListenersAttached = false;

window.addEventListener("load", async () => {
  console.log("✅ Initializing Kinaya Rising POS...");

  // ---------- HEADER DATE ----------
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

  // ---------- LOAD PRODUCTS ----------
  order = new Order();
  const sheetCsvUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vT8TYrKVClp5GXP5Sx7NYGpfRvEMCCNuL40vbcyhdwP6bnvQeQRqJ4xTv6BZUnC5nm7N2N_KwQlHZ2H/pub?gid=30403628&single=true&output=csv";

  try {
    const rows = await loadMenuFromSheet(sheetCsvUrl);
    order.menu = rows;
    Ui.renderMenu(order);
    console.log("📦 Menu loaded:", order.menu.length, "items");
  } catch (err) {
    console.error("❌ Menu load failed:", err);
  }

  // ---------- ACTIVATE PASSCODE ----------
  initPasscodeGate();
});

// ===========================================================
// PASSCODE GATE
// ===========================================================
function initPasscodeGate() {
  const gate = document.getElementById("passcode-screen");
  const input = document.getElementById("passcode-input");
  const button = document.getElementById("passcode-btn");
  const errorMsg = document.getElementById("passcode-error");
  const PASSCODE = "Lumina2025";

  if (!gate || !input || !button) {
    console.error("❌ Passcode elements missing");
    return;
  }

  // ✅ Unlock logic
  function unlock() {
    const entered = input.value.trim();
    if (entered === PASSCODE) {
      console.log("🔓 Correct passcode — unlocking POS...");
      gate.style.transition = "opacity 0.4s ease";
      gate.style.opacity = "0";

      setTimeout(() => {
        gate.style.display = "none";
        sessionStorage.setItem("posUnlocked", "true");

        // ✅ Activate POS
        attachPosListenersOnce();
        console.log("🎯 POS is now active");
      }, 400);
    } else {
      console.warn("❌ Incorrect passcode:", entered);
      errorMsg.style.display = "block";
      input.value = "";
    }
  }

  // 🔁 Auto-unlock if already authenticated
  if (sessionStorage.getItem("posUnlocked") === "true") {
    console.log("🔓 Session already unlocked");
    gate.style.display = "none";
    attachPosListenersOnce();
    return;
  }

  // 🖱️ and ⌨️ Events
  button.addEventListener("click", unlock);
  input.addEventListener("keypress", e => {
    if (e.key === "Enter") unlock();
  });

  // Focus the input field automatically
  setTimeout(() => input.focus(), 300);
}

// ===========================================================
// POS BUTTON LISTENERS
// ===========================================================
function attachPosListenersOnce() {
  if (posListenersAttached) return;
  posListenersAttached = true;

  console.log("🎯 POS listeners attached");

  const clearBtn = document.getElementById("clear-btn");
  const toggleReturnBtn = document.getElementById("toggle-return");
  const menuContainer = document.getElementById("menu");

  if (!clearBtn || !toggleReturnBtn || !menuContainer) {
    console.warn("⚠️ Some POS buttons missing");
    return;
  }

  // Clear order
  clearBtn.addEventListener("click", () => {
    order._order = [];
    Ui.receiptDetails(order);
    Ui.updateTotals(order);
    updatePaymentUI(true);
    toggleSubmitVisibility();
  });

  // Toggle Return mode
  toggleReturnBtn.addEventListener("click", () => {
    isReturnMode = !isReturnMode;
    toggleReturnBtn.classList.toggle("active", isReturnMode);
  });

  // Add product to order
  menuContainer.addEventListener("click", e => {
    const item = e.target.closest(".menu-item");
    if (!item) return;
    const data = item.getAttribute("data-sku");
    if (data) order.addOrderLine(1, data, isReturnMode);
  });
}
// ===========================================================
// 💳 PAYMENT / PAYPAD CALCULATOR (Restored)
// ===========================================================
function initPaypad() {
  const paymentOverlay = document.getElementById("payment-overlay");
  const closeBtn = document.getElementById("close-paypad-btn");
  const cashBtn = document.getElementById("cash-btn");
  const cardBtn = document.getElementById("card-btn");
  const amountInput = document.getElementById("amount-paid-input");
  const paymentTypeEl = document.getElementById("payment-type");
  const changeEl = document.getElementById("change-amount");
  const splitInfoEl = document.getElementById("split-info");
  const paypadButtons = document.querySelectorAll(".paypad-btn");

  if (!paymentOverlay || !cashBtn || !cardBtn) {
    console.warn("⚠️ Paypad elements missing");
    return;
  }

  let activeMethod = null;
  let currentInput = "";

  const updatePaypadDisplay = () => {
    const display = document.getElementById("paypad-display");
    const cents = parseFloat(currentInput);
    const numeric = isNaN(cents) ? 0 : cents / 100;
    if (display) display.textContent = `$${numeric.toFixed(2)}`;
  };

  const openPaypad = method => {
    activeMethod = method;
    currentInput = "";
    updatePaypadDisplay();
    paymentOverlay.style.display = "flex";
    paymentOverlay.classList.add("active");
    if (paymentTypeEl) paymentTypeEl.textContent = method.toUpperCase();
  };

  const closePaypad = () => {
    activeMethod = null;
    currentInput = "";
    paymentOverlay.classList.remove("active");
    setTimeout(() => (paymentOverlay.style.display = "none"), 250);
  };

  const finalizePaypadAmount = () => {
    const cents = parseFloat(currentInput);
    const amount = isNaN(cents) ? 0 : cents / 100;
    if (amount <= 0 || !activeMethod) {
      alert("Enter a valid amount");
      return;
    }
    order._payment[activeMethod] = Utilities.roundToTwo(
      (order._payment[activeMethod] || 0) + amount
    );
    updatePaymentUI();
    toggleSubmitVisibility();
    closePaypad();
  };

  // 🔢 Button Events
  paypadButtons.forEach(btn => {
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

  // 💵 Main Buttons
  cashBtn.addEventListener("click", () => openPaypad("cash"));
  cardBtn.addEventListener("click", () => openPaypad("card"));
  if (closeBtn) closeBtn.addEventListener("click", closePaypad);
}

// ✅ Run this right after unlocking
function attachPosListenersOnce() {
  if (posListenersAttached) return;
  posListenersAttached = true;
  console.log("🎯 POS listeners attached");

  const clearBtn = document.getElementById("clear-btn");
  const toggleReturnBtn = document.getElementById("toggle-return");
  const menuContainer = document.getElementById("menu");

  if (clearBtn)
    clearBtn.addEventListener("click", () => {
      order._order = [];
      Ui.receiptDetails(order);
      Ui.updateTotals(order);
      updatePaymentUI(true);
      toggleSubmitVisibility();
    });

  if (toggleReturnBtn)
    toggleReturnBtn.addEventListener("click", () => {
      isReturnMode = !isReturnMode;
      toggleReturnBtn.classList.toggle("active", isReturnMode);
    });

  if (menuContainer)
    menuContainer.addEventListener("click", e => {
      const item = e.target.closest(".menu-item");
      if (!item) return;
      const data = item.getAttribute("data-sku");
      if (data) order.addOrderLine(1, data, isReturnMode);
    });

  // ✅ Initialize paypad only after unlock
  initPaypad();
}

// ===========================================================
// ORDER MODEL
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
  try {
    const response = await fetch(url, { mode: "cors" });
    const text = await response.text();
    return text
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
  } catch (err) {
    console.error("Error loading CSV:", err);
    return [];
  }
}

// ===========================================================
// UI
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
}
