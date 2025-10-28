// ===========================================================
// 🌿 Kinaya Rising — Inventory Management Logic (POS Mirror)
// ===========================================================

const SHEET_API =
  "https://script.google.com/macros/s/AKfycbz83-usxoCG3YpHFACMTH9SA8CP2PLANhdFC92fbpm55qo3KSF30lb9ph3iOooQhQWX0A/exec"; // 🔹 Replace if redeployed

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
  // 🔁 LOAD PRODUCT CATALOG (from POS Sheet)
  // ===========================================================
  async function loadProductCatalog() {
    try {
      const res = await fetch(`${SHEET_API}?mode=pos`);
      if (!res.ok) throw new Error(`Network error: ${res.status}`);
      const data = await res.json();
      renderProducts(data);
      console.log(`✅ Loaded ${data.length} products from sheet.`);
    } catch (err) {
      console.error("❌ Could not load POS data:", err);
      renderProducts(fallbackProducts);
    }
  }


// ===========================================================
// 🛍️ RENDER PRODUCTS — Reads Sale Price + Retail Price
// ===========================================================
function renderProducts(products) {
  if (!menu) return;

  const normalized = products.map((p) => {
    const sale = parseFloat(
      (p["Sale Price"] || "").toString().replace(/[^0-9.]/g, "")
    ) || 0;
    const retail = parseFloat(
      (p["Retail Price"] || "").toString().replace(/[^0-9.]/g, "")
    ) || 0;
    const final = sale > 0 ? sale : retail;

    return {
      sku: p.Sku || p.sku || "",
      name: p["Product Title"] || p.name || "Unnamed Product",
      salePrice: sale,
      retailPrice: retail,
      price: final,
      image:
        p["Image Link"] ||
        p.Image ||
        "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/default.png",
    };
  });

  // 🔹 Build catalog grid
  menu.innerHTML = normalized
    .map(
      (p) => `
        <figure
          class="menu-item"
          data-sku="${p.sku}"
          data-name="${p.name}"
          data-price="${p.price}"
          data-sale="${p.salePrice}"
          data-retail="${p.retailPrice}"
        >
          <img src="${p.image}" alt="${p.name}" />
          <figcaption>${p.name}</figcaption>
          <figcaption style="font-size:0.8em; color:#66caff;">${p.sku}</figcaption>
          <figcaption>
            ${
              p.salePrice > 0
                ? `<span style="color:#bffcff;">$${p.salePrice.toFixed(2)}</span>
                   <span style="text-decoration:line-through; color:#888; margin-left:4px;">$${p.retailPrice.toFixed(2)}</span>`
                : `<span>$${p.retailPrice.toFixed(2)}</span>`
            }
          </figcaption>
        </figure>`
    )
    .join("");

  // 🔹 Attach product click handler (forces retail in Return Mode)
document.querySelectorAll(".menu-item").forEach((item) => {
  item.addEventListener("click", () => {
    const name   = item.dataset.name;
    const sku    = item.dataset.sku;
    const retail = parseFloat(item.dataset.retail || "0");
    const sale   = parseFloat(item.dataset.sale   || "0");

    // 👇 KEY LINE: retail in return mode, sale-if-valid otherwise
    const unitPrice = getActiveUnitPrice(sale, retail);

    // Return mode adds a negative line; normal mode increments/creates positive line
    const qtyChange = window.returnMode ? -1 : 1;

    updateReceipt({ name, sku, price: unitPrice, qtyChange });
  });
});
}  // ✅ closes renderProducts()



  // ===========================================================
  // 🌱 FALLBACK PRODUCTS (Offline Backup)
  // ===========================================================
  const fallbackProducts = [
    { name: "Book — AoL Part 1", sku: "B0F8NFSWXW", price: 14.98, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/B0F8NFSWXW.png" },
    { name: "Bookmarks", sku: "BKM-001", price: 2.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/BKM-001.png" },
    { name: "Buttons (individual)", sku: "Button-001", price: 5.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/Button-001.png" },
    { name: "Buttons (5 pack)", sku: "Button-001-5pk", price: 15.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/Button-001-5pk.png" },
    { name: "Coaster", sku: "Cos-001", price: 10.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/Cos-001.png" },
    { name: "Journal", sku: "Jou-001", price: 14.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/Jou-001.png" },
    { name: "Tote Bag", sku: "TBA-001", price: 20.0, image: "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/TBA-001.png" },
  ];

 // ===========================================================
// 🌿 LIVE PROFIT CALCULATOR — clean 2-decimal display
// ===========================================================
const cost = document.getElementById("unit-cost");
const price = document.getElementById("price");
const profit = document.getElementById("profit-margin");

function formatToCurrency(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return num.toFixed(2);
}

function updateProfit() {
  const c = parseFloat(cost.value) || 0;
  const p = parseFloat(price.value) || 0;
  const margin = p - c;
  profit.value = formatToCurrency(margin);
}

[cost, price].forEach((el) => {
  el.addEventListener("input", updateProfit);
  el.addEventListener("blur", () => {
    el.value = formatToCurrency(el.value);
    updateProfit();
  });
});


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
      "Unit Price": parseFloat(document.getElementById("unit-cost").value) || 0, // ✅ changed key
      "Retail Price": parseFloat(document.getElementById("price").value) || 0,
      "Sale Price": parseFloat(document.getElementById("sale-price").value) || 0,
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

  saveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    saveOrUpdate(false);
  });
  updateBtn.addEventListener("click", (e) => {
    e.preventDefault();
    saveOrUpdate(true);
  });

  // ===========================================================
// 🌿 CLEAR FORM — reset everything and hide inventory panel
// ===========================================================
clearBtn.addEventListener("click", (e) => {
  e.preventDefault();

  // Reset the main form
  form.reset();

  // Reset all inventory adjustment fields
  const fields = ["in-stock", "received", "counted", "damaged", "sale-price", "unit-cost"];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = 0;
  });

  // Hide the inventory adjustment panel again
  const panel = document.querySelector(".inventory-panel");
  if (panel) panel.classList.add("hidden");

  // Reset button visibility
  updateBtn.classList.add("hidden");
  saveBtn.classList.remove("hidden");

  // Clear current product reference
  currentProduct = null;

  console.log("🌿 Form cleared and panel hidden");
});


  // ===========================================================
  // 🌿 INIT
  // ===========================================================
  await loadProductCatalog();

});
