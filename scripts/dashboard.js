// ===========================================================
// 🌿 Kinaya Rising — Unified Business Dashboard (2025 Final)
// ===========================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("🌿 Kinaya Dashboard initializing...");

  // ---------- CONFIG ----------
  const API_URL =
    "https://script.google.com/macros/s/AKfycbz83-usxoCG3YpHFACMTH9SA8CP2PLANhdFC92fbpm55qo3KSF30lb9ph3iOooQhQWX0A/exec"; // 🔹 Replace if redeployed

  // ---------- ELEMENTS ----------
  const startInput = document.getElementById("start-date");
  const endInput = document.getElementById("end-date");
  const refreshBtn = document.getElementById("refresh-btn");
  const compareToggle = document.getElementById("compare-toggle");

  // ===========================================================
  // 🧩 HELPER — Assign Values to DOM
  // ===========================================================
  function assign(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ===========================================================
  // 🧠 FETCH DASHBOARD DATA
  // ===========================================================
  async function fetchDashboardData(start, end) {
    try {
      const url = `${API_URL}?mode=dashboard&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "No data");
      return data;
    } catch (err) {
      console.error("❌ Dashboard fetch failed:", err);
      return null;
    }
  }

  // ===========================================================
  // 💾 UPDATE SALES METRICS
  // ===========================================================
  function updateMetrics(m) {
    assign("total-revenue", `$${m.totalRevenue.toFixed(2)}`);
    assign("gross-profit", `$${m.grossProfit.toFixed(2)}`);
    assign("avg-transaction", `$${m.avgTransactionValue.toFixed(2)}`);
    assign("units-sold", m.unitsSold.toString());
    assign("top-product", m.topProduct);
    assign("tax-collected", `$${m.taxCollected.toFixed(2)}`);
    assign("gross-revenue", `$${m.totalRevenue.toFixed(2)}`);

    const expenses = 1200; // Placeholder
    const netProfit = m.grossProfit - expenses;
    assign("net-profit", `$${netProfit.toFixed(2)}`);
    assign("account-net-profit", `$${netProfit.toFixed(2)}`);
    assign("expenses", `$${expenses.toFixed(2)}`);
  }

  // ===========================================================
  // 📈 SALES TREND CHART
  // ===========================================================
  function drawSalesTrend(records) {
    const ctx = document.getElementById("sales-trend");
    if (!ctx) return;

    const dailyTotals = {};
    records.forEach(r => {
      const d = new Date(r["Date"]);
      if (!isNaN(d)) {
        const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        dailyTotals[label] = (dailyTotals[label] || 0) + (parseFloat(r["Total"]) || 0);
      }
    });

    new Chart(ctx, {
      type: "line",
      data: {
        labels: Object.keys(dailyTotals),
        datasets: [{
          label: "Revenue",
          data: Object.values(dailyTotals),
          borderColor: "#00c6ff",
          fill: false,
          tension: 0.3,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#A7E1EE" } },
          y: { ticks: { color: "#A7E1EE" } },
        },
      },
    });
  }

  // ===========================================================
  // 📦 INVENTORY METRICS + CHART
  // ===========================================================
  async function drawInventoryMetrics() {
    try {
      const res = await fetch(`${API_URL}?mode=pos`);
      const products = await res.json();
      if (!Array.isArray(products)) return;

      const totalUnits = products.reduce((sum, p) => sum + (parseFloat(p["In Stock"]) || 0), 0);
      const totalValue = products.reduce((sum, p) => {
        const stock = parseFloat(p["In Stock"]) || 0;
        const cost = parseFloat(p["Unit Cost"]) || 0;
        return sum + stock * cost;
      }, 0);
      const avgCost = totalUnits ? totalValue / totalUnits : 0;
      const lowStockCount = products.filter(p => (parseFloat(p["In Stock"]) || 0) <= 5).length;
      const activeSkus = products.filter(p => (p.Status || "").toLowerCase() === "active").length;

      assign("inv-total-units", totalUnits.toString());
      assign("inv-stock-value", `$${totalValue.toFixed(2)}`);
      assign("inv-avg-cost", `$${avgCost.toFixed(2)}`);
      assign("inv-low-stock", lowStockCount.toString());
      assign("inv-active-skus", activeSkus.toString());

      const invCtx = document.getElementById("inventory-chart");
      if (invCtx) {
        const labels = products.map(p => p["Product Title"]);
        const stock = products.map(p => parseFloat(p["In Stock"]) || 0);

        new Chart(invCtx, {
          type: "bar",
          data: {
            labels,
            datasets: [{
              data: stock,
              backgroundColor: "#00c6ff",
              borderWidth: 0,
            }],
          },
          options: {
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: "#A7E1EE", autoSkip: true, maxRotation: 45, minRotation: 45 } },
              y: { ticks: { color: "#A7E1EE" } },
            },
          },
        });
      }
    } catch (err) {
      console.error("❌ Failed to load inventory data:", err);
    }
  }

  // ===========================================================
  // 🧩 PRODUCT ANALYTICS METRICS
  // ===========================================================
  async function drawProductAnalytics() {
    try {
      const res = await fetch(`${API_URL}?mode=productAnalytics`);
      const data = await res.json();
      if (!data) return;

      assign("top-products", (data.topSelling || []).join(", ") || "–");
      assign("low-stock-products", (data.lowStock || []).join(", ") || "–");
      assign("profit-margin", `${data.avgMargin.toFixed(1)}%`);
      assign("total-skus", data.totalSkus.toString());
    } catch (err) {
      console.error("❌ Product Analytics failed:", err);
    }
  }

  // ===========================================================
  // 🔄 LOAD DASHBOARD (ALL PANELS)
  // ===========================================================
  async function loadDashboard() {
    const start = startInput.value;
    const end = endInput.value;

    console.log(`📊 Loading dashboard data from ${start} to ${end}...`);
    const data = await fetchDashboardData(start, end);
    if (!data || !data.metrics) return;

    // ---------- SALES ----------
    updateMetrics(data.metrics);

    // ---------- CUSTOMER INSIGHTS ----------
    assign("num-transactions", data.metrics.totalTransactions || 0);
    assign("repeat-customers", `${(data.metrics.repeatCustomers || 0).toFixed(1)}%`);
    assign("avg-items-sale", data.metrics.avgItemsPerSale || 0);
    assign("emails-collected", data.metrics.customerEmailsCollected || 0);
    assign("refund-rate", `${(data.metrics.refundRate || 0).toFixed(1)}%`);

    // ---------- INVENTORY ----------
    if (data.metrics.inventoryOverview) {
      const inv = data.metrics.inventoryOverview;
      assign("inv-total-units", inv.totalUnitsInStock.toString());
      assign("inv-stock-value", `$${inv.totalStockValue.toFixed(2)}`);
      assign("inv-avg-cost", `$${inv.avgCost.toFixed(2)}`);
      assign("inv-low-stock", inv.lowStockItems.toString());
      assign("inv-active-skus", inv.activeSKUs.toString());
    }

    // ---------- CHARTS ----------
    drawSalesTrend(data.records);
    await drawInventoryMetrics();
    await drawProductAnalytics();
  }

  // ===========================================================
  // ⚙️ EVENTS
  // ===========================================================
  refreshBtn.addEventListener("click", loadDashboard);

  compareToggle.addEventListener("change", async () => {
    if (compareToggle.checked) {
      const start = new Date(startInput.value);
      const end = new Date(endInput.value);
      const rangeDays = (end - start) / (1000 * 60 * 60 * 24);
      const prevStart = new Date(start);
      const prevEnd = new Date(end);
      prevStart.setDate(start.getDate() - rangeDays - 1);
      prevEnd.setDate(end.getDate() - rangeDays - 1);

      console.log(`📊 Comparing ${prevStart.toISOString().split("T")[0]} to ${prevEnd.toISOString().split("T")[0]}`);
      const prevData = await fetchDashboardData(prevStart.toISOString().split("T")[0], prevEnd.toISOString().split("T")[0]);
      if (prevData && prevData.metrics) {
        alert(`Compare period loaded.\nPrevious Total Revenue: $${prevData.metrics.totalRevenue.toFixed(2)}`);
      }
    }
  });

  // ===========================================================
  // 🚀 INIT
  // ===========================================================
  loadDashboard();
  console.log("✅ Kinaya Dashboard live sync ready.");
});
