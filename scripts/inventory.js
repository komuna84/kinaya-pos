// ===========================================================
// 🌿 Kinaya Rising — Inventory Management Logic (POS Mirror)
// ===========================================================

const SHEET_API =
  "https://script.google.com/macros/s/AKfycbw2tVFsnIuZdorUrUJShEZjP2uRcuz1VwHiz2KpdlrHj9q04qyIvYJT1nAMobPYzFa9RQ/exec"; // 🔹 Replace if redeployed

document.addEventListener("DOMContentLoaded", async () => {
  const menu = document.getElementById("menu");
  const form = document.getElementById("add-inventory-form");
  const saveBtn = document.getElementById("save-item-btn");
  const updateBtn = document.getElementById("update-item-btn");
  const clearBtn = document.getElementById("clear-form-btn");

  const inStockInput = document.getElementById("in-stock");
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
  // 🛍️ RENDER PRODUCTS — Grid + Click to Load Form
  // ===========================================================
  function renderProducts(products) {
  if (!menu) return;

  const normalized = products.map((p) => {
  const clean = {};
  for (const k in p) {
    clean[k.trim()] = p[k]; // 🔹 removes leading/trailing spaces in sheet headers
  }

  return {
  sku: clean["Sku"] || "",
  stableSku: clean["Stable Sku"] || "",
  name: clean["Product Title"] || "Unnamed Product",
  image:
    clean["Image Link"] ||
    "https://raw.githubusercontent.com/komuna84/kinaya-pos-assets/main/default.png",
  retailPrice: parseFloat(clean["Retail Price"] || 0),
  discountPrice: parseFloat(clean["Sale Price"] || 0),
  cost: parseFloat(clean["Unit Price"] || clean["Unit Cost"] || 0),
  profit: parseFloat(clean["Profit Margin"] || 0),
  status: clean["Status"] || "active",
  stock: parseFloat(clean["In Stock"] || 0),
  vendor: clean["Vendor"] || "",
  description: clean["Description"] || "",
  keywords: clean["Keywords"] || "",
  materials: clean["Materials"] || "",
  units: parseFloat(clean["Units in Set"] || 1),
  shipping: parseFloat(clean["Shipping"] || 0),
};

});


  // 🔹 Build product grid
  menu.innerHTML = normalized
    .map(
      (p) => `
        <figure class="menu-item" data-sku="${p.sku}">
          <img src="${p.image}" alt="${p.name}" />
          <figcaption>${p.name}</figcaption>
          <figcaption style="font-size:0.8em; color:#66caff;">${p.sku}</figcaption>
          <figcaption style="color:#bffcff;">
  ${p.discountPrice > 0 && p.discountPrice < p.retailPrice
    ? `<span style="text-decoration:line-through; opacity:0.6;">$${p.retailPrice.toFixed(2)}</span>
       <span style="color:#00c6ff; font-weight:700;"> $${p.discountPrice.toFixed(2)}</span>`
    : `$${p.retailPrice.toFixed(2)}`}
</figcaption>

        </figure>`
    )
    .join("");

  // 🔹 Click → populate form safely
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.addEventListener("click", () => {
      const sku = item.dataset.sku;
      const product = normalized.find((p) => p.sku === sku);
      if (!product) return;

      const fields = [
  ["sku", product.sku],
  ["title", product.name],
  ["image", product.image],
  ["price", product.retailPrice.toFixed(2)],
  ["sale-price", product.discountPrice.toFixed(2)], // ← new
  ["unit-cost", product.cost.toFixed(2)],
  ["in-stock", product.stock],
  ["materials", product.materials],
  ["vendor", product.vendor],
  ["description", product.description],
  ["keywords", product.keywords],
  ["status", product.status],
];


      fields.forEach(([id, val]) => {
  const el = document.getElementById(id);
  if (el) el.value = val ?? "";
  else console.warn(`⚠️ Missing field: #${id}`);
});

// 🔹 Add this line here:
updateProfit(); // ✅ recalc profit margin after populating fields

document.querySelector(".inventory-panel").classList.remove("hidden");
saveBtn.classList.add("hidden");
updateBtn.classList.remove("hidden");

document.querySelector("header").scrollIntoView({
  behavior: "smooth",
  block: "start",
});

currentProduct = product;
console.log(`📦 Loaded product: ${product.name}`);

    });
  });
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
  const retail = parseFloat(price.value) || 0;
  const discount = parseFloat(document.getElementById("sale-price")?.value || 0);
  const p = discount > 0 && discount < retail ? discount : retail;
  const margin = p - c;
  profit.value = formatToCurrency(margin);
}

  [cost, price, document.getElementById("sale-price")].forEach((el) => {
    el.addEventListener("input", updateProfit);
    el.addEventListener("blur", () => {
      el.value = formatToCurrency(el.value);
      updateProfit();
    });
  });

  // ===========================================================
  // 🌿 CLEAR FORM — Reset everything
  // ===========================================================
  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    form.reset();
    document.querySelector(".inventory-panel").classList.add("hidden");
    updateBtn.classList.add("hidden");
    saveBtn.classList.remove("hidden");
    currentProduct = null;
    console.log("🌿 Form cleared");
  });
  
  // ===========================================================
// 💾 SAVE OR UPDATE PRODUCT — Write to Sheet
// ===========================================================
async function saveProduct(isUpdate = false) {
  const payload = {
    mode: isUpdate ? "update" : "add",
    Sku: document.getElementById("sku")?.value.trim(),
    "Stable Sku": document.getElementById("stable-sku")?.value.trim(),
    "Product Title": document.getElementById("title")?.value.trim(),
    "Image Link": document.getElementById("image")?.value.trim(),
    Status: document.getElementById("status")?.value,
    Vendor: document.getElementById("vendor")?.value.trim(),
    Description: document.getElementById("description")?.value.trim(),
    Keywords: document.getElementById("keywords")?.value.trim(),
    Materials: document.getElementById("materials")?.value.trim(),
    "Retail Price": parseFloat(document.getElementById("price")?.value || 0),
    "Sale Price": parseFloat(document.getElementById("sale-price")?.value || 0),
    "Unit Price": parseFloat(document.getElementById("unit-cost")?.value || 0),
    "Profit Margin": parseFloat(document.getElementById("profit-margin")?.value || 0),
    "Units in Set": parseFloat(document.getElementById("units-in-set")?.value || 1),
    Shipping: parseFloat(document.getElementById("shipping")?.value || 0),
    "In Stock": parseFloat(document.getElementById("in-stock")?.value || 0),
    Received: parseFloat(document.getElementById("received")?.value || 0),
    Running: parseFloat(document.getElementById("running")?.value || 0),
    Damaged: parseFloat(document.getElementById("damaged")?.value || 0),
  };

  console.log("📤 Saving product:", payload);

  try {
    const res = await fetch(SHEET_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    console.log("✅ Save response:", result);
    alert(result.message || "Product saved successfully!");
  } catch (err) {
    console.error("❌ Save failed:", err);
    alert("Failed to save. Please try again.");
  }
}
saveBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  await saveProduct(false); // create new
});

updateBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  await saveProduct(true); // update existing
});

function showToast(message = "Inventory updated!") {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.bottom = "24px";
  toast.style.right = "24px";
  toast.style.padding = "12px 20px";
  toast.style.background = "rgba(0,198,255,0.15)";
  toast.style.border = "1px solid #00c6ff";
  toast.style.borderRadius = "10px";
  toast.style.color = "#bffcff";
  toast.style.fontFamily = "'Audiowide', sans-serif";
  toast.style.fontSize = "14px";
  toast.style.boxShadow = "0 0 12px rgba(0,198,255,0.5)";
  toast.style.zIndex = "9999";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.3s ease-in-out";
  document.body.appendChild(toast);
  requestAnimationFrame(() => (toast.style.opacity = "1"));
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, 2500);
}

  // ===========================================================
  // 🌿 INIT
  // ===========================================================
  await loadProductCatalog();
});
