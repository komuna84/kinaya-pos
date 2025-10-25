// ===========================================================
// 🌿 Kinaya Rising POS - Advanced Unified Logic (2025)
// ===========================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🌿 Kinaya POS initializing...");

  // ---------- CORE ELEMENTS ----------
  const menu = document.getElementById("menu");
  const banner = document.getElementById("return-mode-banner");
  const toggleReturnMain = document.getElementById("toggle-return-main");
  const paypadOverlay = document.getElementById("payment-overlay");
  const paypadDisplay = document.getElementById("paypad-display");
  const amountPaidDisplay = document.getElementById("amount-paid-display");
  const paypadButtons = document.querySelectorAll(".paypad-btn");
  const confirmPaymentBtn = document.getElementById("confirm-payment-btn");
  const cashBtn = document.getElementById("cash-btn");
  const cardBtn = document.getElementById("card-btn");
  const closePaypadBtn = document.getElementById("close-paypad-btn");
  const discountInput = document.getElementById("discount-input");
  const emailInput = document.getElementById("customer-email");
  const emailToggle = document.getElementById("email-toggle");
  const submitBtn = document.getElementById("submit-sale");

  // ---------- STATE ----------
  let returnMode = false;
  let paypadValue = "";
  let lastConfirmedValue = 0;
  let currentPaymentType = "";
  let paymentRecord = { cash: 0, card: 0 };
  let discountPercent = 0;

  // ===========================================================
  // 🔁 INVENTORY LOAD
  // ===========================================================
  const INVENTORY_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbyR-1IXv_ez6K1knaGizSVavXxN7Zzd--gB8G_3YjRAuiHnzLeFkp1a34M1TVzVQk8usQ/exec";


  async function loadInventoryData() {
    try {
      const response = await fetch(INVENTORY_SHEET_URL);
      if (!response.ok) throw new Error("Network error loading inventory");
      const data = await response.json();
      renderProducts(data);
    } catch (error) {
      console.warn("⚠️ Using fallback products:", error);
      renderProducts(fallbackProducts);
    }
  }

  // ===========================================================
  // 🛍️ RENDER PRODUCTS + CLICK HANDLER
  // ===========================================================
  function renderProducts(products) {
    if (!menu) return;

    const productHTML = products
      .map(
        (p) => `
        <figure class="menu-item" data-sku="${p.sku}" data-name="${p.name}" data-price="${p.price}">
          <img src="${p.image}" alt="${p.name}" />
          <figcaption>${p.name}</figcaption>
          <figcaption>${p.sku}</figcaption>
          <figcaption>$${parseFloat(p.price).toFixed(2)}</figcaption>
        </figure>`
      )
      .join("");

    menu.innerHTML = productHTML;

    const allItems = document.querySelectorAll(".menu-item");
    allItems.forEach((item) => {
      item.addEventListener("click", () => {
        const name = item.dataset.name;
        const sku = item.dataset.sku;
        const price = parseFloat(item.dataset.price);
        const qtyChange = returnMode ? -1 : 1;
        updateReceipt({ name, sku, price, qtyChange });
      });
    });
  }

  // ===========================================================
  // 🌱 FALLBACK PRODUCTS
  // ===========================================================
  const fallbackProducts = [
    { name: "Book — AoL Part 1", sku: "B0F8NFSWXW", price: 14.98, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/B0F8NFSWXW.png" },
    { name: "Bookmarks", sku: "BKM-001", price: 2.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/bookmark.png" },
    { name: "Buttons (individual)", sku: "Button-001", price: 5.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/button.png" },
    { name: "Buttons (5 pack)", sku: "Button-001-5pk", price: 15.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/button-pack.png" },
    { name: "Coaster", sku: "Cos-001", price: 10.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/coaster.png" },
    { name: "Journal", sku: "Jou-001", price: 14.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/journal.png" },
    { name: "Tote Bag", sku: "Bag-001", price: 12.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/totebag.png" },
  ];

  // ===========================================================
  // 🔁 RETURN MODE TOGGLE
  // ===========================================================
  function toggleReturn() {
    returnMode = !returnMode;
    banner.style.display = returnMode ? "block" : "none";
    console.log(`↩️ Return mode ${returnMode ? "ENABLED" : "DISABLED"}`);
  }
  toggleReturnMain?.addEventListener("click", toggleReturn);

  // ===========================================================
// 🔁 RECEIPT UPDATE — Add or Remove Products
// ===========================================================
function updateReceipt(product) {
  const tableBody = document.getElementById("receipt-details");
  if (!tableBody) return;

  const price = returnMode ? -Math.abs(product.price) : product.price;
  let existing = Array.from(tableBody.children).find(
    (row) => row.dataset.sku === product.sku
  );

  if (existing) {
    let qtyCell = existing.querySelector(".qty");
    let subCell = existing.querySelector(".subtotal");
    let qty = parseInt(qtyCell.textContent) + product.qtyChange;

    if (qty <= 0) existing.remove();
    else {
      qtyCell.textContent = qty;
      subCell.textContent = `$${(qty * price).toFixed(2)}`;
    }
  } else {
    const newRow = document.createElement("tr");
    newRow.dataset.sku = product.sku;
    const style = returnMode ? "color:#e63946;font-weight:bold;" : "";
    newRow.innerHTML = `
      <td style="${style}">${product.name}</td>
      <td class="qty" style="${style}">${product.qtyChange}</td>
      <td style="${style}">$${price.toFixed(2)}</td>
      <td class="subtotal" style="${style}">$${price.toFixed(2)}</td>
      <td><button class="del-btn"><i class="fas fa-trash"></i></button></td>
    `;
    tableBody.appendChild(newRow);
  }

  updateTotals();
}

// ===========================================================
// 💸 TOTAL CALCULATION — Stable and Always Refresh
// ===========================================================
function updateTotals() {
  const tableBody = document.getElementById("receipt-details");
  let subtotal = 0;

  tableBody.querySelectorAll("tr").forEach((row) => {
    const sub = parseFloat(
      row.querySelector(".subtotal")?.textContent.replace(/[^0-9.-]/g, "") || 0
    );
    subtotal += sub;
  });

  const discountAmt = (subtotal * discountPercent) / 100;
  const discountedSubtotal = subtotal - discountAmt;
  const tax = discountedSubtotal * 0.07;
  const grand = discountedSubtotal + tax;

  document.getElementById("subtotal-summary").textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById("tax-summary").textContent = `$${tax.toFixed(2)}`;
  document.getElementById("grandtotal-summary").textContent = `$${grand.toFixed(2)}`;
  document.getElementById("amount-paid-display").textContent = `$${(paymentRecord.cash + paymentRecord.card).toFixed(2)}`;
}


  // ===========================================================
  // 💸 DISCOUNT FIELD + TOTAL CALCULATION
  // ===========================================================
  if (discountInput) {
    discountInput.addEventListener("input", () => {
      const val = parseFloat(discountInput.value) || 0;
      discountPercent = Math.min(Math.max(val, 0), 100);
      updateTotals();
    });
  }

  function updateTotals() {
    const tableBody = document.getElementById("receipt-details");
    let subtotal = 0;
    tableBody.querySelectorAll("tr").forEach((row) => {
      const sub = parseFloat(
        row.children[3]?.textContent.replace(/[^0-9.-]/g, "") || "0"
      );
      subtotal += sub;
    });

    const discountAmt = (subtotal * discountPercent) / 100;
    const discountedSubtotal = subtotal - discountAmt;
    const tax = discountedSubtotal * 0.07;
    const grand = discountedSubtotal + tax;

    document.getElementById("subtotal-summary").textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById("tax-summary").textContent = `$${tax.toFixed(2)}`;
    document.getElementById("grandtotal-summary").textContent = `$${grand.toFixed(2)}`;
    const discountSummary = document.getElementById("discount-summary");
    if (discountSummary)
      discountSummary.textContent = discountPercent
        ? `(${discountPercent}%) -$${discountAmt.toFixed(2)}`
        : "-";
  }

  // ===========================================================
  // 💰 PAYMENT OVERLAY + ACCUMULATION
  // ===========================================================
  function openPaypad(type) {
    currentPaymentType = type;
    if (!paypadOverlay) return;

    const owedEl = document.getElementById("paypad-owed");
    const grandEl = document.getElementById("grandtotal-summary");
    let owed = parseFloat(grandEl.textContent.replace(/[^0-9.]/g, "")) || 0;
    if (owedEl) owedEl.textContent = `$${owed.toFixed(2)}`;

    paypadValue = lastConfirmedValue > 0 ? lastConfirmedValue.toString() : "";
    paypadOverlay.classList.remove("hidden");
    updatePaypadDisplay();
  }

  [cashBtn, cardBtn].forEach((btn) => {
    btn?.addEventListener("click", () =>
      openPaypad(btn.id.includes("cash") ? "Cash" : "Card")
    );
  });

  closePaypadBtn?.addEventListener("click", () =>
    paypadOverlay.classList.add("hidden")
  );

  function updatePaypadDisplay() {
    const owedEl = document.getElementById("paypad-owed");
    const owed = parseFloat(owedEl.textContent.replace(/[^0-9.]/g, "")) || 0;
    const entered = parseFloat(paypadValue || "0");
    const diff = owed - entered;

    let statusText = "";
    if (entered === 0) statusText = "";
    else if (diff > 0) statusText = `Remaining: $${diff.toFixed(2)}`;
    else if (diff < 0) statusText = `Change Due: $${Math.abs(diff).toFixed(2)}`;

    paypadDisplay.innerHTML = paypadValue
      ? `<div class="paypad-entry">$${entered.toFixed(2)}</div>
         <div class="paypad-status">${statusText}</div>`
      : `<div class="paypad-entry">$0.00</div>`;

    document.getElementById("amount-paid-display").textContent = `$${entered.toFixed(2)}`;
    document.getElementById("change-amount").textContent =
      diff >= 0 ? `$${diff.toFixed(2)}` : `Remaining: $${Math.abs(diff).toFixed(2)}`;
  }

  paypadButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.value;
      if (val === "C") paypadValue = "";
      else if (val === "←") paypadValue = paypadValue.slice(0, -1);
      else if (val === ".") {
        if (!paypadValue.includes(".")) paypadValue += ".";
      } else {
        paypadValue += val;
      }
      updatePaypadDisplay();
    });
  });

  confirmPaymentBtn?.addEventListener("click", () => {
    const entered = parseFloat(paypadValue || "0");
    if (isNaN(entered) || entered <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (currentPaymentType === "Cash") paymentRecord.cash += entered;
    if (currentPaymentType === "Card") paymentRecord.card += entered;

    const totalPaid = paymentRecord.cash + paymentRecord.card;
    const typeText =
      paymentRecord.cash && paymentRecord.card
        ? "Cash + Card"
        : paymentRecord.cash
        ? "Cash"
        : "Card";

    document.getElementById("split-info").textContent = typeText;
    document.getElementById("amount-paid-display").textContent = `$${totalPaid.toFixed(2)}`;

    paypadValue = "";
    lastConfirmedValue = totalPaid;
    paypadOverlay.classList.add("hidden");
    updatePaypadDisplay();
  });

  // ===========================================================
// 📧 SUBMIT SALE — Send to Backend + Update Inventory
// ===========================================================
async function submitSale() {
  const email = emailInput?.value.trim().toLowerCase() || "";
  const share = emailToggle?.checked ? "Yes" : "No";
  const paymentType = document.getElementById("split-info").textContent.trim();
  const totalPaid = (paymentRecord.cash + paymentRecord.card).toFixed(2);
  const discount = discountPercent;
  const date = new Date().toLocaleString();

  // 🧾 Build sale rows from the receipt table
  const tableBody = document.getElementById("receipt-details");
  const rows = Array.from(tableBody.querySelectorAll("tr")).map(row => {
    const name = row.children[0]?.textContent || "";
    const qty = parseFloat(row.children[1]?.textContent || "0");
    const price = parseFloat(row.children[2]?.textContent.replace(/[^0-9.]/g, "") || "0");
    const subtotal = parseFloat(row.children[3]?.textContent.replace(/[^0-9.]/g, "") || "0");
    const tax = subtotal * 0.07;
    const total = subtotal + tax;
    const sku = name.split(" ").slice(-1)[0]; // crude SKU match fallback

    return {
      Date: date,
      Sku: sku,
      "Product Title": name,
      Quantity: qty,
      Price: price,
      Subtotal: subtotal,
      Tax: tax,
      Total: total,
      Invoice: Date.now().toString().slice(-6),
      Email: email,
      Subscribe: share,
      Payment: paymentType
    };
  });

  if (!rows.length) {
    alert("🧾 Add at least one product before submitting!");
    return;
  }

  try {
    const res = await fetch(`${INVENTORY_SHEET_URL}?mode=sales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows)
    });

    if (!res.ok) throw new Error(await res.text());
    alert("✅ Sale recorded and inventory updated!");
    console.log("✅ Sent to backend:", rows);
  } catch (err) {
    console.error("❌ Error posting sale:", err);
    alert("⚠️ Could not sync sale. Check console for details.");
  }
}


  // ===========================================================
  // 🚀 INIT
  // ===========================================================
  await loadInventoryData();
  console.log("✅ Kinaya POS ready.");
});
