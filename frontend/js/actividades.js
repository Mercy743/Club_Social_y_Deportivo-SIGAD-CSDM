// ===============================
// CONFIGURACIÓN GLOBAL
// ===============================
const STORAGE_KEY = "actividades_club";
const STORAGE_ID = "actividad_id";
const STORAGE_ROL = "rol_usuario"; // "admin" o "instructor"

// ===============================
// UTILIDADES
// ===============================
function getActividades() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveActividades(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function generarId() {
  let id = Number(localStorage.getItem(STORAGE_ID)) || 1;
  localStorage.setItem(STORAGE_ID, id + 1);
  return id;
}

function getRol() {
  return localStorage.getItem(STORAGE_ROL) || "admin";
}

function setRol(rol) {
  localStorage.setItem(STORAGE_ROL, rol);
}

// ===============================
// TOAST
// ===============================
function mostrarToast(msg, tipo = "ok") {
  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.innerText = msg;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ===============================
// DURACIÓN PERSONALIZADA
// ===============================
function toggleCustomTime() {
  const select = document.getElementById("duracion")?.value;
  const input = document.getElementById("duracionCustom");

  if (!input) return;

  input.style.display = (select === "custom") ? "inline-block" : "none";
}

// ===============================
// RENDER PRINCIPAL
// ===============================
function renderActividades(filtro = "") {
  const contenedor = document.getElementById("contenedorActividades");
  if (!contenedor) return;

  const actividades = getActividades();
  contenedor.innerHTML = "";

  actividades
    .filter(a => a.nombre.toLowerCase().includes(filtro.toLowerCase()))
    .forEach(act => {

      const porcentaje = (act.inscritos / act.capacidad) * 100;

      let color = "verde";
      if (porcentaje >= 100) color = "rojo";
      else if (porcentaje >= 70) color = "naranja";

      const botonesAdmin = getRol() === "admin" ? `
        <button onclick="editar(${act.id})">Editar</button>
        <button onclick="eliminar(${act.id})">Eliminar</button>
      ` : "";

      contenedor.innerHTML += `
        <div class="card">
          <h2>${act.icono || ""} ${act.nombre}</h2>

          <p>${act.inscritos}/${act.capacidad}</p>

          <div class="barra">
            <div class="progreso ${color}" style="width:${porcentaje}%"></div>
          </div>

          <p>${act.horario || "Sin horario"}</p>
          <p>${act.instructor || "Sin instructor"}</p>

          ${botonesAdmin}
          <button onclick="verDetalle(${act.id})">Detalles</button>
        </div>
      `;
    });
}

// ===============================
// CREAR / EDITAR
// ===============================
function cargarFormulario() {
  const form = document.getElementById("formActividad");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (id) {
    const actividad = getActividades().find(a => a.id == id);
    if (actividad) {
      document.getElementById("tituloForm").innerText = "Editar Actividad";

      document.getElementById("nombre").value = actividad.nombre;
      document.getElementById("descripcion").value = actividad.descripcion;
      document.getElementById("capacidad").value = actividad.capacidad;
      document.getElementById("icono").value = actividad.icono;
      document.getElementById("nivel").value = actividad.nivel;
      document.getElementById("duracion").value = actividad.duracion;
      document.getElementById("equipo").checked = actividad.equipo;
    }
  }

  form.addEventListener("submit", function(e) {
    e.preventDefault();

    // 🔹 VALIDAR DESCRIPCIÓN
    const descripcion = document.getElementById("descripcion").value;

    if (descripcion.length < 20) {
      mostrarToast("Mínimo 20 caracteres en la descripción", "error");
      return;
    }

    if (descripcion.length > 300) {
      mostrarToast("Máximo 300 caracteres en la descripción", "error");
      return;
    }

    // 🔹 DURACIÓN (NORMAL + CUSTOM)
    let duracion = document.getElementById("duracion").value;

    if (duracion === "custom") {
      const custom = document.getElementById("duracionCustom").value;

      if (!custom || custom <= 0) {
        mostrarToast("Ingresa una duración válida", "error");
        return;
      }

      duracion = custom + " min";
    }

    const data = {
      nombre: document.getElementById("nombre").value,
      descripcion: descripcion,
      capacidad: Number(document.getElementById("capacidad").value),
      icono: document.getElementById("icono").value,
      nivel: document.getElementById("nivel").value,
      duracion: duracion,
      equipo: document.getElementById("equipo").checked,
      inscritos: 0,
      instructor: "Por asignar",
      horario: "Por definir",
      participantes: []
    };

    let actividades = getActividades();

    if (id) {
      actividades = actividades.map(a => {
        if (a.id == id) {
          return { ...a, ...data, inscritos: a.inscritos };
        }
        return a;
      });

      mostrarToast("Actividad actualizada");
    } else {
      data.id = generarId();
      actividades.push(data);
      mostrarToast("Actividad creada exitosamente");
    }

    saveActividades(actividades);

    setTimeout(() => {
      window.location.href = "actividades.html";
    }, 800);
  });
}

// ===============================
// ELIMINAR
// ===============================
function eliminar(id) {
  const actividades = getActividades();
  const actividad = actividades.find(a => a.id === id);

  if (!actividad) return;

  if (actividad.inscritos > 0) {
    mostrarToast("No se puede eliminar porque hay inscritos", "error");
    return;
  }

  if (!confirm("¿Estás seguro de eliminar esta actividad?")) return;

  const nuevas = actividades.filter(a => a.id !== id);
  saveActividades(nuevas);

  mostrarToast("Actividad eliminada");
  renderActividades();
}

// ===============================
// NAVEGACIÓN
// ===============================
function editar(id) {
  window.location.href = `actividades-form.html?id=${id}`;
}

function verDetalle(id) {
  window.location.href = `actividades-detalle.html?id=${id}`;
}

// ===============================
// DETALLE
// ===============================
function cargarDetalle() {
  const contenedor = document.getElementById("detalleActividad");
  if (!contenedor) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const actividad = getActividades().find(a => a.id == id);

  if (!actividad) {
    contenedor.innerHTML = "<p>No encontrada</p>";
    return;
  }

  contenedor.innerHTML = `
    <h1>${actividad.icono} ${actividad.nombre}</h1>
    <p>${actividad.descripcion}</p>

    <p><strong>Capacidad:</strong> ${actividad.inscritos}/${actividad.capacidad}</p>
    <p><strong>Nivel:</strong> ${actividad.nivel}</p>
    <p><strong>Duración:</strong> ${actividad.duracion}</p>

    <h3>Participantes</h3>
    <ul>
      ${actividad.participantes.length === 0 
        ? "<li>Sin participantes</li>"
        : actividad.participantes.map(p => `<li>${p.nombre} - ${p.email}</li>`).join("")
      }
    </ul>

    <h3>Horarios</h3>
    <p>${actividad.horario}</p>
    <p>${actividad.instructor}</p>
  `;
}

// ===============================
// BÚSQUEDA
// ===============================
function activarBusqueda() {
  const input = document.getElementById("busqueda");
  if (!input) return;

  input.addEventListener("input", () => {
    renderActividades(input.value);
  });
}

// ===============================
// BOTÓN CREAR
// ===============================
function activarBotonCrear() {
  const btn = document.getElementById("btnCrear");
  if (!btn) return;

  if (getRol() !== "admin") {
    btn.style.display = "none";
    return;
  }

  btn.addEventListener("click", () => {
    window.location.href = "actividades-form.html";
  });
}

// ===============================
// INICIALIZACIÓN
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  renderActividades();
  activarBusqueda();
  activarBotonCrear();
  cargarFormulario();
  cargarDetalle();
});