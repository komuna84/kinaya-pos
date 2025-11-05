// ===========================================================
// 🌿 Kinaya Rising POS — Inventory Management Logic (2025)
// ===========================================================

// ---------- GLOBAL SETTINGS ----------
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🌿 Inventory Manager initializing...");



  // ---------- CONFIG ----------
  const SHEET_API =
    "https://script.google.com/macros/s/AKfycbxDzflmDmWiP8qzTUKhKdsdWSL_ZOaRnA8sRrmJ0Qj8yPXm1hya6dWvq-BoJW25NntLLA/exec"; // 🔹 Replace if redeployed

  // ---------- CORE ELEMENTS ----------
  const menu = document.getElementById("menu");
  const form = document.getElementById("add-inventory-form");
  form.addEventListener("input", () => {
  formChanged = true;
  updateSaveButtonLabel();
});

  const saveBtn = document.getElementById("save-item-btn");
  const clearBtn = document.getElementById("clear-form-btn");
  const inStockInput = document.getElementById("in-stock");
  let currentProduct = null;
  let formChanged = false;
  let isExistingProduct = false;


// ===========================================================
// ⌨️ ENTER KEY BEHAVIOR — Move to next input instead of submit
// ===========================================================
form.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const formElements = Array.from(
      form.querySelectorAll("input, select, textarea, button")
    );
    const index = formElements.indexOf(e.target);

    // Skip Enter for buttons or textareas
    if (e.target.tagName === "TEXTAREA" || e.target.type === "button") return;

    e.preventDefault();

    const next = formElements[index + 1];
    if (next) {
      next.focus();
      // Optional: select text for quicker overwrite
      if (next.select) next.select();
    } else {
      // reached end of form — confirm save
      confirmSave(currentProduct !== null);
    }
  }
});

// ===========================================================
// 🔁 LOAD PRODUCT CATALOG (deduplicates to newest version)
// ===========================================================
async function loadProductCatalog() {
  try {
    const res = await fetch(`${SHEET_API}?mode=pos`);
    const json = await res.json();

    const raw =
      json.data || json.records || json.values || json.products || json.items || json;

    // 🧩 Normalize sheet headers → consistent JS keys
    const normalized = raw.map((r) => {
      const clean = {};
      for (const k in r) clean[k.trim().toLowerCase()] = r[k];
      return {
  sku: clean["sku"] || clean["Sku"] || "",
  stableSku: clean["stable sku"] || clean["Stable Sku"] || "",
  name: clean["product title"] || clean["title"] || clean["Product Title"] || "Unnamed Product",
  image:
    clean["image link"] ||
    clean["image"] ||
    clean["image url"] ||
    "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/default.png",

  retailPrice: parseFloat(clean["retail price"] || clean["Retail Price"] || 0),
  cost: parseFloat(
  clean["unit price"] ||
  clean["UnitPrice"] ||
  clean["wholesale"] ||
  clean["Wholesale"] ||
  0
),

  stock: parseFloat(clean["in stock"] || clean["In Stock"] || 0),
  bulkQuantity: parseFloat(clean["bulk quantity"]) || 0,
  bulkCost: parseFloat(clean["bulk cost ($)"]) || 0,
  profitMargin: parseFloat(clean["profit margin"] || clean["Profit Margin"] || 0),
  unitsInSet: clean["units in set"] || clean["Units in Set"] || "1",
  materials: clean["materials"] || clean["Materials"] || "",
  vendor: clean["vendor"] || clean["Vendor"] || "",
  description: clean["description"] || clean["Description"] || "",
  keywords: clean["keywords"] || clean["Keywords"] || "",
  status: clean["status"] || clean["Status"] || "Active",

  timestamp: new Date(clean["timestamp"] || clean["Timestamp"] || 0).getTime() || 0,
};
    });

    // 🌿 Keep only the most recent entry per SKU
    const latestOnly = Object.values(
      normalized.reduce((acc, item) => {
        const existing = acc[item.sku];
        if (!existing || item.timestamp > existing.timestamp) {
          acc[item.sku] = item;
        }
        return acc;
      }, {})
    );

    console.log(
      `✅ Found ${latestOnly.length} latest products (deduplicated from ${normalized.length})`
    );

    window.productList = latestOnly; // ✅ make available globally for dropdowns
    populateStableSkuDropdown(latestOnly); // ✅ refresh Stable SKU dropdown

    // ✅ Render the deduped product list
    renderProducts(latestOnly);
  } catch (err) {
    console.error("❌ Failed to load or deduplicate catalog:", err);
    renderProducts(fallbackProducts);
  }

}

// ===========================================================
// 🛍️ RENDER PRODUCTS — Grid + Click to Populate Form (Inventory)
// ===========================================================
function renderProducts(products) {
  const menu = document.getElementById("menu");
  if (!menu) return;

  // 🔹 Build product grid
  menu.innerHTML = products
    .map(
      (p) => `
        <figure class="menu-item" data-sku="${p.sku}">
          <img src="${p.image}" alt="${p.name}" />
          <figcaption>${p.name}</figcaption>
          <figcaption style="font-size:0.8em; color:#66caff;">${p.sku}</figcaption>
          <figcaption style="color:#bffcff;">$${p.retailPrice.toFixed(2)}</figcaption>
        </figure>`
    )
    .join("");

  // 🔹 Click → populate form fields
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => {
      const sku = item.dataset.sku;
      const product = products.find((p) => p.sku === sku);
      if (!product) return;
      isExistingProduct = true;
      formChanged = false;
      updateSaveButtonLabel();

      const fields = [
  ["sku", product.sku],
  ["stable-sku", product.stableSku || ""],
  ["title", product.name || ""],
  ["image", product.image || ""],
  ["status", product.status || ""],
  ["vendor", product.vendor || ""],
  ["description", product.description || ""],
  ["keywords", product.keywords || ""],
  ["materials", product.materials || ""],
  ["price", product.retailPrice?.toFixed(2) || ""],
  ["unit-cost", product.cost?.toFixed(2) || ""],
  ["profit-margin", product.profitMargin?.toFixed(2) || ""],
  ["bulk-quantity", product.bulkQuantity || ""],
  ["bulk-cost", product.bulkCost?.toFixed(2) || ""],
  ["in-stock", product.stock || 0],
];

      fields.forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;

      // If it's a numeric field, format nicely
      if (["price", "unit-cost", "profit-margin"].includes(id)) {
        el.value = val ? parseFloat(val).toFixed(2) : "";
      } else {
        el.value = val ?? "";
      }
    });

// 🔹 Auto-calculate Profit Margin for new products
const cost = parseFloat(document.getElementById("unit-cost")?.value || 0);
const retail = parseFloat(document.getElementById("price")?.value || 0);
const profitInput = document.getElementById("profit-margin");

if (!profitInput.value || profitInput.value === "0.00") {
  const margin = retail - cost;
  profitInput.value = margin > 0 ? margin.toFixed(2) : "0.00";
}


      // 🧭 Always scroll to top (mobile-friendly)
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });


      currentProduct = product;
      console.log(`📦 Loaded product into form: ${product.name}`);
    });
  });

  console.log(`✅ Rendered ${products.length} products.`);
}

// ===========================================================
// 🏷️ LOAD + MANAGE VENDOR DROPDOWN
// ===========================================================
async function loadVendorDropdown() {
  const vendorSelect = document.getElementById("vendor");
  if (!vendorSelect) return;

  try {
    // 🔹 Load vendor list from Sheet
    const res = await fetch(`${SHEET_API}?mode=vendors`);
    const json = await res.json();

    // 🔹 Build dropdown options
    vendorSelect.innerHTML = `<option value="">— Select or Add Vendor —</option>`;
    (json.vendors || []).forEach((vendor) => {
      const opt = document.createElement("option");
      opt.value = vendor;
      opt.textContent = vendor;
      vendorSelect.appendChild(opt);
    });

    // 🔹 Add a special "Add new..." option at the end
    const addOpt = document.createElement("option");
    addOpt.value = "__add_new__";
    addOpt.textContent = "+ Add new vendor";
    vendorSelect.appendChild(addOpt);

    console.log(`📦 Loaded ${json.count || 0} vendors`);
  } catch (err) {
    console.error("❌ Failed to load vendors:", err);
  }

  // 🔹 When user selects “Add new vendor”
  vendorSelect.addEventListener("change", async () => {
    if (vendorSelect.value === "__add_new__") {
      const newVendor = prompt("Enter new vendor name:");
      if (newVendor && newVendor.trim()) {
        await addVendorToSheet(newVendor.trim());
        await loadVendorDropdown();
        vendorSelect.value = newVendor.trim();
      } else {
        vendorSelect.value = "";
      }
    }
  });
}

// ===========================================================
// ➕ ADD NEW VENDOR TO SHEET
// ===========================================================
async function addVendorToSheet(vendorName) {
  try {
    const payload = [{ Mode: "addVendor", Vendor: vendorName }];
    const res = await fetch(SHEET_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    showToast(result.message || `Added vendor '${vendorName}'`);
  } catch (err) {
    console.error("❌ Failed to add vendor:", err);
    showToast("Error adding vendor.", false);
  }
}


// ===========================================================
// 🧮 Populate Stable SKU Dropdown
// ===========================================================
function populateStableSkuDropdown(products) {
  const stableSkuSelect = document.getElementById("stable-sku");
  if (!stableSkuSelect) return;

  // Clear current options except the first one
  stableSkuSelect.innerHTML = `<option value="">— None (standalone item) —</option>`;

  // Add all SKUs as selectable base references
  products.forEach((p) => {
    if (p.sku) {
      const opt = document.createElement("option");
      opt.value = p.sku;
      opt.textContent = `${p.sku} — ${p.name}`;
      stableSkuSelect.appendChild(opt);
    }
  });

  console.log(`📦 Stable SKU dropdown populated with ${products.length} items.`);
}


// ===========================================================
// updateSaveButtonLabel() helper
// ===========================================================
function updateSaveButtonLabel() {
  const btn = document.getElementById("save-item-btn");
  if (!btn) return;

  if (isExistingProduct && !formChanged) {
    btn.innerHTML = `<i class="fa-solid fa-box"></i> Adjust Inventory`;
    btn.classList.remove("primary-btn");
    btn.classList.add("secondary-btn");
  } else {
    btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Submit Changes`;
    btn.classList.remove("secondary-btn");
    btn.classList.add("primary-btn");
  }
}

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
// 🌿 LIVE PROFIT + UNIT COST CALCULATOR — smooth typing
// ===========================================================
const bulkCost = document.getElementById("bulk-cost");        // Bulk Cost ($)
const bulkQty = document.getElementById("bulk-quantity");     // Bulk Quantity
const unitCost = document.getElementById("unit-cost");        // Unit Cost ($)
const price = document.getElementById("price");               // Retail Price ($)
const profit = document.getElementById("profit-margin");      // Profit Margin ($)

function formatToCurrency(value) {
  const num = parseFloat(value);
  return isNaN(num) ? "" : num.toFixed(2);
}

function updateUnitAndProfit(triggeredByBlur = false) {
  const bulk = parseFloat(bulkCost?.value) || 0;
  const qty = parseFloat(bulkQty?.value) || 0;
  let unit = parseFloat(unitCost?.value) || 0;

  // ✅ Only recalc unit cost if bulk info available
  if (qty > 0 && bulk > 0) {
    unit = bulk / qty;
    if (triggeredByBlur) unitCost.value = formatToCurrency(unit);
  }

  // ✅ Only format when the user is done typing
  if (triggeredByBlur) {
    if (bulkCost === document.activeElement) bulkCost.value = formatToCurrency(bulkCost.value);
    if (price === document.activeElement) price.value = formatToCurrency(price.value);
    if (unitCost === document.activeElement) unitCost.value = formatToCurrency(unitCost.value);
  }

  // ✅ Update profit dynamically but don’t overwrite typing
  const retail = parseFloat(price?.value) || 0;
  const margin = retail - unit;
  profit.value = formatToCurrency(margin);
}

// 🌀 Attach event listeners
[bulkCost, bulkQty, unitCost, price].forEach((el) => {
  if (!el) return;
  el.addEventListener("input", () => updateUnitAndProfit(false)); // live update, no format
  el.addEventListener("blur", () => updateUnitAndProfit(true));   // format on blur only
});

// 🌿 Initialize button to "Adjust Inventory" on first load
isExistingProduct = true;
formChanged = false;
updateSaveButtonLabel();

// ===========================================================
// 💾 SAVE PRODUCT — POST TO BACKEND (CORS-SAFE, AUTO-RESET)
// ===========================================================
async function saveProduct() {
  // 🔹 Your live deployed web app URL
  const SHEET_API =
    "https://script.google.com/macros/s/AKfycbxDzflmDmWiP8qzTUKhKdsdWSL_ZOaRnA8sRrmJ0Qj8yPXm1hya6dWvq-BoJW25NntLLA/exec"; // 🔹 Replace if redeployed

  const data = {
    Mode: "inventoryEntry",
    Sku: document.getElementById("sku")?.value.trim() || "",
    "Stable Sku": document.getElementById("stable-sku")?.value.trim() || "",
    "Product Title": document.getElementById("title")?.value.trim() || "",
    "Image Link": document.getElementById("image")?.value.trim() || "",
    "Unit Cost ($)": document.getElementById("unit-cost")?.value.trim() || "",
    "Bulk Quantity": document.getElementById("bulk-quantity")?.value.trim() || "",
    "Bulk Cost ($)": document.getElementById("bulk-cost")?.value.trim() || "",
    "Retail Price ($)": document.getElementById("price")?.value.trim() || "",
    "Profit Margin ($)": document.getElementById("profit-margin")?.value.trim() || "",
    "Units in Set": document.getElementById("units-in-set")?.value.trim() || "1",
    Status: document.getElementById("status")?.value.trim() || "",
    Materials: document.getElementById("materials")?.value.trim() || "",
    Vendor: document.getElementById("vendor")?.value.trim() || "",
    Description: document.getElementById("description")?.value.trim() || "",
    Keywords: document.getElementById("keywords")?.value.trim() || "",
  };

  console.log("🧾 Saving product:", data);

  // --- Send POST (CORS-safe, same style as sales log) ---
  const res = await fetch(SHEET_API, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify([data]),
  });

  const text = await res.text();
  const json = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  })();

  if (!res.ok || !json.success) {
    console.error("❌ Save failed:", res.status, json);
    showToast(`⚠️ Save failed: ${json.error || res.statusText}`, false);
    return;
  }

  console.log("✅ Product saved:", json);
  showToast(json.message || "✅ Product added successfully!");

  // --- Reset form ---
  document.querySelector("form")?.reset();

  // --- Optional refresh ---
  if (typeof loadProductCatalog === "function") await loadProductCatalog();
  if (typeof loadVendorDropdown === "function") await loadVendorDropdown();

  return json;
}

// ===========================================================
// 💾 SAVE PRODUCT BUTTON HANDLER
// ===========================================================
saveBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  // 1️⃣ If form untouched → open Inventory Log
  if (isExistingProduct && !formChanged) {
    const sku = document.getElementById("sku")?.value?.trim();
    const url = sku
      ? `./inventory-log.html?sku=${encodeURIComponent(sku)}`
      : `./inventory-log.html`;
    window.location.href = url;
    return;
  }

  // 2️⃣ Confirm before save
  const proceed = await confirmSave();
  if (!proceed) {
    showToast("❌ Submission canceled.", false);
    return;
  }

  // 3️⃣ Show spinner
  saveBtn.disabled = true;
  const originalHTML = saveBtn.innerHTML;
  saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

  try {
    await saveProduct();
    formChanged = false;
    isExistingProduct = true;
    updateSaveButtonLabel();
  } catch (err) {
    console.error("❌ Error saving product:", err);
    showToast("⚠️ Save failed. Check console.", false);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalHTML;
  }
});

// ===========================================================
// 💬 CONFIRM BEFORE SAVE
// ===========================================================
async function confirmSave() {
  return confirm("Submit these changes to the inventory?");
}

// ===========================================================
// 🧹 CLEAR FORM — resets fields + restores Adjust Inventory state
// ===========================================================
clearBtn?.addEventListener("click", () => {
  form.reset();
  formChanged = false;
  isExistingProduct = true; // ✅ always return to Adjust mode
  updateSaveButtonLabel();
  showToast("🧹 Form cleared! Ready to view inventory.");
});


// ===========================================================
// 🌈 TOAST MESSAGE — Centered Success / Fail Feedback
// ===========================================================
function showToast(message, isSuccess = true) {
  document.querySelectorAll(".toast").forEach(t => t.remove());

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  Object.assign(toast.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) scale(0.9)",
    background: isSuccess ? "rgba(0,198,255,0.85)" : "rgba(255,90,90,0.9)",
    color: "#fff",
    padding: "1rem 1.75rem",
    borderRadius: "12px",
    boxShadow: "0 0 20px rgba(0,0,0,0.4)",
    fontFamily: "Audiowide, sans-serif",
    fontSize: "1.1rem",
    letterSpacing: "0.5px",
    textAlign: "center",
    zIndex: "9999",
    opacity: "0",
    transition: "opacity 0.4s ease, transform 0.3s ease",
    backdropFilter: "blur(4px)",
  });

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translate(-50%, -50%) scale(1)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, -50%) scale(0.95)";
  }, 2000);
  setTimeout(() => toast.remove(), 2500);
}

// // ===========================================================
// // 🔄 AUTO-SAVE TRIGGER — Detects edits + saves after pause
// // ===========================================================
// let formChanged = false;
// let saveTimeout;

// form.querySelectorAll("input, select, textarea").forEach((el) => {
//   el.addEventListener("input", () => {
//     formChanged = true;
//     saveBtn.disabled = false;
//   });
// });

// form.addEventListener("input", () => {
//   clearTimeout(saveTimeout);
//   saveTimeout = setTimeout(async () => {
//     if (!formChanged) return;
//     formChanged = false;

//     try {
//       console.log("💾 Auto-saving form...");
//       await saveProduct();
//       showToast("✅ Changes saved automatically!");
//     } catch (err) {
//       console.error("❌ Auto-save failed:", err);
//       showToast("⚠️ Auto-save failed. Check console.", false);
//     }
//   }, 3000); // 3 sec debounce
// });

// ===========================================================
// 🌿 INIT
// ===========================================================
await loadProductCatalog();
await loadVendorDropdown();
});
