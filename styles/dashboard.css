// ===========================================================
// 🌿 KINAYA RISING — UNIFIED BUSINESS DASHBOARD (2025 FINAL)
// ===========================================================
// Purpose: Fetches data from your Google Apps Script backend,
// aggregates metrics, renders charts, and updates your HTML dashboard.
// ===========================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("🌿 Kinaya Dashboard initializing...");

  // ===========================================================
  // 🔗 CONFIGURATION
  // ===========================================================
  const API_URL =
    "https://script.google.com/macros/s/AKfycbw3lgHk_DldA6zdUYsek6FTO64qtSEnE86nOdW5xNxWZbhiDHAvS53jtk6zuuf5tjJOkw/exec"; // 🔹 Replace if redeployed

  // Dashboard control elements
  const startInput = document.getElementById("start-date");
  const endInput = document.getElementById("end-date");
  const refreshBtn = document.getElementById("refresh-btn");
  const compareToggle = document.getElementById("compare-toggle");

  // ===========================================================
  // 🧩 HELPER FUNCTIONS
  // ===========================================================

  // 🔹 Assign text content to an element by ID (safe)
  function assign(id, val) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = val;
  } else {
    console.warn(`⚠️ Missing element for ID: ${id}`);
  }
}

  // 🔹 Temporary on-screen message
  function showToast(msg) {
    const toast = document.createElement("div");
    toast.textContent = msg;
    toast.style.cssText = `
      position:fixed;bottom:3rem;left:50%;transform:translateX(-50%);
      background:rgba(0,198,255,0.15);border:1px solid #00c6ff;
      color:#bffcff;font-family:'Audiowide',sans-serif;
      padding:0.6rem 1.4rem;border-radius:10px;
      box-shadow:0 0 15px rgba(0,198,255,0.3);
      z-index:9999;opacity:1;transition:opacity 0.6s ease;`;
    document.body.appendChild(toast);
    setTimeout(() => (toast.style.opacity = 0), 1500);
    setTimeout(() => toast.remove(), 2100);
  }

  // ===========================================================
  // 📡 API FETCHERS
  // ===========================================================

  // 🔹 Core: Load dashboard JSON from backend
  async function fetchDashboardData(start, end) {
    try {
      const res = await fetch(
        `${API_URL}?mode=dashboard&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "No data returned");
      return data;
    } catch (err) {
      console.error("❌ Dashboard fetch failed:", err);
      return null;
    }
  }

// ===========================================================
// 📦 INVENTORY BAR CHART — Retail vs Unit Price (Labeled)
// ===========================================================
async function drawInventoryMetrics() {
  try {
    const res = await fetch(`${API_URL}?mode=pos`);
    const json = await res.json();
    const products = json.data || [];
    if (!Array.isArray(products) || products.length === 0) return;

    // --- Summary metrics ---
    const totalUnits = products.reduce(
      (s, p) => s + (parseFloat(p["In Stock"]) || 0),
      0
    );

    const totalValue = products.reduce((s, p) => {
      const stock = parseFloat(p["In Stock"]) || 0;
      const unit = parseFloat(p["Unit Price"]) || 0;
      return s + stock * unit;
    }, 0);

    const avgCost = totalUnits ? totalValue / totalUnits : 0;
    const lowStock = products.filter(
      (p) => (parseFloat(p["In Stock"]) || 0) <= 5
    ).length;

    // --- Assign summary numbers to dashboard cards ---
    assign("inv-total-units", totalUnits);
    assign("inv-stock-value", `$${totalValue.toFixed(2)}`);
    assign("inv-avg-cost", `$${avgCost.toFixed(2)}`);
    assign("inv-low-stock", lowStock);

    // ===========================================================
    // 🌿 SELL-THROUGH RATE (NEW)
    // ===========================================================
    // Attempt to calculate using available product fields
    const unitsReceived = products.reduce(
      (sum, p) => sum + (parseFloat(p["Received"]) || 0),
      0
    );
    const unitsSold = products.reduce(
      (sum, p) => sum + (parseFloat(p["Units Sold"]) || 0),
      0
    );

    const sellThroughRate =
      unitsReceived > 0
        ? ((unitsSold / unitsReceived) * 100).toFixed(1) + "%"
        : "0%";

    assign("sell-through-rate", sellThroughRate);

    console.log(
      `📊 Sell-Through Rate: ${sellThroughRate} (${unitsSold} sold / ${unitsReceived} received)`
    );

    // ===========================================================
    // 🎨 CHART RENDERING — Retail vs Unit Price
    // ===========================================================
    const ctx = document.getElementById("inventory-bar-chart");
    if (!ctx) return;

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: products.map((p) => p["Product Title"] || p["Sku"]),
        datasets: [
          {
            label: "Retail Value (In Stock × Retail Price)",
            data: products.map(
              (p) =>
                (parseFloat(p["In Stock"]) || 0) *
                (parseFloat(p["Retail Price"]) || 0)
            ),
            backgroundColor: "rgba(0,198,255,0.6)",
          },
          {
            label: "Unit Value (In Stock × Unit Price)",
            data: products.map(
              (p) =>
                (parseFloat(p["In Stock"]) || 0) *
                (parseFloat(p["Unit Price"]) || 0)
            ),
            backgroundColor: "rgba(255,180,80,0.6)",
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            labels: { color: "#A7E1EE", font: { family: "Audiowide" } },
          },
          tooltip: {
            callbacks: {
              title: (context) => context[0].label,
              label: (context) => {
                const p = products[context.dataIndex];
                const stock = parseFloat(p["In Stock"]) || 0;
                const retail = parseFloat(p["Retail Price"]) || 0;
                const unit = parseFloat(p["Unit Price"]) || 0;
                return [
                  `In Stock: ${stock}`,
                  `Retail Price: $${retail.toFixed(2)}`,
                  `Unit Price: $${unit.toFixed(2)}`,
                  `Retail Value: $${(stock * retail).toFixed(2)}`,
                  `Unit Value: $${(stock * unit).toFixed(2)}`,
                ];
              },
            },
          },
          datalabels: {
            color: "#A7E1EE",
            anchor: "end",
            align: "end",
            font: { family: "Audiowide", size: 9 },
            formatter: (value, ctx) => {
              const p = products[ctx.dataIndex];
              const retail = parseFloat(p["Retail Price"]) || 0;
              const unit = parseFloat(p["Unit Price"]) || 0;
              return `Retail: $${retail.toFixed(2)}\nUnit: $${unit.toFixed(2)}`;
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: "#A7E1EE",
              autoSkip: false,
              maxRotation: 60,
              minRotation: 45,
              font: { size: 10 },
            },
          },
          y: { beginAtZero: true, ticks: { color: "#A7E1EE" } },
        },
      },
      plugins: [ChartDataLabels],
    });
  } catch (err) {
    console.error("❌ Inventory metrics failed:", err);
  }
}


// ===========================================================
// 🧾 RENDER INVENTORY SUMMARY CARDS (for mobile + desktop)
// ===========================================================
function renderInventorySummary(products) {
  const container = document.getElementById("inventory-summary");
  if (!container) return;

  container.innerHTML = products
    .map(p => {
      const title = p["Product Title"] || p["Sku"];
      const stock = parseFloat(p["In Stock"]) || 0;
      const unit = parseFloat(p["Unit Price"]) || 0;
      const retail = parseFloat(p["Retail Price"]) || 0;
      const costValue = stock * unit;
      const retailValue = stock * retail;
      return `
        <div class="inventory-card">
          <strong>${title}</strong><br>
          <small>In Stock: ${stock}</small><br>
          <small>Cost Value: $${costValue.toFixed(2)}</small><br>
          <small>Retail Value: $${retailValue.toFixed(2)}</small>
        </div>
      `;
    })
    .join("");
}


// ===========================================================
// 📦 INVENTORY BAR CHART — Direct read from POS
// Shows current stock vs low stock thresholds
// ===========================================================
async function drawInventoryMetrics() {
  try {
    const res = await fetch(`${API_URL}?mode=pos`);
    const json = await res.json();
    const products = json.data || [];
    if (!Array.isArray(products) || products.length === 0) return;

    // ---------- SUMMARY METRICS ----------
    const totalUnits = products.reduce((s, p) => s + (parseFloat(p["In Stock"]) || 0), 0);
    const totalValue = products.reduce((s, p) => {
      const stock = parseFloat(p["In Stock"]) || 0;
      const cost =
        parseFloat(p[" Bulk Cost ($) "]) ||
        parseFloat(p["Unit Price"]) ||
        parseFloat(p[" Retail Price "]) ||
        0;
      return s + stock * cost;
    }, 0);
    const avgCost = totalUnits ? totalValue / totalUnits : 0;
    const lowStock = products.filter((p) => (parseFloat(p["In Stock"]) || 0) <= 5).length;

    assign("inv-total-units", totalUnits);
    assign("inv-stock-value", `$${totalValue.toFixed(2)}`);
    assign("inv-avg-cost", `$${avgCost.toFixed(2)}`);
    assign("inv-low-stock", lowStock);

    // ---------- VISUALIZATION ----------
    const ctx = document.getElementById("inventory-bar-chart");
    if (!ctx) return;

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: products.map((p) => p["Product Title"] || p["Sku"]),
        datasets: [
          {
            data: products.map((p) => parseFloat(p["In Stock"]) || 0),
            backgroundColor: products.map((p) =>
              (parseFloat(p["In Stock"]) || 0) <= 5
                ? "rgba(255,80,80,0.7)" // alert color for low stock
                : "rgba(0,198,255,0.6)" // calm cyan for healthy stock
            ),
            borderRadius: 4,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: {
              color: "#A7E1EE",
              autoSkip: false,
              maxRotation: 60,
              minRotation: 45,
              font: { size: 9 },
            },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#A7E1EE" },
            grid: { color: "rgba(0,198,255,0.05)" },
          },
        },
      },
    });
  } catch (err) {
    console.error("❌ Inventory metrics failed:", err);
  }
}

// ===========================================================
// 🧮 PRODUCT ANALYTICS SNAPSHOT — Top/Low Stock + Avg Margin
// ===========================================================
async function drawProductAnalytics() {
  try {
    const res = await fetch(`${API_URL}?mode=productAnalytics`);
    const json = await res.json();
    const info = json.data || {};

    assign("top-products", (info.topSelling || []).join(", ") || "–");
    assign("low-stock-products", (info.lowStock || []).join(", ") || "–");
    assign("profit-margin", info.avgMargin ? `${info.avgMargin.toFixed(1)}%` : "–");
    assign("total-skus", info.totalSkus || "–");
  } catch (err) {
    console.error("❌ Product Analytics failed:", err);
  }
}

// ===========================================================
// 💹 METRIC ASSIGNER — Feeds live numbers to UI boxes
// Maps backend metrics to dashboard panels
// ===========================================================
function updateMetrics(m = {}) {
  // --- Structured sections for clarity ---
  const inv  = m.inventoryOverview || {};
  const log  = inv.logSummary       || {};
  const rec  = m.reconciliation     || {};
  const cust = m.customerInsights   || {};

  // ===========================================================
  // 🧾 SALES & PRODUCT PERFORMANCE
  // ===========================================================
  assign("total-revenue", `$${(m.totalRevenue || 0).toFixed(2)}`);
  assign("gross-profit", `$${(m.grossProfit || 0).toFixed(2)}`);
  assign("net-profit", `$${(m.netProfit || 0).toFixed(2)}`);
  assign("account-net-profit", `$${(m.netProfit || 0).toFixed(2)}`);
  assign("avg-transaction", `$${(m.avgTransactionValue || 0).toFixed(2)}`);
  assign("units-sold", m.unitsSold || 0);
  assign("tax-collected", `$${(m.taxCollected || 0).toFixed(2)}`);
  assign("expenses", `$${(m.totalExpenses || 0).toFixed(2)}`);
  assign("profit-margin", `${(m.profitMargin || 0).toFixed(1)}%`);

  // ===========================================================
  // 🧭 CUSTOMER INSIGHTS & BEHAVIOR
  // ===========================================================
  assign("num-transactions", m.totalTransactions || 0);             // total completed sales
  assign("unique-customers", cust.uniqueCustomers || 0);            // distinct buyers
  assign("repeat-customers", cust.repeatCustomers || 0);            // returning buyers
  assign("retention-rate", `${(cust.retentionRate || 0).toFixed(1)}%`);
  assign("refund-rate", `${(cust.refundCount || 0)} returns`);
  assign("emails-collected", cust.customerEmailsCollected || 0);
  assign("avg-items-sale", m.avgItemsPerSale || 0);
  assign("avg-frequency", `${(cust.purchaseFrequency || 0)}x / month`);
  assign("customer-ltv", `$${(cust.lifetimeValue || 0).toFixed(2)}`);

  // ===========================================================
  // 💌 SUBSCRIPTION RATE — Derived from sales log or customer data
  // ===========================================================
  try {
    const records = m.records || []; // fallback if your backend returns all sales
    let subscribedCount = 0;
    let totalEmails = 0;

    const uniqueEmails = new Set();
    const uniqueSubs = new Set();

    // Some backends store customer info inside m.customerInsights.customers or m.sales
    const allSales = m.sales || m.records || [];
    allSales.forEach(r => {
      const email = (r.Email || "").trim();
      const subscribe = (r.Subscribe || "").toLowerCase();
      if (email) {
        uniqueEmails.add(email);
        if (subscribe === "yes" || subscribe === "true") uniqueSubs.add(email);
      }
    });

    totalEmails = uniqueEmails.size;
    subscribedCount = uniqueSubs.size;

    const subscriptionRate = totalEmails > 0 ? (subscribedCount / totalEmails) * 100 : 0;
    assign("subscription-rate", `${subscriptionRate.toFixed(0)}%`);
  } catch (err) {
    console.warn("⚠️ Could not compute subscription rate:", err);
    assign("subscription-rate", "0%");
  }

  // ===========================================================
  // 📦 INVENTORY OVERVIEW
  // ===========================================================
  assign("inv-total-units", inv.totalUnitsInStock || 0);
  assign("inv-stock-value", `$${(inv.totalStockValue || 0).toFixed(2)}`);
  assign("inv-avg-cost", `$${(inv.avgCost || 0).toFixed(2)}`);
  assign("inv-low-stock", inv.lowStockItems || 0);

  // ===========================================================
  // 📊 INVENTORY LOG ACTIVITY
  // ===========================================================
  assign("log-received", log.received || 0);
  assign("log-damaged", log.damaged || 0);
  assign("log-manual-count", log["manual count"] || 0);

  // ===========================================================
  // 💰 FINANCIAL HEALTH
  // ===========================================================
  assign("tax-deductible", `${(m.taxDeductibleRatio || 0).toFixed(1)}%`);
  try {
  const allRecords = m.sales || m.records || [];
  const outstanding = allRecords.filter(r => {
    const paid = parseFloat(r.Paid || 0);
    const total = parseFloat(r.Total || 0);
    // invoice is outstanding if not fully paid and not a return
    return Math.abs(paid) < Math.abs(total) && total > 0;
  }).length;

  assign("outstanding-invoices", outstanding);
} catch (err) {
  console.warn("⚠️ Could not compute outstanding invoices:", err);
  assign("outstanding-invoices", m.outstandingInvoices || 0);
}

  assign("outstanding-invoices", m.outstandingInvoices || 0);
  assign("avg-expense-month", `$${(m.avgExpensePerMonth || 0).toFixed(2)}`);

  // ===========================================================
  // 🏷️ VENDOR & RECONCILIATION
  // ===========================================================
  assign("top-vendor", m.topVendor || "–");
  assign("mismatch-count", rec.mismatchCount || 0);

  // ===========================================================
  // 🧠 DEBUG MODE (optional)
  // Uncomment while testing to inspect returned metrics
  // ===========================================================
  console.table({
     totalRevenue: m.totalRevenue,
     uniqueCustomers: cust.uniqueCustomers,
     totalUnitsInStock: inv.totalUnitsInStock,
     topVendor: m.topVendor,
     stockMismatchCount: rec.mismatchCount
   });
}

// ===========================================================
// 📈 SALES TREND CHART (fix for undefined error)
// ===========================================================
function drawSalesTrend(records = []) {
  const ctx = document.getElementById("sales-trend");
  if (!ctx) return;
  if (window.salesTrendChart) {
    window.salesTrendChart.destroy();
  }

  const totals = {};
  records.forEach(r => {
    const d = new Date(r["Date"]);
    if (!isNaN(d)) {
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      totals[label] = (totals[label] || 0) + (parseFloat(r["Grand Total"]) || 0);
    }
  });

  const labels = Object.keys(totals);
  const values = Object.values(totals);

  if (!labels.length) return;

  const chartCtx = ctx.getContext("2d");
  window.salesTrendChart = new Chart(chartCtx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Revenue",
          data: values,
          borderColor: "#00c6ff",
          backgroundColor: "rgba(0,198,255,0.2)",
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#A7E1EE" } },
        y: { ticks: { color: "#A7E1EE" } }
      }
    }
  });
}

// ===========================================================
// 🚀 MAIN DASHBOARD LOADER — Pulls fresh data from backend
// ===========================================================
async function loadDashboard() {
  const start = startInput.value;
  const end = endInput.value;
  console.log(`📊 Loading dashboard data from ${start} to ${end}...`);

  const data = await fetchDashboardData(start, end);
  if (!data || !data.metrics) return;

  // ✅ Feed metrics as before
  updateMetrics(data.metrics);

  // ✅ Now compute Subscription Rate from full records
  computeSubscriptionRate(data.records || []);

  // ✅ Continue with charts
  drawSalesTrend(data.records);
  await drawInventoryMetrics();
  await drawProductAnalytics();


  showToast("📈 Dashboard refreshed");
}

// ===========================================================
// 💌 SUBSCRIPTION RATE CALCULATOR — Uses raw sales records
// ===========================================================
function computeSubscriptionRate(records = []) {
  if (!records.length) {
    assign("subscription-rate", "—");
    console.warn("⚠️ No sales records found for subscription rate.");
    return;
  }

  const uniqueEmails = new Set();
  const uniqueSubs = new Set();

  records.forEach(r => {
    const email = (r.Email || "").trim();
    const sub = (r.Subscribe || "").toLowerCase();
    if (email) {
      uniqueEmails.add(email);
      if (sub === "yes" || sub === "true") uniqueSubs.add(email);
    }
  });

  const total = uniqueEmails.size;
  const subs = uniqueSubs.size;
  const rate = total > 0 ? (subs / total) * 100 : 0;

  assign("subscription-rate", `${rate.toFixed(0)}%`);

  console.log(`💌 Subscription Rate: ${subs}/${total} (${rate.toFixed(0)}%)`);
}

  // ===========================================================
  // 🧭 EVENT LISTENERS
  // ===========================================================
  refreshBtn.addEventListener("click", loadDashboard);

  // 🔹 Compare Period Toggle — compares previous date range
  compareToggle.addEventListener("change", async () => {
    if (!compareToggle.checked) return;
    const start = new Date(startInput.value);
    const end = new Date(endInput.value);
    const days = (end - start) / (1000 * 60 * 60 * 24);
    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - days - 1);
    const prevEnd = new Date(end);
    prevEnd.setDate(end.getDate() - days - 1);

    const prevData = await fetchDashboardData(
      prevStart.toISOString().split("T")[0],
      prevEnd.toISOString().split("T")[0]
    );

    if (prevData?.metrics) {
      alert(`Previous Total Revenue: $${prevData.metrics.totalRevenue.toFixed(2)}`);
    }

    // ===========================================================
    // 🌿 EMAIL REPORT BUTTON HANDLERS
    // ===========================================================
    const API_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"; // <-- replace with your Apps Script web app URL

    async function triggerEmailReport(reportType, buttonEl) {
      try {
        buttonEl.disabled = true;
        const originalText = buttonEl.textContent;
        buttonEl.textContent = "⏳ Sending...";

        // Call backend via GET or POST (using ?mode=email&type=weekly for example)
        const res = await fetch(`${API_URL}?mode=sendReport&type=${encodeURIComponent(reportType)}`);
        const json = await res.json();

        if (json.success) {
          buttonEl.textContent = "✅ Sent!";
        } else {
          buttonEl.textContent = "⚠️ Error";
          console.error("Email error:", json.error || json.message);
        }

        setTimeout(() => {
          buttonEl.textContent = originalText;
          buttonEl.disabled = false;
        }, 2500);
      } catch (err) {
        console.error("❌ Report email failed:", err);
        buttonEl.textContent = "⚠️ Error";
        setTimeout(() => {
          buttonEl.textContent = originalText;
          buttonEl.disabled = false;
        }, 2500);
      }
    }

    // Attach event listeners
    document.addEventListener("DOMContentLoaded", () => {
      const salesBtn = document.getElementById("email-sales");
      const custBtn = document.getElementById("email-customers");
      const finBtn = document.getElementById("email-financial");
      const invBtn = document.getElementById("email-inventory");

      if (salesBtn) salesBtn.addEventListener("click", () => triggerEmailReport("weekly", salesBtn));
      if (custBtn) custBtn.addEventListener("click", () => triggerEmailReport("monthly", custBtn));
      if (finBtn) finBtn.addEventListener("click", () => triggerEmailReport("quarterly", finBtn));
      if (invBtn) invBtn.addEventListener("click", () => triggerEmailReport("yearly", invBtn));
    });

  });


  // ===========================================================
  // ✅ INITIALIZE DASHBOARD
  // ===========================================================
  loadDashboard();
  console.log("✅ Kinaya Dashboard live sync ready.");
});
