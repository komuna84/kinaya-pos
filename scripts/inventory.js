// ===========================================================
// 🌿 Kinaya Rising POS — Inventory Logic (Fail-Safe Build)
// ===========================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🌿 Loading advanced inventory system...");

  const API_URL =
    "https://script.google.com/macros/s/AKfycbyR-1IXv_ez6K1knaGizSVavXxN7Zzd--gB8G_3YjRAuiHnzLeFkp1a34M1TVzVQk8usQ/exec";

  const tableBody = document.getElementById("inventory-body");
  const saveBtn = document.getElementById("save-inventory");
  const totalSummary = document.getElementById("total-summary");

  if (!tableBody || !saveBtn || !totalSummary) {
    console.error("❌ Missing one or more DOM elements.");
    return;
  }

  // ===========================================================
  // 🧾 LOAD INVENTORY DATA
  // ===========================================================
  async function loadInventoryData() {
    try {
      const res = await fetch(`${API_URL}?mode=inventory`);
      if (!res.ok) throw new Error(`Network error: ${res.status}`);
      const data = await res.json();

      if (!Array.isArray(data)) throw new Error("Data not an array");
      renderTable(data);
      updateTotals();
      console.log(`✅ Inventory loaded (${data.length} items)`);
    } catch (err) {
      console.error("❌ Failed to load inventory:", err);
      tableBody.innerHTML = `
        <tr><td colspan="13" style="text-align:center;color:#e63946;">
        Failed to load inventory data.</td></tr>`;
    }
  }

  // ===========================================================
  // 🧩 RENDER TABLE
  // ===========================================================
  function renderTable(products) {
    tableBody.innerHTML = products
      .map((p, i) => {
        const price = parseFloat(p.Price) || 0;
        const received = parseFloat(p.Received) || 0;
        const sold = parseFloat(p.Sold) || 0;
        const damaged = parseFloat(p.Damaged) || 0;
        const returned = parseFloat(p.Returned) || 0;
        const unitsInSet = parseFloat(p.UnitsInSet) || 1;
        const inStock = Math.max(received - sold - damaged + returned, 0);
        const netAssets = (inStock * price).toFixed(2);

        return `
          <tr data-index="${i}" data-stable="${p["Stable Sku"] || p.Sku}">
            <td><img src="${p.Image || ""}" alt="${p.Product || ""}" 
                style="width:40px;height:40px;border-radius:6px;object-fit:cover;"></td>
            <td>${p.Sku || ""}</td>
            <td>${p["Stable Sku"] || p.Sku || ""}</td>
            <td>${p["Product Title"] || p.Product || ""}</td>
            <td contenteditable="true" class="editable price">${price.toFixed(2)}</td>
            <td contenteditable="true" class="editable units">${unitsInSet}</td>
            <td contenteditable="true" class="editable received">${received}</td>
            <td contenteditable="true" class="editable damaged">${damaged}</td>
            <td contenteditable="true" class="editable returned">${returned}</td>
            <td contenteditable="true" class="editable sold">${sold}</td>
            <td class="instock">${inStock}</td>
            <td class="net-assets">$${netAssets}</td>
          </tr>`;
      })
      .join("");

    tableBody.querySelectorAll(".editable").forEach(cell => {
      cell.addEventListener("input", handleEdit);
    });
  }

  // ===========================================================
  // 🧮 HANDLE EDITS
  // ===========================================================
  function handleEdit(e) {
    const row = e.target.closest("tr");
    if (!row) return;

    const get = c => parseFloat(row.querySelector(c)?.textContent) || 0;

    const price = get(".price");
    const received = get(".received");
    const damaged = get(".damaged");
    const returned = get(".returned");
    const sold = get(".sold");

    const instock = Math.max(received - sold - damaged + returned, 0);
    const net = instock * price;

    row.querySelector(".instock").textContent = instock;
    row.querySelector(".net-assets").textContent = `$${net.toFixed(2)}`;

    updateTotals();
  }

  // ===========================================================
  // 💰 TOTAL BAR
  // ===========================================================
  function updateTotals() {
    const rows = [...document.querySelectorAll("#inventory-body tr")];
    let totalStock = 0;
    let totalValue = 0;

    rows.forEach(row => {
      const stock = parseFloat(row.querySelector(".instock")?.textContent) || 0;
      const net = parseFloat(
        row.querySelector(".net-assets")?.textContent.replace(/[^0-9.]/g, "")
      ) || 0;
      totalStock += stock;
      totalValue += net;
    });

    totalSummary.innerHTML = `
      <p><strong>Total Products:</strong> ${rows.length}</p>
      <p><strong>Total Units In Stock:</strong> ${totalStock}</p>
      <p><strong>Total Asset Value:</strong> $${totalValue.toFixed(2)}</p>
    `;
  }

  // ===========================================================
  // 💾 SAVE BACK TO SHEET
  // ===========================================================
  async function saveInventory() {
    const rows = [...document.querySelectorAll("#inventory-body tr")];
    const payload = rows.map(row => ({
      Sku: row.children[1]?.textContent.trim(),
      "Stable Sku": row.dataset.stable,
      "Product Title": row.children[3]?.textContent.trim(),
      Price: parseFloat(row.children[4]?.textContent.trim()) || 0,
      UnitsInSet: parseFloat(row.children[5]?.textContent.trim()) || 1,
      Received: parseFloat(row.children[6]?.textContent.trim()) || 0,
      Damaged: parseFloat(row.children[7]?.textContent.trim()) || 0,
      Returned: parseFloat(row.children[8]?.textContent.trim()) || 0,
      Sold: parseFloat(row.children[9]?.textContent.trim()) || 0,
      InStock: parseFloat(row.children[10]?.textContent.trim()) || 0,
      NetAssets: parseFloat(
        row.children[11]?.textContent.replace("$", "").trim()
      ) || 0,
    }));

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      alert("✅ Inventory synced successfully!");
    } catch (err) {
      console.error("❌ Save error:", err);
      alert("⚠️ Could not save inventory.");
    }
  }

  saveBtn?.addEventListener("click", saveInventory);

  // ===========================================================
  // 🚀 INIT
  // ===========================================================
  await loadInventoryData();
});
