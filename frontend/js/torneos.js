const API = "http://localhost:3000/api/torneos";

// =============================
// LISTAR TORNEOS
// =============================
async function cargarTorneos() {
  const contenedor = document.getElementById("contenedorTorneos");
  if (!contenedor) return;

  const res = await fetch(API);
  const data = await res.json();

  contenedor.innerHTML = "";

  data.forEach(t => {
    contenedor.innerHTML += `
      <div class="card">
        <h2>${t.nombre}</h2>
        <p>${t.descripcion || ""}</p>
        <p>Estado: ${t.estado}</p>
        <button onclick="verDetalle(${t.id})">Ver</button>
        <button onclick="editar(${t.id})">Editar</button>
        <button onclick="eliminar(${t.id})">Eliminar</button>
      </div>
    `;
  });
}

// =============================
// CREAR / EDITAR
// =============================
async function guardarTorneo(e) {
  e.preventDefault();

  const id = new URLSearchParams(window.location.search).get("id");

  const data = {
    nombre: document.getElementById("nombre").value,
    descripcion: document.getElementById("descripcion").value,
    fecha_inicio: document.getElementById("fecha_inicio").value,
    fecha_fin: document.getElementById("fecha_fin").value,
    actividad_id: document.getElementById("actividad_id").value
  };

  const url = id ? `${API}/${id}` : API;
  const method = id ? "PUT" : "POST";

  await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  window.location.href = "torneos.html";
}

// =============================
// ELIMINAR
// =============================
async function eliminar(id) {
  if (!confirm("¿Eliminar torneo?")) return;

  await fetch(`${API}/${id}`, { method: "DELETE" });
  cargarTorneos();
}

// =============================
// DETALLE
// =============================
async function cargarDetalle() {
  const contenedor = document.getElementById("detalle");
  if (!contenedor) return;

  const id = new URLSearchParams(window.location.search).get("id");

  const res = await fetch(`${API}/${id}`);
  const t = await res.json();

  contenedor.innerHTML = `
    <h1>${t.nombre}</h1>
    <p>${t.descripcion}</p>
    <p>Estado: ${t.estado}</p>
  `;
}

// =============================
// NAVEGACIÓN
// =============================
function editar(id) {
  window.location.href = `torneos-form.html?id=${id}`;
}

function verDetalle(id) {
  window.location.href = `torneos-detalle.html?id=${id}`;
}

// =============================
// INIT
// =============================
document.addEventListener("DOMContentLoaded", () => {
  cargarTorneos();
  cargarDetalle();

  const form = document.getElementById("formTorneo");
  if (form) form.addEventListener("submit", guardarTorneo);

  const btn = document.getElementById("btnCrear");
  if (btn) {
    btn.onclick = () => {
      window.location.href = "torneos-form.html";
    };
  }
});