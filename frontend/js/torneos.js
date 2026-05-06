const API = "http://localhost:3000/api/torneos";

// =============================
// HELPERS
// =============================
function escapeHTML(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, options);

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.error || "Error en la petición");
  }

  return data;
}

function getIdFromURL() {
  const id = new URLSearchParams(window.location.search).get("id");
  return id && !isNaN(id) ? id : null;
}


// =============================
// ACTIVIDADES
// =============================
async function cargarActividades() {
  const select = document.getElementById("actividad_id");
  if (!select) return;

  try {
    const data = await fetchJSON("http://localhost:3000/api/actividades");

    select.innerHTML = '<option value="">Selecciona una actividad</option>';

    data.forEach(a => {
      select.innerHTML += `
        <option value="${a.id}">
          ${escapeHTML(a.nombre)}
        </option>
      `;
    });

  } catch (error) {
    console.error(error);
  }
}


// =============================
// LISTAR TORNEOS
// =============================
async function cargarTorneos() {
  const contenedor = document.getElementById("contenedorTorneos");
  if (!contenedor) return;

  contenedor.innerHTML = "<p>Cargando...</p>";

  try {
    const data = await fetchJSON(API);

    if (!Array.isArray(data) || data.length === 0) {
      contenedor.innerHTML = "<p>No hay torneos</p>";
      return;
    }

    let html = "";

    data.forEach(t => {
      html += `
        <div class="card">
          <h2>${escapeHTML(t.nombre)}</h2>
          <p>${escapeHTML(t.descripcion || "")}</p>
          <p><strong>Estado:</strong> ${escapeHTML(t.estado)}</p>
          <p><strong>Organizador:</strong> ${escapeHTML(t.creador_nombre || "N/A")}</p>

          <button onclick="verDetalle(${t.id})">Ver</button>
          <button onclick="editar(${t.id})">Editar</button>
          <button onclick="eliminar(${t.id})">Eliminar</button>
        </div>
      `;
    });

    contenedor.innerHTML = html;

  } catch {
    contenedor.innerHTML = "<p>Error al cargar torneos</p>";
  }
}

// =============================
// CREAR / EDITAR
// =============================
async function guardarTorneo(e) {
  e.preventDefault();

  const id = getIdFromURL();

  const nombre = document.getElementById("nombre").value.trim();
  const descripcion = document.getElementById("descripcion").value.trim();
  const fechaInicio = document.getElementById("fecha_inicio").value;
  const fechaFin = document.getElementById("fecha_fin").value;
  const actividad_id = document.getElementById("actividad_id").value;

  if (!nombre || !fechaInicio || !fechaFin || !actividad_id) {
    alert("Datos incompletos");
    return;
  }

  if (new Date(fechaFin) < new Date(fechaInicio)) {
    alert("Fecha inválida");
    return;
  }

  const data = {
    nombre,
    descripcion,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    actividad_id: Number(actividad_id),

    // 🔥 ORGANIZADOR AUTOMÁTICO
    creado_por: Number(localStorage.getItem("usuario_id"))
  };

  const url = id ? `${API}/${id}` : API;
  const method = id ? "PUT" : "POST";

  try {
    await fetchJSON(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    alert("Guardado correctamente");
    window.location.href = "torneos.html";

  } catch (error) {
    alert(error.message);
  }
}


// =============================
// ELIMINAR
// =============================
async function eliminar(id) {
  if (!confirm("¿Eliminar torneo?")) return;

  try {
    await fetchJSON(`${API}/${id}`, { method: "DELETE" });
    cargarTorneos();
  } catch (error) {
    alert(error.message);
  }
}


// =============================
// DETALLE + PARTICIPANTES
// =============================
async function cargarDetalle() {
  const contenedor = document.getElementById("detalle");
  if (!contenedor) return;

  const id = getIdFromURL();
  if (!id) return;

  contenedor.innerHTML = "<p>Cargando...</p>";

  try {
    const t = await fetchJSON(`${API}/${id}`);
    let participantes = [];

    try {
      participantes = await fetchJSON(`${API}/${id}/participantes`);
    } catch {}

    // CORREGIDO
    const boton = (t.estado === "programado" || t.estado === "en curso")
      ? `<button id="btnParticipar" onclick="inscribirme(${id})">Participar</button>`
      : `<button disabled>Torneo cerrado</button>`;

    //  MEJORADO
    const lista = participantes.length
      ? participantes.map(p => `
        <li>
          ${p.usuario_id 
            ? "Usuario " + escapeHTML(String(p.usuario_id))
            : escapeHTML(p.nombre_invitado || "Invitado")}
          ${p.cuota_pagada ? ` - $${p.cuota_pagada}` : ""}
          ${p.resultado ? ` - Resultado: ${escapeHTML(p.resultado)}` : ""}
        </li>
      `).join("")
      : "<li>No hay participantes</li>";

    contenedor.innerHTML = `
      <h1>${escapeHTML(t.nombre)}</h1>
      <p>${escapeHTML(t.descripcion)}</p>
      <p><strong>Estado:</strong> ${escapeHTML(t.estado)}</p>

      ${boton}

      <h3>Participantes</h3>
      <ul>${lista}</ul>
    `;

  } catch {
    contenedor.innerHTML = "<p>Error al cargar detalle</p>";
  }
}


// =============================
// PARTICIPAR
// =============================
async function inscribirme(id) {
  const btn = document.getElementById("btnParticipar");
  if (btn) btn.disabled = true;

  try {
    await fetchJSON(`${API}/${id}/participantes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario_id: 1
      })
    });

    alert("Inscripción exitosa");
    cargarDetalle();

  } catch (error) {
    alert(error.message);
    if (btn) btn.disabled = false;
  }
}


// =============================
// NAV
// =============================
function editar(id) {
  window.location.href = `torneos-form.html?id=${id}`;
}

function verDetalle(id) {
  window.location.href = `torneos-detalle.html?id=${id}`;
}

function volver() {
  window.history.back();
}


// =============================
// INIT
// =============================
document.addEventListener("DOMContentLoaded", () => {

  cargarActividades();

  if (document.getElementById("contenedorTorneos")) {
    cargarTorneos();
  }

  if (document.getElementById("detalle")) {
    cargarDetalle();
  }

  const form = document.getElementById("formTorneo");
  if (form) {
    form.addEventListener("submit", guardarTorneo);
  }

  const btn = document.getElementById("btnCrear");
  if (btn) {
    btn.onclick = () => {
      window.location.href = "torneos-form.html";
    };
  }
});