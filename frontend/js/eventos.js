document.addEventListener("DOMContentLoaded", async () => {

const res = await fetch("/api/eventos");
const eventos = await res.json();

contenedorEventos.innerHTML = "";

eventos.forEach(e => {
const div = document.createElement("div");

div.innerHTML = `
<h3>${e.nombre}</h3>
<p>${e.descripcion}</p>
`;

contenedorEventos.appendChild(div);
});

});
const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) window.location.href = 'index.html';

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
});

// ===== ELEMENTOS =====
const nombreInput      = document.getElementById('nombreEvento');
const fechaInput       = document.getElementById('fechaEvento');
const horaInput        = document.getElementById('horaEvento');
const descripcionInput = document.getElementById('descripcionEvento');
const eventoIdInput    = document.getElementById('eventoId');
const guardarBtn       = document.getElementById('guardarBtn');
const cancelarBtn      = document.getElementById('cancelarBtn');
const formLabel        = document.getElementById('formLabel');
const eventList        = document.getElementById('eventList');

// ===== CARGAR EVENTOS =====
async function cargarEventos() {
    try {
        const res     = await fetch(API_URL + '/eventos');
        const eventos = await res.json();

        if (!eventos.length) {
            eventList.innerHTML = `
                <div class="emptyState">
                    <p>No hay eventos registrados.</p>
                    <p style="font-size:12px; margin-top:8px; opacity:.6;">
                        Crea el primero usando el formulario de arriba.
                    </p>
                </div>`;
            return;
        }

        if (modoReporte) {
            // ===== VISTA REPORTE =====
            eventList.innerHTML = `
                <div class="dashboardCard">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr>
                                <th style="padding:12px 16px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.5); font-size:11px; letter-spacing:1px; text-transform:uppercase;">#</th>
                                <th style="padding:12px 16px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.5); font-size:11px; letter-spacing:1px; text-transform:uppercase;">Nombre</th>
                                <th style="padding:12px 16px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.5); font-size:11px; letter-spacing:1px; text-transform:uppercase;">Fecha</th>
                                <th style="padding:12px 16px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.5); font-size:11px; letter-spacing:1px; text-transform:uppercase;">Hora</th>
                                <th style="padding:12px 16px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.5); font-size:11px; letter-spacing:1px; text-transform:uppercase;">Descripción</th>
                                <th style="padding:12px 16px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.5); font-size:11px; letter-spacing:1px; text-transform:uppercase;">Creado por</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${eventos.map((e, i) => `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.04); transition:background .15s;">
                                    <td style="padding:12px 16px; color:rgba(255,255,255,0.35); font-size:13px;">${i + 1}</td>
                                    <td style="padding:12px 16px; color:white; font-weight:600; font-size:14px;">${e.nombre}</td>
                                    <td style="padding:12px 16px; color:#54cfe0; font-size:13px;">${formatearFecha(e.fecha_evento)}</td>
                                    <td style="padding:12px 16px; color:rgba(255,255,255,0.6); font-size:13px;">${e.hora || '—'}</td>
                                    <td style="padding:12px 16px; color:rgba(255,255,255,0.6); font-size:13px;">${e.descripcion || '—'}</td>
                                    <td style="padding:12px 16px; color:rgba(255,255,255,0.4); font-size:13px;">${e.creador || '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
        } else {
            // ===== VISTA GESTIÓN (cards) =====
            eventList.innerHTML = `
                <div class="eventListGrid">
                    ${eventos.map(e => `
                        <div class="eventItem">
                            <h3>${e.nombre}</h3>
                            <p class="eventMeta">
                                📅 ${formatearFecha(e.fecha_evento)}
                                ${e.hora ? ' · ⏰ ' + e.hora : ''}
                            </p>
                            <p class="eventText">${e.descripcion || 'Sin descripción.'}</p>
                            <div class="eventActions">
                                <button class="secondaryBtn" onclick="editarEvento(
                                    ${e.id_evento},
                                    '${escapar(e.nombre)}',
                                    '${e.fecha_evento}',
                                    '${e.hora || ''}',
                                    '${escapar(e.descripcion)}'
                                )">Editar</button>
                                <button class="dangerBtn" onclick="eliminarEvento(${e.id_evento})">
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>`;
        }

    } catch (err) {
        console.error('Error cargando eventos:', err);
        eventList.innerHTML = '<div class="emptyState">Error cargando eventos.</div>';
    }
}

// ===== GUARDAR (crear o editar) =====
guardarBtn.addEventListener('click', async () => {
    const nombre      = nombreInput.value.trim();
    const fecha       = fechaInput.value;
    const hora        = horaInput.value;
    const descripcion = descripcionInput.value.trim();
    const id          = eventoIdInput.value;

    if (!nombre || !fecha) {
        alert('El nombre y la fecha son obligatorios.');
        return;
    }

    const metodo = id ? 'PUT' : 'POST';
    const url    = id ? `${API_URL}/eventos/${id}` : `${API_URL}/eventos`;

    const body = id
        ? { nombre, fecha_evento: fecha, hora, descripcion }
        : { nombre, fecha_evento: fecha, hora, descripcion, creado_por: loggedUser.id };

    try {
        guardarBtn.disabled    = true;
        guardarBtn.textContent = 'Guardando...';

        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error('Error al guardar');

        limpiarFormulario();
        await cargarEventos();

    } catch (err) {
        console.error('Error guardando evento:', err);
        alert('Ocurrió un error al guardar el evento.');
    } finally {
        guardarBtn.disabled    = false;
        guardarBtn.textContent = 'Guardar evento';
    }
});

// ===== EDITAR =====
function editarEvento(id, nombre, fecha, hora, descripcion) {
    eventoIdInput.value    = id;
    nombreInput.value      = nombre;
    fechaInput.value       = fecha.split('T')[0];
    horaInput.value        = hora || '';
    descripcionInput.value = descripcion || '';

    formLabel.textContent     = 'Editando evento';
    guardarBtn.textContent    = 'Actualizar evento';
    cancelarBtn.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== CANCELAR EDICIÓN =====
cancelarBtn.addEventListener('click', limpiarFormulario);

function limpiarFormulario() {
    eventoIdInput.value    = '';
    nombreInput.value      = '';
    fechaInput.value       = '';
    horaInput.value        = '';
    descripcionInput.value = '';

    formLabel.textContent     = 'Nuevo evento';
    guardarBtn.textContent    = 'Guardar evento';
    cancelarBtn.style.display = 'none';
}

// ===== ELIMINAR =====
async function eliminarEvento(id) {
    if (!confirm('¿Seguro que quieres eliminar este evento?')) return;

    try {
        const res = await fetch(`${API_URL}/eventos/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al eliminar');
        await cargarEventos();
    } catch (err) {
        console.error('Error eliminando evento:', err);
        alert('Ocurrió un error al eliminar el evento.');
    }
}

// ===== HELPERS =====
function formatearFecha(fecha) {
    if (!fecha) return 'Sin fecha';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
}

function escapar(str) {
    return (str || '').replace(/'/g, "\\'");
}

// ===== TOGGLE REPORTE =====
let modoReporte = false;
const toggleReporteBtn = document.getElementById('toggleReporteBtn');

toggleReporteBtn.addEventListener('click', () => {
    modoReporte = !modoReporte;
    toggleReporteBtn.textContent = modoReporte ? 'Ver gestión' : 'Ver reporte';
    cargarEventos();
});

// ===== INIT =====
cargarEventos();
