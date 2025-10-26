// ===========================================================
// 🌿 Kinaya Rising — Inventory Management Logic (POS Mirror)
// ===========================================================

const SHEET_API =
  "https://script.google.com/macros/s/AKfycbw56BFnWW5CqsHsqwE9gmZE5SLu-Z-WJLaSgx8RHb4aYFC3B7jo-GogBWkVUKyH_eo9sg/exec"; // 🔹 Replace if redeployed

document.addEventListener("DOMContentLoaded", async () => {
  const menu = document.getElementById("menu");
  const form = document.getElementById("add-inventory-form");
  const saveBtn = document.getElementById("save-item-btn");
  const updateBtn = document.getElementById("update-item-btn");
  const clearBtn = document.getElementById("clear-form-btn");

  const inStockInput = document.getElementById("in-stock");
  const receivedInput = document.getElementById("received");
  const countedInput = document.getElementById("counted");
  const damagedInput = document.getElementById("damaged");

  let currentProduct = null;

  // ===========================================================
  // 🌿 LOAD INVENTORY ITEMS (POS mirror)
  // ===========================================================
  async function loadInventory() {
    try {
      const response = await fetch(`${SHEET_API}?mode=pos`, { mode: "cors" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      renderProducts(data);
      console.log(`✅ Loaded ${data.length} products into inventory`);
    } catch (err) {
      console.error("❌ Failed to load inventory:", err);
      menu.innerHTML = `<div class="error-msg">Failed to load inventory data.</div>`;
    }
  }

  // ===========================================================
  // 🌿 RENDER PRODUCT GRID
  // ===========================================================
  function renderProducts(products) {
    menu.innerHTML = "";
    if (!Array.isArray(products) || !products.length) {
      menu.innerHTML = `<p style="color:#A7E1EE;opacity:0.7;">No products available.</p>`;
      return;
    }

    products.forEach(p => {
      const card = document.createElement("div");
      card.classList.add("product-card");
      card.innerHTML = `
        <img src="${p["Image Link"] || "assets/placeholder.png"}" alt="${p["Product Title"] || ""}" />
        <h3>${p["Product Title"] || "Untitled"}</h3>
        <p class="sku">${p.Sku || ""}</p>
        <p class="price">$${Number(p.Price || 0).toFixed(2)}</p>
      `;
      card.addEventListener("click", () => fillForm(p));
      menu.appendChild(card);
    });
  }

  // ===========================================================
  // 🌿 FILL FORM WITH EXISTING PRODUCT + STOCK CONTROL
  // ===========================================================
  function fillForm(p) {
    currentProduct = p;

    // Basic Info
    document.getElementById("sku").value = p.Sku || "";
    document.getElementById("stable-sku").value = p["Stable Sku"] || "";
    document.getElementById("title").value = p["Product Title"] || "";
    document.getElementById("image").value = p["Image Link"] || "";
    document.getElementById("unit-cost").value = p["Unit Cost"] || "";
    document.getElementById("price").value = p.Price || "";
    document.getElementById("sale-price").value = p["Sale Price"] || p.Price || 0;
    document.getElementById("profit-margin").value = p["Profit Margin"] || "";
    document.getElementById("units-in-set").value = p["Units in Set"] || 1;
    document.getElementById("status").value = (p.Status || "active").toLowerCase();
    document.getElementById("materials").value = p.Materials || "";
    document.getElementById("vendor").value = p.Vendor || "";
    document.getElementById("description").value = p.Description || "";
    document.getElementById("keywords").value = p.Keywords || "";

    // Stock Info
    const stock = parseFloat(p["In Stock"] || p["Stock"] || p["Qty"] || 0);
    inStockInput.value = stock;
    receivedInput.value = "";
    countedInput.value = "";
    damagedInput.value = "";

    saveBtn.classList.add("hidden");
    updateBtn.classList.remove("hidden");
  }
  // ===========================================================
  // 🌿 SHOW INVENTORY PANEL WHEN PRODUCT IS SELECTED
  // ===========================================================
  const inventoryPanel = document.querySelector(".inventory-panel");

  function showInventoryPanel() {
    if (!inventoryPanel) return;
    inventoryPanel.classList.remove("hidden");
    inventoryPanel.style.maxHeight = "500px";
    inventoryPanel.style.opacity = "1";
    inventoryPanel.style.transition = "all 0.4s ease-in-out";
  }

  // reveal panel when a product is filled
  function fillForm(p) {
    currentProduct = p;

    // Basic Info
    document.getElementById("sku").value = p.Sku || "";
    document.getElementById("stable-sku").value = p["Stable Sku"] || "";
    document.getElementById("title").value = p["Product Title"] || "";
    document.getElementById("image").value = p["Image Link"] || "";
    document.getElementById("unit-cost").value = p["Unit Cost"] || "";
    document.getElementById("price").value = p.Price || "";
    document.getElementById("sale-price").value = p["Sale Price"] || p.Price || 0;
    document.getElementById("profit-margin").value = p["Profit Margin"] || "";
    document.getElementById("units-in-set").value = p["Units in Set"] || 1;
    document.getElementById("status").value = (p.Status || "active").toLowerCase();
    document.getElementById("materials").value = p.Materials || "";
    document.getElementById("vendor").value = p.Vendor || "";
    document.getElementById("description").value = p.Description || "";
    document.getElementById("keywords").value = p.Keywords || "";

    // Stock Info
    const stock = parseFloat(p["In Stock"] || p["Stock"] || p["Qty"] || 0);
    inStockInput.value = stock;
    receivedInput.value = "";
    countedInput.value = "";
    damagedInput.value = "";

    // Toggle button visibility
    saveBtn.classList.add("hidden");
    updateBtn.classList.remove("hidden");

    // ✅ reveal the inventory adjustment grid
    showInventoryPanel();
  }

  // ===========================================================
  // 🌿 LIVE STOCK PREVIEW
  // ===========================================================
  [receivedInput, countedInput, damagedInput].forEach(input => {
    input.addEventListener("input", () => {
      if (!currentProduct) return;
      const baseStock = parseFloat(currentProduct["In Stock"] || 0);
      const received = parseFloat(receivedInput.value) || 0;
      const damaged = parseFloat(damagedInput.value) || 0;
      const counted = parseFloat(countedInput.value) || 0;
      const newStock = counted > 0 ? counted : baseStock + received - damaged;
      inStockInput.value = newStock;
    });
  });

  // ===========================================================
  // 🌿 CLEAR FORM
  // ===========================================================
  clearBtn.addEventListener("click", e => {
    e.preventDefault();
    form.reset();
    updateBtn.classList.add("hidden");
    saveBtn.classList.remove("hidden");
  });

  // ===========================================================
  // 🌿 LIVE PROFIT CALCULATOR
  // ===========================================================
  const cost = document.getElementById("unit-cost");
  const price = document.getElementById("price");
  const profit = document.getElementById("profit-margin");

  function updateProfit() {
    const c = parseFloat(cost.value) || 0;
    const p = parseFloat(price.value) || 0;
    profit.value = (p - c).toFixed(2);
  }

  cost.addEventListener("input", updateProfit);
  price.addEventListener("input", updateProfit);

  // ===========================================================
  // 🌿 SAVE / UPDATE ITEM
  // ===========================================================
  async function saveOrUpdate(isUpdate = false) {
    const payload = {
      Mode: "inventoryUpdate",
      Sku: document.getElementById("sku").value.trim(),
      "Stable Sku": document.getElementById("stable-sku").value.trim(),
      "Product Title": document.getElementById("title").value.trim(),
      "Image Link": document.getElementById("image").value.trim(),
      "Unit Cost": parseFloat(document.getElementById("unit-cost").value) || 0,
      Price: parseFloat(document.getElementById("price").value) || 0,
      "Profit Margin": parseFloat(document.getElementById("profit-margin").value) || 0,
      "Units in Set": parseFloat(document.getElementById("units-in-set").value) || 1,
      Status: document.getElementById("status").value,
      Materials: document.getElementById("materials").value.trim(),
      Vendor: document.getElementById("vendor").value.trim(),
      Description: document.getElementById("description").value.trim(),
      Keywords: document.getElementById("keywords").value.trim(),
      "In Stock": parseFloat(inStockInput.value) || 0,
    };

    try {
      const res = await fetch(SHEET_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([payload]),
      });
      const result = await res.json();
      alert(result.message || "✅ Saved!");
      await loadInventory();
      form.reset();
      updateBtn.classList.add("hidden");
      saveBtn.classList.remove("hidden");
    } catch (err) {
      console.error("❌ Save failed:", err);
      alert("Error saving item.");
    }
  }

  saveBtn.addEventListener("click", e => {
    e.preventDefault();
    saveOrUpdate(false);
  });
  updateBtn.addEventListener("click", e => {
    e.preventDefault();
    saveOrUpdate(true);
  });

  // ===========================================================
  // 🌿 INIT
  // ===========================================================
  await loadInventory();
});
