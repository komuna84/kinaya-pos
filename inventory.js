// ===========================================================
// Kinaya Rising POS - Inventory Management
// ===========================================================

const INVENTORY_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbz1Z9NnfDCxWSxirvAE2tKK-mB9135X_uEuei2Wg-r-qptcpT2sNCPWObcGTbAibCZBFw/exec";
const POS_SHEET_ID = "1tQZt8ZYIWdBYHxDuZxH3emBQ8PNUcxpDZVwm07x28sg";

document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.getElementById("inventory-body");
  const saveBtn = document.getElementById("save-inventory");
  const totalSummary = document.getElementById("total-summary");

  let products = await loadInventoryData();
  renderTable(products);
  updateTotals(products);

  // ===========================================================
  // LIVE UPDATES
  // ===========================================================
  tableBody.addEventListener("input", e => {
    if (!e.target.matches(".inv-input")) return;
    const row = e.target.closest("tr");
    updateStockAndAssets(row);
    products = collectUpdatedDataFromDOM(products);
    updateTotals(products);
  });

  // ===========================================================
  // SAVE CHANGES
  // ===========================================================
  saveBtn.addEventListener("click", async () => {
    const updated = collectUpdatedData();
    await saveInventoryData(updated);
    updateTotals(updated);
  });

  // ===========================================================
  // LOAD INVENTORY DATA
  // ===========================================================
  async function loadInventoryData() {
    try {
      const res = await fetch(`${INVENTORY_SHEET_URL}?mode=inventory&id=${POS_SHEET_ID}`);
      const data = await res.json();
      return data || [];
    } catch (err) {
      console.error("❌ Error loading inventory:", err);
      tableBody.innerHTML = `<tr><td colspan="9" style="color:#e63946;text-align:center;">Error loading data.</td></tr>`;
      return [];
    }
  }

  // ===========================================================
  // RENDER INVENTORY TABLE
  // ===========================================================
  function renderTable(data) {
    if (!data || !data.length) {
      tableBody.innerHTML = `
        <tr><td colspan="10" style="text-align:center;color:#A7E1EE;opacity:0.7;">
          No products found.
        </td></tr>`;
      return;
    }

    tableBody.innerHTML = data.map(item => {
      const price = parseFloat(item.Price || 0);
      const sold = parseInt(item.Sold || 0);
      const received = parseInt(item.Received || 0);
      const damaged = parseInt(item.Damaged || 0);
      const returned = parseInt(item.Returned || 0);
      const inStock = Math.max(received - sold - damaged + returned, 0);
      const netAssets = (inStock * price).toFixed(2);

      return `
        <tr data-sku="${item.Sku}">
          <td><img src="${item.Image || 'https://via.placeholder.com/60?text=No+Img'}" alt="${item.Product}" /></td>
          <td>${item.Sku}</td>
          <td>${item.Product}</td>
          <td>$${price.toFixed(2)}</td>
          <td><input type="number" inputmode="numeric" pattern="[0-9]*" class="inv-input" data-field="Received" value="${received}" min="0" /></td>
          <td><input type="number" inputmode="numeric" pattern="[0-9]*" class="inv-input" data-field="Damaged" value="${damaged}" min="0" /></td>
          <td><input type="number" inputmode="numeric" pattern="[0-9]*" class="inv-input" data-field="Returned" value="${returned}" min="0" /></td>
          <td>${sold}</td>
          <td class="stock">${inStock}</td>
          <td class="assets">$${netAssets}</td>
        </tr>`;
    }).join("");
  }

  // ===========================================================
  // UPDATE STOCK AND NET ASSETS
  // ===========================================================
  function updateStockAndAssets(row) {
    const price = parseFloat(row.children[3].textContent.replace("$", "")) || 0;
    const received = parseInt(row.querySelector('[data-field="Received"]').value) || 0;
    const damaged = parseInt(row.querySelector('[data-field="Damaged"]').value) || 0;
    const returned = parseInt(row.querySelector('[data-field="Returned"]').value) || 0;
    const sold = parseInt(row.children[7].textContent) || 0;

    const inStock = Math.max(received - sold - damaged + returned, 0);
    const netAssets = (inStock * price).toFixed(2);

    row.querySelector(".stock").textContent = inStock;
    row.querySelector(".assets").textContent = `$${netAssets}`;
  }

  // ===========================================================
  // COLLECT UPDATED DATA (for saving)
  // ===========================================================
  function collectUpdatedData() {
    return Array.from(tableBody.querySelectorAll("tr[data-sku]")).map(row => ({
      Sku: row.dataset.sku,
      Received: parseInt(row.querySelector('[data-field="Received"]').value) || 0,
      Damaged: parseInt(row.querySelector('[data-field="Damaged"]').value) || 0,
      Returned: parseInt(row.querySelector('[data-field="Returned"]').value) || 0,
    }));
  }

  // ===========================================================
  // COLLECT FROM DOM (for live totals)
  // ===========================================================
  function collectUpdatedDataFromDOM(existing) {
    return Array.from(tableBody.querySelectorAll("tr[data-sku]")).map(row => {
      const sku = row.dataset.sku;
      const price = parseFloat(row.children[3].textContent.replace("$", "")) || 0;
      const received = parseInt(row.querySelector('[data-field="Received"]').value) || 0;
      const damaged = parseInt(row.querySelector('[data-field="Damaged"]').value) || 0;
      const returned = parseInt(row.querySelector('[data-field="Returned"]').value) || 0;
      const sold = parseInt(row.children[7].textContent) || 0;
      const inStock = Math.max(received - sold - damaged + returned, 0);
      const netAssets = (inStock * price).toFixed(2);

      return { Sku: sku, InStock: inStock, NetAssets: netAssets, Received: received };
    });
  }

  // ===========================================================
  // SAVE TO GOOGLE SHEET
  // ===========================================================
  async function saveInventoryData(updatedRows) {
    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;

    try {
      const res = await fetch(INVENTORY_SHEET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "updateInventory",
          id: POS_SHEET_ID,
          data: updatedRows,
        }),
      });

      const result = await res.json();
      alert(result.status === "success"
        ? "✅ Inventory updated successfully!"
        : "⚠️ Failed to save changes.");
    } catch (err) {
      console.error("❌ Save error:", err);
      alert("❌ Could not save inventory changes.");
    }

    saveBtn.textContent = "💾 Save Changes";
    saveBtn.disabled = false;
  }

  // ===========================================================
  // 🧮 TOTAL SUMMARY BAR
  // ===========================================================
  function updateTotals(products) {
    if (!Array.isArray(products) || !products.length) return;
    const totalItems = products.reduce((sum, p) => sum + (parseFloat(p.InStock) || 0), 0);
    const totalValue = products.reduce((sum, p) => sum + (parseFloat(p.NetAssets) || 0), 0);
    const totalReceived = products.reduce((sum, p) => sum + (parseFloat(p.Received) || 0), 0);

    if (totalSummary) {
      totalSummary.innerHTML = `
        💰 <strong>Total Items:</strong> ${totalItems} |
        🏷️ <strong>Total Value:</strong> $${totalValue.toFixed(2)} |
        📦 <strong>Received:</strong> ${totalReceived}
      `;
    }
  }

  // ===========================================================
  // ✨ QUALITY-OF-LIFE FEATURES
  // ===========================================================

  // Auto-select all text on focus
  document.addEventListener("focusin", e => {
    if (e.target.classList.contains("inv-input")) {
      e.target.select();
    }
  });

  // Prevent accidental scroll changing numbers
  document.addEventListener("wheel", e => {
    if (document.activeElement.classList.contains("inv-input")) {
      e.preventDefault();
    }
  }, { passive: false });
});
