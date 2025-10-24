<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <title>Kinaya Rising POS — Inventory</title>

  <style>
    
/* ============================================================
   🌿 KINAYA RISING POS — INVENTORY PAGE (Unified Design 2025)
   ============================================================ */

/* ---------- BASE ---------- */
html, body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: radial-gradient(circle at top, #070c0f 0%, #000 90%);
  color: #A7E1EE;
  font-family: "Roboto", sans-serif;
  touch-action: manipulation;
  overscroll-behavior: contain;
}

/* ---------- HEADER (Unified) ---------- */
header {
      position: relative;
  text-align: center;
  padding: 1.2rem 0 1rem;
  background: linear-gradient(180deg, rgba(10,25,30,0.6), transparent);
  border-bottom: 1px solid rgba(167,225,238,0.15);
  box-shadow: 0 2px 10px rgba(0,0,0,0.4);text-align: center;
      font-family: "Audiowide", sans-serif;
      color: #bffcff;
      text-shadow: 0 0 18px rgba(0,198,255,0.9);
      font-size: 1.8rem;
      letter-spacing: 1px;
    }

header h1 {
  font-size: 1.8rem;
  color: #A7E1EE;
  margin: 0;
}

header p.subtitle {
  font-size: 0.95rem;
  color: rgba(167,225,238,0.7);
  margin-top: 0.3rem;
}

/* ---------- MAIN LAYOUT ---------- */
main {
  max-width: 1150px;
  margin: 0 auto;
  padding: 1rem 1.2rem 8rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}


/* ============================================================
   🌸 ADD INVENTORY FORM
   ============================================================ */
.add-inventory-container {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 0 25px rgba(167,225,238,0.12);
  backdrop-filter: blur(8px);
  transition: box-shadow 0.3s ease, transform 0.2s ease;
}
.add-inventory-container:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 35px rgba(167,225,238,0.35);
}

.add-inventory-container h2 {
  font-family: "Audiowide", sans-serif;
  color: #bfffcf;
  text-shadow: 0 0 10px rgba(191,216,193,0.3);
  margin-bottom: 1.5rem;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

/* ---------- FORM GRID ---------- */
.inventory-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.2rem 2rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-group label {
  font-size: 0.9rem;
  color: #A7E1EE;
  font-weight: 600;
  margin-left: 2px;
}
.field-group input,
.field-group textarea,
.field-group select {
  background: rgba(15, 25, 30, 0.8);
  border: 1px solid rgba(167,225,238,0.25);
  border-radius: 8px;
  padding: 10px 12px;
  color: #fff;
  font-size: 0.9rem;
  transition: 0.25s ease;
}
.field-group input:focus,
.field-group textarea:focus,
.field-group select:focus {
  border-color: #4fd1c5;
  box-shadow: 0 0 10px rgba(79,209,197,0.5);
  outline: none;
}
textarea {
  resize: vertical;
  min-height: 60px;
}
.full-width { grid-column: 1 / -1; }

/* ---------- FORM BUTTONS ---------- */
.card-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1.5rem;
}

#save-item-btn, .secondary-btn {
  border: none;
  border-radius: 8px;
  padding: 0.8rem 1.8rem;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.25s ease-in-out;
}

#save-item-btn {
  background: linear-gradient(90deg, #A7E1EE, #5FC7D9);
  color: #000;
  box-shadow: 0 0 15px rgba(167,225,238,0.3);
}
#save-item-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 25px rgba(167,225,238,0.5);
}
.secondary-btn {
  background: rgba(255,255,255,0.1);
  color: #A7E1EE;
}
.secondary-btn:hover {
  background: rgba(167,225,238,0.25);
}

/* ============================================================
   🌸 INVENTORY TABLE
   ============================================================ */
.inventory-table-wrapper {
  max-height: 65vh;
  overflow-y: auto;
  overflow-x: auto;
  border-radius: 12px;
  box-shadow: 0 0 15px rgba(167,225,238,0.08);
  background: rgba(255,255,255,0.02);
  -webkit-overflow-scrolling: touch;
}

table.inventory-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
}
th, td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  text-align: left;
  white-space: nowrap;
}
th {
  background: rgba(167,225,238,0.08);
  font-weight: 700;
  color: #A7E1EE;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  position: sticky;
  top: 0;
  z-index: 3;
  backdrop-filter: blur(5px);
}
th:first-child,
td:first-child {
  position: sticky;
  left: 0;
  background: rgba(10,15,20,0.95);
  backdrop-filter: blur(4px);
  z-index: 5;
}
td {
  font-size: 0.85rem;
  vertical-align: middle;
}
tr:nth-child(even) { background: rgba(255,255,255,0.02); }
tr:hover { background: rgba(167,225,238,0.05); }

/* ---------- IMAGES ---------- */
td img {
  width: 55px;
  height: 55px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 0 6px rgba(167,225,238,0.2);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
td img:hover {
  transform: scale(1.15);
  box-shadow: 0 0 10px rgba(167,225,238,0.5);
}

/* ---------- INPUT FIELDS ---------- */
.inv-input {
  width: 60px;
  text-align: center;
  background: #111;
  border: 1px solid rgba(255,255,255,0.2);
  color: #A7E1EE;
  border-radius: 6px;
  padding: 4px;
  font-size: 0.9rem;
}
.inv-input::-webkit-inner-spin-button,
.inv-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.inv-input { -moz-appearance: textfield; }

/* ---------- TOTAL SUMMARY ---------- */
.total-summary {
  text-align: center;
  font-size: 1rem;
  color: #A7E1EE;
  margin: 0.8rem auto 1rem;
  padding: 0.8rem 1rem;
  background: rgba(167,225,238,0.06);
  border-radius: 10px;
  box-shadow: 0 0 15px rgba(167,225,238,0.2);
  font-weight: 500;
  width: 95%;
  max-width: 800px;
  transition: all 0.3s ease;
}
.total-summary.hide {
  opacity: 0;
  transform: translateY(10px);
}

/* ---------- SAVE CHANGES BUTTON ---------- */
#save-inventory {
  background: linear-gradient(90deg, #A7E1EE, #5FC7D9);
  color: #000;
  border: none;
  border-radius: 10px;
  padding: 12px 36px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  display: block;
  margin: 1rem auto 2rem;
  box-shadow: 0 0 15px rgba(167,225,238,0.3);
  transition: all 0.25s ease;
}
#save-inventory:hover {
  transform: scale(1.05);
  box-shadow: 0 0 25px rgba(167,225,238,0.5);
}

/* ============================================================
   🌸 NAV BAR
   ============================================================ */
.kinaya-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: rgba(10,30,40,0.95);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(167,225,238,0.25);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0.6rem 0;
  z-index: 10000;
}
.nav-btn {
  color: #A7E1EE;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85rem;
  padding: 8px 14px;
  border-radius: 10px;
  transition: all 0.25s ease;
}
.nav-btn i {
  font-size: 1.4rem;
  transition: color 0.25s ease;
}
.nav-btn:hover {
  transform: scale(1.1);
  color: #bff4ff;
}
.nav-btn.active {
  color: #fff;
  background: radial-gradient(circle at center, rgba(167,225,238,0.2), rgba(10,30,40,0.9));
  box-shadow: 0 0 15px rgba(167,225,238,0.4);
  transform: scale(1.08);
}

/* ---------- RESPONSIVE ---------- */
@media (max-width: 768px) {
  header h1 { font-size: 1.4rem; }
  .inventory-fields { grid-template-columns: 1fr; }
  main { padding-bottom: 6.5rem; }
  #save-inventory { margin-bottom: 5.5rem; }
  th, td { font-size: 0.8rem; padding: 8px; }
  td img { width: 45px; height: 45px; }
}

/* ============================================================
   🌿 MOBILE RESPONSIVENESS FIX (Inventory Page)
   ============================================================ */
@media (max-width: 768px) {

  /* Make the form breathe properly */
  .add-inventory-container {
    padding: 1.2rem;
    border-radius: 12px;
  }

  /* Stack the form cleanly */
  .inventory-fields {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  /* Input & label adjustments */
  .field-group label {
    font-size: 0.85rem;
  }
  .field-group input,
  .field-group textarea,
  .field-group select {
    font-size: 0.9rem;
    padding: 8px 10px;
  }

  /* Buttons fit better on mobile */
  .card-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 0.8rem;
  }

  /* Table wrapper becomes horizontally scrollable but styled */
  .inventory-table-wrapper {
    overflow-x: auto;
    max-width: 100vw;
    border-radius: 10px;
    margin: 0 -1rem;
  }

  /* Table columns shrink better */
  table.inventory-table {
    min-width: 600px;
    font-size: 0.8rem;
  }

  th, td {
    padding: 6px 8px;
  }

  td img {
    width: 40px;
    height: 40px;
  }

  /* Shrink header and nav slightly */
  header {
    font-size: 1.4rem;
    padding: 1rem 0;
  }

  header h1 {
    font-size: 1.3rem;
    text-shadow: 0 0 10px rgba(167,225,238,0.7);
  }

  .nav-btn {
    font-size: 0.75rem;
  }
  .nav-btn i {
    font-size: 1.2rem;
  }

  /* Reduce bottom padding so nav doesn’t overlap */
  main {
    padding: 1rem 0.8rem 7rem;
  }

  #save-inventory {
    width: 90%;
    margin-bottom: 6rem;
    font-size: 0.9rem;
  }

  /* Totals summary fits smaller screens */
  .total-summary {
    font-size: 0.9rem;
    width: 90%;
    padding: 0.7rem;
  }
}

  </style>

  <link href="https://fonts.googleapis.com/css2?family=Audiowide&family=Roboto:wght@300;400;700&display=swap" rel="stylesheet"/>
</head>

<body>
  <header>
    <h1>Inventory Management</h1>
  </header>

  <main>
    <section class="add-inventory-wrapper">
      <div class="add-inventory-container">
        <h2><i class="fa-solid fa-box-open"></i> Add or Edit Inventory</h2>

        <form id="add-inventory-form" class="inventory-card">
  <div class="inventory-fields">
    <div class="field-group">
      <label>SKU</label>
      <input type="text" id="sku" placeholder="e.g. BKM-001" required>
    </div>

    <div class="field-group">
      <label>Product Title</label>
      <input type="text" id="title" placeholder="Product name" required>
    </div>

    <div class="field-group">
      <label>Image Link</label>
      <input type="url" id="image" placeholder="https://...">
    </div>

    <div class="field-group">
      <label>Unit Cost ($)</label>
      <input type="number" id="unit-cost" step="0.01" placeholder="0.00">
    </div>
    
    <div class="field-group">
      <label>Price ($)</label>
      <input type="number" id="price" step="0.01" placeholder="0.00">
    </div>

    <div class="field-group">
    <label>Profit Margin ($)</label>
    <input type="number" id="profit-margin" step="0.01" placeholder="0.00" readonly>
    </div>

    <div class="field-group">
      <label>Units in Set</label>
      <input type="number" id="units-in-set" placeholder="1">
    </div>

    <div class="field-group">
      <label>Status</label>
      <select id="status">
        <option value="active" selected>Active (show in POS)</option>
        <option value="inactive">Inactive (hide from POS)</option>
      </select>
    </div>

    <div class="field-group">
      <label>Materials</label>
      <input type="text" id="materials" placeholder="Paper, Resin, Metal...">
    </div>

    <div class="field-group full-width">
      <label>Description</label>
      <textarea id="description" rows="2" placeholder="Brief item details..."></textarea>
    </div>

    <div class="field-group full-width">
      <label>Keywords</label>
      <input type="text" id="keywords" placeholder="book, pin, limited edition">
    </div>

    <div class="field-group">
      <label>Vendor</label>
      <input type="text" id="vendor" placeholder="Vendor name">
    </div>
  </div>

  <div class="card-actions">
    <button type="submit" id="save-item-btn">
      <i class="fa-solid fa-floppy-disk"></i> Save
    </button>
    <button type="button" id="update-item-btn" class="secondary-btn hidden">
      <i class="fa-solid fa-pen"></i> Update
    </button>
    <button type="reset" id="clear-form-btn" class="secondary-btn">
      <i class="fa-solid fa-eraser"></i> Clear
    </button>
  </div>
</form>
      </div>
    </section>

    <section class="inventory-container">
      <div class="inventory-header">
        <h2>Current Stock Overview</h2>
        <p>Update received, damaged, and returned quantities below. Totals and net assets update automatically.</p>
      </div>

      <div class="inventory-table-wrapper">
        <table class="inventory-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>SKU</th>
              <th>Product</th>
              <th>Price</th>
              <th>Received</th>
              <th>Damaged</th>
              <th>Returned</th>
              <th>Sold</th>
              <th>In Stock</th>
              <th>Net Assets</th>
            </tr>
          </thead>
          <tbody id="inventory-body">
            <tr><td colspan="10" style="text-align:center;color:#A7E1EE;opacity:0.7;">Loading inventory...</td></tr>
          </tbody>
        </table>
        <div id="total-summary" class="total-summary"></div>
      </div>

      <button id="save-inventory" class="submit-sale-btn">💾 Save Changes</button>
    </section>
  </main>

  <!-- ====== NAVIGATION ====== -->
  <nav class="kinaya-nav">
    <a href="sale.html" class="nav-btn">
      <i class="fas fa-cash-register"></i><span>Sales</span>
    </a>
    <a href="inventory.html" class="nav-btn active">
      <i class="fas fa-boxes"></i><span>Inventory</span>
    </a>
    <a href="data.html" class="nav-btn">
      <i class="fas fa-chart-line"></i><span>Data</span>
    </a>
  </nav>

  <!-- ====== JS ====== -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/js/all.min.js" defer></script>
  <script>
  document.addEventListener("DOMContentLoaded", () => {
    const totalsBar = document.querySelector(".total-summary");
    let lastScrollY = window.scrollY;

    window.addEventListener("scroll", () => {
      if (!totalsBar) return;
      const currentY = window.scrollY;
      if (currentY > lastScrollY + 10) totalsBar.classList.add("hide");
      else if (currentY < lastScrollY - 10) totalsBar.classList.remove("hide");
      lastScrollY = currentY;
    });
  });
  </script>

  <script src="inventory.js" defer></script>
</body>
</html>
