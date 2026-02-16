const $ = (id) => document.getElementById(id);

const tabs = Array.from(document.querySelectorAll(".tab"));
const sidebar = document.querySelector(".sidebar");
const menuToggle = $("menuToggle");

const panels = {
  standard: $("panel-expression"),
  scientific: $("panel-expression"),
  graph: $("panel-graph"),
  programmer: $("panel-programmer"),
  date: $("panel-date"),
};

let currentMode = "standard";

/* ============================= */
/* UI Helpers */
/* ============================= */

function setStatus(msg) {
  $("status").innerText = msg;
}

function setTitle(mode) {
  const titles = {
    standard: "Estándar",
    scientific: "Científica",
    graph: "Gráfica",
    programmer: "Programador",
    date: "Cálculo de fechas",
  };
  $("title").innerText = titles[mode] ?? mode;
}

function showPanel(mode) {
  Object.values(panels).forEach(p => p?.classList.add("hidden"));

  if (mode === "standard" || mode === "scientific") {
    $("panel-expression").classList.remove("hidden");
  } else {
    panels[mode]?.classList.remove("hidden");
  }
}

function clearOutputs() {
  $("result").innerText = "";
  $("pResult").innerText = "";
  $("dResult").innerText = "";
}

/* ============================= */
/* Sidebar Mobile Behavior */
/* ============================= */

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}

// cerrar sidebar en mobile al hacer click fuera
document.addEventListener("click", (e) => {
  if (window.innerWidth < 1024 &&
      sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      e.target !== menuToggle) {
    sidebar.classList.remove("open");
  }
});

/* ============================= */
/* Tab Navigation */
/* ============================= */

tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    currentMode = btn.dataset.mode;
    setTitle(currentMode);
    showPanel(currentMode);
    clearOutputs();
    setStatus("Listo.");

    // cerrar sidebar en mobile después de seleccionar
    if (window.innerWidth < 1024) {
      sidebar.classList.remove("open");
    }
  });
});

/* ============================= */
/* API Helper */
/* ============================= */

async function postJSON(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("HTTP error");
  }

  return res.json();
}

/* ============================= */
/* Standard / Scientific */
/* ============================= */

$("btn-calc")?.addEventListener("click", calculateExpression);
$("btn-clear")?.addEventListener("click", () => {
  $("expression").value = "";
  $("result").innerText = "";
  setStatus("Listo.");
});

// Enter para calcular
$("expression")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    calculateExpression();
  }
});

async function calculateExpression() {
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
      return setStatus("Error.");
    }

    $("result").innerText = "✅ " + data.result;
    setStatus("OK.");

  } catch {
    $("result").innerText = "❌ No se pudo conectar con la API.";
    setStatus("Error de red.");
  }
}

/* ============================= */
/* Graph */
/* ============================= */

let chart = null;

function destroyChart() {
  if (chart) {
    chart.destroy();
    chart = null;
  }
}

$("btn-plot")?.addEventListener("click", async () => {
  const expr = $("graphExpression").value.trim();
  if (!expr) return setStatus("Escribí una función f(x).");

  const x_min = parseFloat($("xmin").value);
  const x_max = parseFloat($("xmax").value);
  const samples = parseInt($("samples").value, 10);

  setStatus("Generando gráfico...");

  try {
    const data = await postJSON("/api/graph", { expression: expr, x_min, x_max, samples });

    if (data.error) return setStatus("Error.");

    destroyChart();

    const ctx = $("chart").getContext("2d");

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.x,
        datasets: [{
          label: `f(x) = ${expr}`,
          data: data.y,
          spanGaps: false,
          pointRadius: 0,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { maxTicksLimit: 10 } }
        }
      }
    });

    setStatus("OK.");

  } catch {
    setStatus("Error de red.");
  }
});

$("btn-plot-clear")?.addEventListener("click", () => {
  $("graphExpression").value = "";
  destroyChart();
  setStatus("Listo.");
});

/* ============================= */
/* Programmer */
/* ============================= */

$("btn-to-base")?.addEventListener("click", async () => {
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

  } catch {
    $("pResult").innerText = "❌ No se pudo conectar con la API.";
    setStatus("Error de red.");
  }
});

$("btn-bitwise")?.addEventListener("click", async () => {
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

  } catch {
    $("pResult").innerText = "❌ No se pudo conectar con la API.";
    setStatus("Error de red.");
  }
});

$("btn-prog-clear")?.addEventListener("click", () => {
  $("pResult").innerText = "";
  setStatus("Listo.");
});

/* ============================= */
/* Date */
/* ============================= */

function todayISO() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

$("d1").value = todayISO();
$("d2").value = todayISO();

$("btn-date")?.addEventListener("click", async () => {
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

  } catch {
    $("dResult").innerText = "❌ No se pudo conectar con la API.";
    setStatus("Error de red.");
  }
});

$("btn-date-clear")?.addEventListener("click", () => {
  $("dResult").innerText = "";
  setStatus("Listo.");
});

const tipsList = [
"Multiplicar por 10 → agregar un cero.",
"Multiplicar por 5 → multiplicar por 10 y dividir por 2.",
"Dividir por 0 no está definido.",
"Todo número multiplicado por 0 da 0.",
"Todo número elevado a 0 (≠0) da 1.",
"El cuadrado de un número negativo es positivo.",
"(a + b)² = a² + 2ab + b².",
"(a − b)² = a² − 2ab + b².",
"(a + b)(a − b) = a² − b².",
"1% de un número = dividir por 100.",
"10% de un número = mover la coma un lugar.",
"Para calcular 15%, sumá 10% + 5%.",
"Si ax = b → x = b/a.",
"En una ecuación, lo que hacés de un lado, hacelo del otro.",
"Despejar es aislar la variable.",
"Un sistema puede tener 1, infinitas o ninguna solución.",
"Una función lineal tiene forma f(x)=mx+b.",
"Si m > 0 la recta crece.",
"Si m < 0 la recta decrece.",
"Una parábola abre hacia arriba si a > 0.",
"El vértice de ax²+bx+c está en -b/(2a).",
"log(a·b)=log(a)+log(b).",
"log(a/b)=log(a)-log(b).",
"ln(e)=1.",
"sin²(x)+cos²(x)=1.",
"Si A → B no implica que B → A.",
"La negación de (A ∧ B) es (¬A ∨ ¬B).",
"La negación de (A ∨ B) es (¬A ∧ ¬B).",
"Un contraejemplo invalida una afirmación general.",
"Correlación no implica causalidad.",
"0 es número par.",
"√(a²)=|a|.",
"Las fracciones son divisiones pendientes.",
"f(x)=x² es simétrica respecto del eje Y.",
"f(-x)=f(x) → función par.",
"f(-x)=-f(x) → función impar.",
"log(x) no está definido para x ≤ 0.",
"e^x nunca es negativo.",
"Multiplicar por 9 → multiplicar por 10 y restar el número.",
"25% es la cuarta parte.",
"50% es la mitad.",
"75% es 3/4.",
"Siempre estimá antes de validar un resultado.",
"Siempre simplificá antes de operar."
];

const tipsContainer = document.querySelector("#tipsContent ul");

if (tipsContainer) {
  tipsContainer.innerHTML = "";
  tipsList.forEach(tip => {
    const li = document.createElement("li");
    li.textContent = tip;
    tipsContainer.appendChild(li);
  });
}
