// ===========================================================
// 🌿 KINAYA RISING — INVENTORY LOG CONTROLLER (2025)
// Tracks SKU adjustments: received, damaged, missing, manual count
// ===========================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🌿 Kinaya Inventory Log initializing...");

  const SHEET_API =
    "https://script.google.com/macros/s/AKfycbw3lgHk_DldA6zdUYsek6FTO64qtSEnE86nOdW5xNxWZbhiDHAvS53jtk6zuuf5tjJOkw/exec"; // 🔹 Replace if redeployed

  // ---------- Core Elements ----------
  const addBtn = document.getElementById("add-line-btn");
  const saveBtn = document.getElementById("submit-log-btn");
  const clearBtn = document.getElementById("clear-log-btn");
  const tableBody = document.querySelector("#inventory-log-table tbody");
  const form = document.getElementById("inventory-log-form");

  let productLookup = {};
  let cachedVendors = [];

  // ===========================================================
  // 🔹 LOAD ACTIVE SKUs (from POS)
  // ===========================================================
  async function loadActiveSKUs() {
    try {
      const res = await fetch(`${SHEET_API}?mode=pos`);
      const json = await res.json();
      const products = json.data || [];
      productLookup = {};

      const skuSelects = form.querySelectorAll(".sku");
      skuSelects.forEach(select => {
        select.innerHTML = `<option value="">Select SKU...</option>`;
        products
          .filter((p) => (p.Status || p.status || "").toLowerCase() === "active")
          .forEach((p) => {
            const sku = p.Sku || p.sku || "";
            const title = p["Product Title"] || p["product title"] || "";
            const opt = document.createElement("option");
            opt.value = sku;
            opt.textContent = `${sku} — ${title}`;
            select.appendChild(opt);
            productLookup[sku] = title;
          });
      });
    } catch (err) {
      console.error("❌ Failed to load SKUs:", err);
    }
  }

  // ===========================================================
  // 🔹 LOAD VENDORS
  // ===========================================================
  async function loadVendors() {
    try {
      const res = await fetch(`${SHEET_API}?mode=vendors`);
      const json = await res.json();
      cachedVendors = json.vendors || [];

      const vendorSelects = form.querySelectorAll(".vendor");
      vendorSelects.forEach(select => {
        select.innerHTML = `<option value="">Select Vendor...</option>`;
        cachedVendors.forEach((v) => {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = v;
          select.appendChild(opt);
        });
      });
    } catch (err) {
      console.error("❌ Failed to load vendors:", err);
    }
  }

  // ===========================================================
  // 🔁 AUTO-FILL PRODUCT TITLE WHEN SKU CHANGES
  // ===========================================================
  form.addEventListener("change", (e) => {
    if (e.target.classList.contains("sku")) {
      const sku = e.target.value;
      const group = e.target.closest(".item-group");
      const titleInput = group.querySelector(".product-title");
      titleInput.value = productLookup[sku] || "";
    }
  });

  // ===========================================================
  // ➕ ADD NEW ITEM ROW
  // ===========================================================
  addBtn.addEventListener("click", () => {
    const groups = form.querySelectorAll(".item-group");
    if (groups.length >= 10) {
      alert("⚠️ You can only add up to 10 items per batch.");
      return;
    }

    const clone = groups[groups.length - 1].cloneNode(true);
    clone.querySelectorAll("input, select").forEach(el => {
      if (el.tagName === "SELECT") el.selectedIndex = 0;
      else el.value = "";
    });

    form.insertBefore(clone, form.querySelector(".button-row"));

    // re-populate new dropdowns
    populateDropdowns(clone);
  });

  // ===========================================================
  // ➕ Return to View Inventory
  // ===========================================================

  document.getElementById("view-inventory-btn")?.addEventListener("click", () => {
  window.location.href = "./inventory.html"; // or adjust if your path differs
    });


  // ===========================================================
  // 🌿 POPULATE DROPDOWNS FOR CLONED ROW
  // ===========================================================
  function populateDropdowns(group) {
    const skuSelect = group.querySelector(".sku");
    const vendorSelect = group.querySelector(".vendor");

    skuSelect.innerHTML = `<option value="">Select SKU...</option>`;
    Object.entries(productLookup).forEach(([sku, title]) => {
      const opt = document.createElement("option");
      opt.value = sku;
      opt.textContent = `${sku} — ${title}`;
      skuSelect.appendChild(opt);
    });

    vendorSelect.innerHTML = `<option value="">Select Vendor...</option>`;
    cachedVendors.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      vendorSelect.appendChild(opt);
    });
  }

// ===========================================================
// 💾 SUBMIT INVENTORY LOG — CORS-SAFE + SUCCESS + CLEAR
// ===========================================================
async function submitInventoryLog() {
  const SHEET_API =
    "https://script.google.com/macros/s/AKfycbwvkAJbhcpmnSoggQfNRxmSWDFYa5mIV9NfVj6ldtRCDn5KHa3CfXZOR6xbKW84sOMD0Q/exec"; // 🔹 Replace if redeployed

  const groups = form.querySelectorAll(".item-group");
  const entries = [];

  groups.forEach((g) => {
    const sku = g.querySelector(".sku")?.value || "";
    const title = g.querySelector(".product-title")?.value || "";
    const type = g.querySelector(".type")?.value || "";
    const qty = parseFloat(g.querySelector(".quantity")?.value || "0");
    const vendor = g.querySelector(".vendor")?.value || "";
    const date = g.querySelector(".date")?.value || new Date().toLocaleDateString("en-CA");

    if (!sku || qty === 0 || !type) return;

    entries.push({
      Mode: "inventoryLog",
      Date: date,
      Sku: sku,
      "Product Title": title,
      Type: type,
      Quantity: qty,
      Vendor: vendor,
    });
  });

  if (!entries.length) {
    showToast?.("⚠️ Please fill out at least one valid line.", false);
    return;
  }

  console.log("🧾 Submitting inventory log:", entries);

  try {
    const res = await fetch(SHEET_API, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(entries),
    });

    const text = await res.text();
    const json = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    })();

    // --- ✅ Success or Fail Handling ---
    if (res.ok) {
      console.log("✅ Inventory log saved:", json);
      showToast?.("✅ Inventory Log updated successfully!");

      // --- 🧹 Clear form (single, complete reset) ---
      const groups = form.querySelectorAll(".item-group");
      groups.forEach((g, i) => {
        if (i > 0) g.remove(); // remove extra clones
        g.querySelectorAll("input, select").forEach((el) => {
          if (el.tagName === "SELECT") el.selectedIndex = 0;
          else el.value = "";
        });
      });

      // ✅ Visual feedback for reset
      showToast?.("🧹 Form cleared and ready for next entry!");
      
      // 🔄 Refresh overview
      if (typeof loadInventoryLog === "function") await loadInventoryLog();
    } else {
      console.error("❌ Save failed:", res.status, json);
      showToast?.(`⚠️ Save failed: ${json.error || res.statusText}`, false);
    }

  } catch (err) {
    console.error("❌ Network or CORS error:", err);
    showToast?.("❌ Network or CORS error saving inventory log.", false);
  }
}
// ===========================================================
// 💾 SAVE BUTTON HANDLER (spinner + disable)
// ===========================================================
saveBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  saveBtn.disabled = true;
  const originalHTML = saveBtn.innerHTML;
  saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

  try {
    await submitInventoryLog();
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = originalHTML;
  }
});


// ===========================================================
// 🧹 CLEAR FORM — Reset all item groups
// ===========================================================
clearBtn?.addEventListener("click", () => {
  form.querySelectorAll(".item-group").forEach((g, i) => {
    if (i > 0) g.remove();
    g.querySelectorAll("input, select").forEach((el) => {
      if (el.tagName === "SELECT") el.selectedIndex = 0;
      else el.value = "";
    });
  });
  showToast?.("🧹 Form cleared!");
});

  // ===========================================================
  // 📊 LOAD INVENTORY LOG OVERVIEW
  // ===========================================================
  async function loadInventoryLog() {
    try {
      const res = await fetch(`${SHEET_API}?mode=inventoryLog`);
      const json = await res.json();
      const data = json.data || [];
      if (!data.length) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;opacity:0.6;">No inventory records yet.</td></tr>`;
        return;
      }

      const sorted = [...data].sort((a, b) => new Date(b.Date) - new Date(a.Date));
      tableBody.innerHTML = sorted
        .slice(0, 50)
        .map(
          (r) => `
          <tr>
            <td>${r.Date || ""}</td>
            <td>${r.Sku || ""}</td>
            <td>${r["Product Title"] || ""}</td>
            <td>${r.Type || ""}</td>
            <td>${r.Quantity || ""}</td>
            <td>${r.Vendor || ""}</td>
          </tr>`
        )
        .join("");
    } catch (err) {
      console.error("❌ Failed to load inventory log:", err);
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ffbfbf;">Failed to load inventory data.</td></tr>`;
    }
  }
  // ===========================================================
// 🌟 UNIVERSAL TOAST MESSAGE HANDLER (Safe for all pages)
// ===========================================================
function showToast(message, success = true) {
  // remove any existing toasts first
  const existing = document.querySelector(".toast-message");
  if (existing) existing.remove();

  // create toast
  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = message;

  // style it
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "30px",
    left: "50%",
    transform: "translateX(-50%)",
    background: success
      ? "rgba(0, 255, 180, 0.15)"
      : "rgba(255, 100, 100, 0.15)",
    border: success
      ? "1px solid rgba(0, 255, 180, 0.5)"
      : "1px solid rgba(255, 100, 100, 0.5)",
    color: success ? "#00ffcc" : "#ff8080",
    padding: "0.75rem 1.25rem",
    borderRadius: "12px",
    fontSize: "1rem",
    fontFamily: "var(--font, 'Inter', sans-serif)",
    boxShadow: "0 0 15px rgba(0, 255, 200, 0.25)",
    zIndex: "9999",
    opacity: "0",
    transition: "opacity 0.3s ease",
  });

  document.body.appendChild(toast);
  setTimeout(() => (toast.style.opacity = "1"), 50);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// ===========================================================
  // 🔍 SEARCH + SORT
  // ===========================================================
  function setupSearchAndSort() {
    const table = document.getElementById("inventory-log-table");
    const searchInput = document.getElementById("inventory-log-search");
    const clearBtn = document.getElementById("clear-search");

    if (!table) return;

    // ----- SORT -----
    const headers = table.querySelectorAll("th");
    headers.forEach((header, index) => {
      header.addEventListener("click", () => {
        const tbody = table.querySelector("tbody");
        const rows = Array.from(tbody.querySelectorAll("tr"));
        const ascending = !header.classList.contains("asc");

        headers.forEach((h) => h.classList.remove("asc", "desc"));
        header.classList.add(ascending ? "asc" : "desc");

        rows.sort((a, b) => {
          const A = a.children[index].innerText.trim().toLowerCase();
          const B = b.children[index].innerText.trim().toLowerCase();
          if (!isNaN(parseFloat(A)) && !isNaN(parseFloat(B)))
            return ascending ? A - B : B - A;
          return ascending ? A.localeCompare(B) : B.localeCompare(A);
        });

        tbody.innerHTML = "";
        rows.forEach((r) => tbody.appendChild(r));
      });
    });

    // ----- SEARCH -----
    searchInput?.addEventListener("input", () => {
      const term = searchInput.value.toLowerCase();
      table.querySelectorAll("tbody tr").forEach((row) => {
        row.style.display = row.innerText.toLowerCase().includes(term)
          ? ""
          : "none";
      });
    });

    // ----- CLEAR SEARCH -----
    clearBtn?.addEventListener("click", () => {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
    });
  }

  // ===========================================================
  // 🚀 INITIALIZE
  // ===========================================================
  await Promise.all([loadActiveSKUs(), loadVendors()]);
  await loadInventoryLog();
});
