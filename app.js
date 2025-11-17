let lastTdsJson = null;
let lastMachineValues = null;

/* Detect material based on image filename */
function detectMaterialFromFilename(name) {
    name = name.toLowerCase();

    if (name.includes("gp5008")) return "pc_abs_gp5008";
    if (name.includes("m90")) return "duracon_m90_44";
    if (name.includes("700x01")) return "abs_700_x01";
    if (name.includes("panlite")) return "panlite_g3430";
    return null;
}

/* Auto-load JSON TDS */
async function loadTds(material) {
    const file = `tds-samples/${material}.json`;
    const res = await fetch(file);
    lastTdsJson = await res.json();
    document.getElementById("tdsPreview").textContent =
        JSON.stringify(lastTdsJson, null, 2);
}

/* When user uploads image */
document.getElementById("imageInput").addEventListener("change", async () => {
    const file = document.getElementById("imageInput").files[0];
    if (!file) return;

    const material = detectMaterialFromFilename(file.name);
    if (!material) {
        alert("Material can't be detected. Rename the image file properly.");
        return;
    }

    await loadTds(material);
    alert("Material detected: " + material);

    window._lastFile = file; // save for OCR step
});

/* OCR Step */
document.getElementById("ocrBtn").addEventListener("click", async () => {
    const file = window._lastFile;
    if (!file) return alert("Upload image first.");

    const result = await Tesseract.recognize(file, "eng");
    const text = result.data.text;

    document.getElementById("ocrPreview").textContent = text;

    lastMachineValues = extractMachineValues(text);
});

/* Extract numeric values from OCR text */
function extractMachineValues(text) {
    const values = {};
    const reg = /([A-Za-z0-9 \\/-]+):\s*([0-9.]+)/;

    text.split(/\r?\n/).forEach(line => {
        const m = line.match(reg);
        if (m) values[m[1].trim()] = parseFloat(m[2]);
    });

    return values;
}

/* Comparison Logic */
document.getElementById("compareBtn").addEventListener("click", () => {
    if (!lastTdsJson) return alert("Load TDS first.");
    if (!lastMachineValues) return alert("Run OCR first.");

    const rows = [];
    let fail = false;

    for (const [param, range] of Object.entries(lastTdsJson.parameters)) {
        const machine = lastMachineValues[param] ?? null;
        let status = "UNKNOWN";

        if (machine !== null) {
            if (machine < range.min) { status = "LOW"; fail = true; }
            else if (machine > range.max) { status = "HIGH"; fail = true; }
            else status = "OK";
        }

        rows.push({ param, machine, range, status });
    }

    renderResults(rows, fail);
});

/* Display Results */
function renderResults(rows, fail) {
    let html = `
        <table border='1' style='border-collapse: collapse; width:100%'>
            <tr style='background:#e5e7eb; font-weight:bold'>
                <th>Parameter</th>
                <th>Machine</th>
                <th>Range</th>
                <th>Status</th>
            </tr>
    `;

    rows.forEach(r => {
        let cls = "status-unknown";
        if (r.status === "OK") cls = "status-ok";
        if (r.status === "LOW") cls = "status-low";
        if (r.status === "HIGH") cls = "status-high";

        html += `
            <tr>
                <td>${r.param}</td>
                <td>${r.machine ?? "--"}</td>
                <td>${r.range.min} - ${r.range.max}</td>
                <td class="${cls}">${r.status}</td>
            </tr>`;
    });

    html += "</table>";

    document.getElementById("results").innerHTML = html;
    document.getElementById("finalResult").textContent =
        fail ? "❌ FAIL — Out of Range" : "✅ PASS — All OK";
}
