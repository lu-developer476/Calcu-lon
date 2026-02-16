const $ = (id) => document.getElementById(id);

const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = {
  standard: $("panel-expression"),
  scientific: $("panel-expression"),
  graph: $("panel-graph"),
  programmer: $("panel-programmer"),
  date: $("panel-date"),
};

let currentMode = "standard";

function setStatus(msg) {
  $("status").innerText = msg;
}

function setTitle(mode) {
  const titles = {
    standard: "Estándar",
    scientific: "Científica",
    graph: "Graficar",
    programmer: "Programador",
    date: "Cálculo de fecha",
  };
  $("title").innerText = titles[mode] ?? mode;
}

function showPanel(mode) {
  // hide all first
  $("panel-expression").classList.add("hidden");
  $("panel-graph").classList.add("hidden");
  $("panel-programmer").classList.add("hidden");
  $("panel-date").classList.add("hidden");

  if (mode === "standard" || mode === "scientific") {
    $("panel-expression").classList.remove("hidden");
  } else {
    panels[mode].classList.remove("hidden");
  }
}

tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentMode = btn.dataset.mode;
    setTitle(currentMode);
    showPanel(currentMode);
    setStatus("Listo.");
    clearOutputs();
  });
});

function clearOutputs() {
  $("result").innerText = "";
  $("pResult").innerText = "";
  $("dResult").innerText = "";
}

async function postJSON(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// Standard / Scientific
$("btn-calc").addEventListener("click", async () => {
  const expr = $("expression").value.trim();
  if (!expr) return setStatus("Escribí una expresión.");

  setStatus("Calculando...");
  try {
    const data = await postJSON("/api/calculate", {
      mode: currentMode,
      expression: expr,
    });
    if (data.error) {
      $("result").innerText = "❌ " + data.error;
      setStatus("Error.");
      return;
    }
    $("result").innerText = "✅ " + data.result;
    setStatus("OK.");
  } catch (e) {
    $("result").innerText = "❌ No se pudo conectar con la API.";
    setStatus("Error de red.");
  }
});

$("btn-clear").addEventListener("click", () => {
  $("expression").value = "";
  $("result").innerText = "";
  setStatus("Listo.");
});

// Graph
let chart = null;

function destroyChart() {
  if (chart) {
    chart.destroy();
    chart = null;
  }
}

$("btn-plot").addEventListener("click", async () => {
  const expr = $("graphExpression").value.trim();
  if (!expr) return setStatus("Escribí una función f(x).");

  const x_min = parseFloat($("xmin").value);
  const x_max = parseFloat($("xmax").value);
  const samples = parseInt($("samples").value, 10);

  setStatus("Generando gráfico...");
  try {
    const data = await postJSON("/api/graph", { expression: expr, x_min, x_max, samples });
    if (data.error) {
      setStatus("Error.");
      return;
    }

    const xs = data.x;
    const ys = data.y;

    destroyChart();
    const ctx = $("chart").getContext("2d");

    // Chart.js wants labels + data
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: xs,
        datasets: [
          {
            label: `f(x) = ${expr}`,
            data: ys,
            spanGaps: false,
            pointRadius: 0,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: { ticks: { maxTicksLimit: 10 } }
        }
      }
    });

    setStatus("OK.");
  } catch (e) {
    setStatus("Error de red.");
  }
});

$("btn-plot-clear").addEventListener("click", () => {
  $("graphExpression").value = "";
  destroyChart();
  setStatus("Listo.");
});

// Programmer
$("btn-to-base").addEventListener("click", async () => {
  const number = parseInt($("pNumber").value, 10);
  const base = parseInt($("pBase").value, 10);

  setStatus("Convirtiendo...");
  try {
    const data = await postJSON("/api/calculate", {
      mode: "programmer",
      op: "to_base",
      number,
      base
    });
    $("pResult").innerText = data.error ? "❌ " + data.error : "✅ " + data.result;
    setStatus(data.error ? "Error." : "OK.");
  } catch (e) {
    $("pResult").innerText = "❌ No se pudo conectar con la API.";
    setStatus("Error de red.");
  }
});

$("btn-bitwise").addEventListener("click", async () => {
  const number = parseInt($("pNumber").value, 10);
  const op = $("pOp").value;
  const other = parseInt($("pOther").value, 10);

  setStatus("Calculando...");
  const payload = { mode: "programmer", op, number };
  if (!Number.isNaN(other) && op !== "bit_not") payload.other = other;

  try {
    const data = await postJSON("/api/calculate", payload);
    $("pResult").innerText = data.error ? "❌ " + data.error : "✅ " + data.result;
    setStatus(data.error ? "Error." : "OK.");
  } catch (e) {
    $("pResult").innerText = "❌ No se pudo conectar con la API.";
    setStatus("Error de red.");
  }
});

$("btn-prog-clear").addEventListener("click", () => {
  $("pResult").innerText = "";
  setStatus("Listo.");
});

// Date
function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

$("d1").value = todayISO();
$("d2").value = todayISO();

$("btn-date").addEventListener("click", async () => {
  const date1 = $("d1").value;
  const date2 = $("d2").value;
  const days = parseInt($("days").value, 10);
  const date_op = $("dOp").value;

  setStatus("Calculando...");
  try {
    const data = await postJSON("/api/calculate", {
      mode: "date",
      date_op,
      date1,
      date2,
      days: Number.isNaN(days) ? null : days
    });
    $("dResult").innerText = data.error ? "❌ " + data.error : "✅ " + data.result;
    setStatus(data.error ? "Error." : "OK.");
  } catch (e) {
    $("dResult").innerText = "❌ No se pudo conectar con la API.";
    setStatus("Error de red.");
  }
});

$("btn-date-clear").addEventListener("click", () => {
  $("dResult").innerText = "";
  setStatus("Listo.");
});
