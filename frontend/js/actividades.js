const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

const rol = loggedUser.rol;
const usuarioId = loggedUser.id;

async function getActividades() {
    const res = await fetch(`${API_URL}/actividades`);
    return await res.json();
}

async function renderActividades(filtro = "") {
    const contenedor = document.getElementById("contenedorActividades");
    if (!contenedor) return;

    const actividades = await getActividades();
    contenedor.innerHTML = "";

    const filtradas = actividades.filter(a =>
        a.nombre.toLowerCase().includes(filtro.toLowerCase())
    );

    for (const act of filtradas) {
        const inscritos = act.inscritos || 0;
        const capacidad = act.capacidad || 1;
        const porcentaje = capacidad > 0 ? (inscritos / capacidad) * 100 : 0;
        let color = "verde";
        if (porcentaje >= 100) color = "rojo";
        else if (porcentaje >= 70) color = "naranja";

        let botones = "";
        if (rol === 'admin') {
            botones = `
                <div class="botones-admin">
                    <button class="btn-editar" onclick="editarActividad(${act.id})">Editar</button>
                    <button class="btn-eliminar" onclick="eliminarActividad(${act.id})">Eliminar</button>
                </div>
            `;
        }
        if (rol === 'instructor') {
            botones = `
                <div class="botones-instructor">
                    <button class="btn-asignarse" onclick="asignarseInstructor(${act.id})">Asignarme como instructor</button>
                </div>
            `;
        }

        contenedor.innerHTML += `
            <div class="card">
                <div style="text-align:center; font-size:3rem; margin-bottom:10px;">${act.icono || '🏃'}</div>
                <h2>${act.nombre}</h2>
                <p class="descripcion">${act.descripcion || "Sin descripción"}</p>
                <p><strong>Capacidad:</strong> ${inscritos}/${capacidad}</p>
                <div class="barra"><div class="progreso ${color}" style="width:${Math.min(porcentaje, 100)}%"></div></div>
                <p><strong>Nivel:</strong> ${act.nivel || "Principiante"}</p>
                <p><strong>Duración:</strong> ${act.duracion || "60 min"}</p>
                <p><strong>Equipo especial:</strong> ${act.equipo ? "Requerido" : "No requerido"}</p>
                <p><strong>Instructores:</strong> <span id="instructores-${act.id}">Cargando...</span></p>
                ${botones}
                <button class="btn-detalle" onclick="verDetalle(${act.id})">Ver detalles</button>
            </div>
        `;
        cargarInstructores(act.id);
    }
}

async function cargarInstructores(actividadId) {
    try {
        const res = await fetch(`${API_URL}/actividades/${actividadId}/instructores`);
        const instructores = await res.json();
        const span = document.getElementById(`instructores-${actividadId}`);
        if (span) {
            span.textContent = instructores.length === 0 ? "Sin asignar" : instructores.map(i => i.nombre).join(", ");
        }
    } catch (error) {
        console.error("Error cargando instructores:", error);
    }
}

async function asignarseInstructor(actividadId) {
    if (!confirm("¿Quieres asignarte como instructor de esta actividad?")) return;
    try {
        const res = await fetch(`${API_URL}/actividades/${actividadId}/asignar-instructor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instructor_id: usuarioId })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.mensaje);
            renderActividades(document.getElementById("busqueda")?.value || "");
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert("Error de conexión");
    }
}

function editarActividad(id) {
    window.location.href = `actividades-form.html?id=${id}`;
}

async function eliminarActividad(id) {
    if (!confirm("¿Estás seguro de eliminar esta actividad?")) return;
    try {
        const res = await fetch(`${API_URL}/actividades/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            alert("Actividad eliminada");
            renderActividades(document.getElementById("busqueda")?.value || "");
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert("Error de conexión");
    }
}

function verDetalle(id) {
    window.location.href = `actividades-detalle.html?id=${id}`;
}

function activarBusqueda() {
    const input = document.getElementById("busqueda");
    if (input) {
        input.addEventListener("input", () => renderActividades(input.value));
    }
}

function configurarBotonCrear() {
    const btnCrear = document.getElementById("btnCrear");
    if (!btnCrear) return;
    if (rol === 'admin') {
        btnCrear.style.display = "block";
        btnCrear.addEventListener("click", () => {
            window.location.href = "actividades-form.html";
        });
    } else {
        btnCrear.style.display = "none";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("contenedorActividades")) {
        renderActividades();
        activarBusqueda();
        configurarBotonCrear();
    }
});

// ─── FORMULARIO ──────────────────────────────────────────────────────────────

async function guardarActividad(event) {
    event.preventDefault();

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    const nombre      = document.getElementById('nombre').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const capacidad   = parseInt(document.getElementById('capacidad').value);
    const icono       = document.getElementById('icono').value;
    const nivel       = document.getElementById('nivel').value;
    const duracionRaw = document.getElementById('duracion').value.replace(' min', '').trim();
    const duracion    = duracionRaw + ' min';
    const equipo      = document.getElementById('equipo').checked;

    if (!nombre || !capacidad) {
        alert('Nombre y capacidad son obligatorios');
        return;
    }

    const data = { nombre, descripcion, capacidad, icono, nivel, duracion, equipo };

    try {
        const url    = id ? `${API_URL}/actividades/${id}` : `${API_URL}/actividades`;
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            alert(id ? 'Actividad actualizada' : 'Actividad creada');
            window.location.href = 'actividades.html';
        } else {
            const result = await res.json();
            alert('Error: ' + (result.error || 'No se pudo guardar'));
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

async function cargarDatosParaEditar() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) return;

    // Deshabilitar guardar mientras cargamos para evitar submit con valores por defecto
    const btnGuardar = document.querySelector('.btn-guardar');
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Cargando...';
    }

    try {
        const res = await fetch(`${API_URL}/actividades/${id}`);
        if (!res.ok) throw new Error('No se pudo obtener la actividad');

        const actividad = await res.json();

        document.getElementById('nombre').value      = actividad.nombre || '';
        document.getElementById('descripcion').value = actividad.descripcion || '';
        document.getElementById('capacidad').value   = actividad.capacidad || 10;

        // Icono con fallback
        let iconoValor = actividad.icono;
        if (!iconoValor || iconoValor === '*' || iconoValor === '✖') iconoValor = '🏃';
        const selectIcono = document.getElementById('icono');
        selectIcono.value = iconoValor;
        if (!selectIcono.value) selectIcono.value = '🏃';

        // Nivel
        document.getElementById('nivel').value = actividad.nivel || 'Principiante';

        // Duración con fallback
        const duracionValue = String(actividad.duracion || '60').replace(' min', '').trim();
        const selectDuracion = document.getElementById('duracion');
        selectDuracion.value = duracionValue;
        if (!selectDuracion.value) selectDuracion.value = '60';

        // Equipo
        document.getElementById('equipo').checked = actividad.equipo === true;

    } catch (error) {
        console.error(error);
        alert('Error al cargar los datos de la actividad');
    } finally {
        // Siempre rehabilitar el botón al terminar, haya error o no
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.textContent = 'Guardar';
        }
    }
}

async function inicializarFormulario() {
    const form = document.getElementById('formActividad');
    if (!form) return;

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const titulo = document.getElementById('tituloForm');

    if (id) {
        if (titulo) titulo.textContent = 'Editar Actividad';
        await cargarDatosParaEditar();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('formActividad')) {
        inicializarFormulario();
    }
});

// ─── DETALLE ─────────────────────────────────────────────────────────────────

async function cargarDetalle() {
    const contenedor = document.getElementById("detalleActividad");
    if (!contenedor) return;

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    if (!id) {
        contenedor.innerHTML = `<div style="text-align:center;padding:40px;"><p>No se especificó ninguna actividad</p></div>`;
        return;
    }

    try {
        const resAct = await fetch(`${API_URL}/actividades/${id}`);
        if (!resAct.ok) throw new Error();
        const a = await resAct.json();

        const resIns = await fetch(`${API_URL}/actividades/${id}/instructores`);
        const instructores = await resIns.json();

        const inscritos  = a.inscritos || 0;
        const capacidad  = a.capacidad || 1;
        const porcentaje = capacidad > 0 ? (inscritos / capacidad) * 100 : 0;
        let colorBarra = "verde";
        if (porcentaje >= 100) colorBarra = "rojo";
        else if (porcentaje >= 70) colorBarra = "naranja";

        const colorHex = colorBarra === 'verde' ? '#4CAF50' : colorBarra === 'naranja' ? '#FF9800' : '#f44336';

        contenedor.innerHTML = `
            <div style="text-align:center; padding:30px;">
                <div style="font-size:4rem;">${a.icono || '🏃'}</div>
                <h1>${a.nombre}</h1>
                <p>${a.descripcion || "Sin descripción"}</p>
                <p><strong>Capacidad:</strong> ${inscritos}/${capacidad}</p>
                <div style="background:rgba(255,255,255,0.08); border-radius:10px; height:8px; margin:10px 0;">
                    <div style="background:${colorHex}; width:${Math.min(porcentaje, 100)}%; height:8px; border-radius:10px;"></div>
                </div>
                <p><strong>Nivel:</strong> ${a.nivel || "Principiante"}</p>
                <p><strong>Duración:</strong> ${a.duracion || "60 min"}</p>
                <p><strong>Equipo especial:</strong> ${a.equipo ? "Requerido" : "No requerido"}</p>
                <p><strong>Instructores:</strong> ${instructores.length === 0 ? "Sin asignar" : instructores.map(i => i.nombre).join(", ")}</p>
                <button onclick="window.location.href='actividades.html'" style="margin-top:20px; padding:10px 20px;">← Volver</button>
            </div>
        `;
    } catch (error) {
        contenedor.innerHTML = `<div style="text-align:center;padding:40px;"><p>Error al cargar detalles</p></div>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("detalleActividad")) {
        cargarDetalle();
    }
});