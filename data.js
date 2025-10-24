// ===========================================================
// 🌿 Kinaya Rising — Business Dashboard Logic (2025)
// ===========================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("🌿 Dashboard loaded");

  // 🔗 Replace these URLs with your real Sheet CSV links
  const SOURCES = {
  sales: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSomething/pub?gid=30403628&single=true&output=csv",
  customers: "",
  products: "",
  accounting: ""
};

  // 🧩 CSV Loader
  async function fetchCsv(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return text
        .trim()
        .split(/\r?\n/)
        .map(line => line.split(",").map(c => c.replace(/^"|"$/g, "")));
    } catch (err) {
      console.error("❌ CSV fetch error:", err);
      return [];
    }
  }

  // 💾 Export to CSV
  async function exportCsv(section) {
    const url = SOURCES[section];
    if (!url) return alert(`⚠️ Missing URL for ${section}`);
    const rows = await fetchCsv(url);
    if (!rows.length) return alert(`⚠️ No ${section} data found.`);

    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Kinaya_${section}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // 📄 Export to PDF
  async function exportPdf(section) {
    const url = SOURCES[section];
    const rows = await fetchCsv(url);
    if (!rows.length) return alert(`⚠️ No ${section} data found.`);

    if (typeof window.jspdf === "undefined") {
      await import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(`Kinaya Rising — ${section.toUpperCase()} Report`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);

    let y = 36;
    rows.slice(0, 20).forEach(r => {
      doc.text(r.slice(0, 5).join(" | "), 14, y);
      y += 6;
      if (y > 280) { doc.addPage(); y = 20; }
    });

    doc.save(`Kinaya_${section}_Report_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  // ✨ Auto-add Export Buttons per Section
  document.querySelectorAll(".panel").forEach(panel => {
    const title = panel.querySelector("h2").textContent.split(" ")[0].toLowerCase();
    const controls = document.createElement("div");
    controls.className = "export-controls";
    controls.innerHTML = `
      <button class="glow-button export-btn" data-section="${title}" data-format="csv">
        <i class="fa-solid fa-file-csv"></i> CSV
      </button>
      <button class="glow-button export-btn" data-section="${title}" data-format="pdf">
        <i class="fa-solid fa-file-pdf"></i> PDF
      </button>
    `;
    panel.insertBefore(controls, panel.querySelector("canvas"));
  });

  // ⚙️ Button Behavior
  document.body.addEventListener("click", async e => {
    const btn = e.target.closest(".export-btn");
    if (!btn) return;
    const section = btn.dataset.section;
    const format = btn.dataset.format;
    if (format === "csv") await exportCsv(section);
    else if (format === "pdf") await exportPdf(section);
  });

  console.log("✅ Dashboard export handlers ready");
});
