// ===========================================================
// Kinaya Rising POS (Stable October 2025) - script.js
// ===========================================================

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
  <img src="${item.image}" alt="${item.description}" class="menu-image">
  <div class="menu-item-content">
    <div class="title">${item.description}</div>
    <div class="sku">${item.sku}</div>
    <div class="price">${Utilities.convertFloatToString(item.price)}</div>
  </div>
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

// ---------- Simplified Swipe Drawer ----------
function setupProductDrawer() {
  const drawer = document.querySelector(".menu-payment");
  if (!drawer) return;

  let startY = 0;
  let isDragging = false;

  drawer.addEventListener("touchstart", e => {
    if (window.innerWidth > 900) return;
    startY = e.touches[0].clientY;
    isDragging = true;
  });

  drawer.addEventListener("touchmove", e => {
    if (!isDragging) return;
  });

  drawer.addEventListener("touchend", e => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startY - e.changedTouches[0].clientY;

    if (diff > 50 && !drawer.classList.contains("expanded")) {
      drawer.classList.add("expanded");
      document.body.classList.add("menu-expanded");
    } else if (diff < -50 && drawer.classList.contains("expanded")) {
      drawer.classList.remove("expanded");
      document.body.classList.remove("menu-expanded");
    }
  });

  // Don’t auto-close when clicking a product
  drawer.addEventListener("click", e => {
    if (e.target.closest(".menu-item")) {
      drawer.classList.add("expanded");
    }
  });
}

// ---------- Initialization ----------
document.addEventListener("DOMContentLoaded", async () => {
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

  const sheetCsvUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vT8TYrKVClp5GXP5Sx7NYGpfRvEMCCNuL40vbcyhdwP6bnvQeQRqJ4xTv6BZUnC5nm7N2N_KwQlHZ2H/pub?gid=30403628&single=true&output=csv";

  const order = new Order();
  const returnButton = document.getElementById("toggle-return");
  let isReturnMode = false;

  const menuData = await loadMenuFromSheet(sheetCsvUrl);
  order.menu = menuData;
  Ui.renderMenu(order);
  setupProductDrawer();

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

  updatePaymentUI();
  toggleSubmitVisibility();
});
