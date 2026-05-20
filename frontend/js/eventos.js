const API_URL = '/api';  
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) window.location.href = 'index.html';

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
});

// ===== ELEMENTOS =====
const nombreInput = document.getElementById('nombreEvento');
const fechaInput = document.getElementById('fechaEvento');
const horaInput = document.getElementById('horaEvento');
const descripcionInput = document.getElementById('descripcionEvento');
const eventoIdInput = document.getElementById('eventoId');
const guardarBtn = document.getElementById('guardarBtn');
const cancelarBtn = document.getElementById('cancelarBtn');
const formLabel = document.getElementById('formLabel');
const eventList = document.getElementById('eventList');
const toggleReporteBtn = document.getElementById('toggleReporteBtn');

const esAdmin = loggedUser?.rol === 'admin';
let modoReporte = false;

// Ocultar formulario si no es admin
if (!esAdmin) {
    document.querySelector('.eventForm')?.closest('.dashboardCard')?.style.setProperty('display', 'none');
    formLabel?.style.setProperty('display', 'none');
    // Cambiar texto de sección si no es admin
    const sectionLabel = document.querySelector('.section-label:last-of-type');
    if (sectionLabel) sectionLabel.textContent = 'Eventos del club';
}

// ===== CARGAR EVENTOS =====
async function cargarEventos() {
    try {
        const res = await fetch(`${API_URL}/eventos`);
        const eventos = await res.json();

        if (!eventos || !eventos.length) {
            eventList.innerHTML = `
                <div class="emptyState">
                    <p>No hay eventos registrados.</p>
                    <p style="font-size:12px; margin-top:8px; opacity:.6;">
                        ${esAdmin ? 'Crea el primero usando el formulario de arriba.' : 'Próximamente habrá eventos disponibles.'}
                    </p>
                </div>`;
            return;
        }

        if (modoReporte) {
            eventList.innerHTML = `
                <div class="dashboardCard">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr><th style="padding:12px 16px; text-align:left;">#</th>
                                <th style="padding:12px 16px; text-align:left;">Nombre</th>
                                <th style="padding:12px 16px; text-align:left;">Fecha</th>
                                <th style="padding:12px 16px; text-align:left;">Hora</th>
                                <th style="padding:12px 16px; text-align:left;">Descripción</th>
                                <th style="padding:12px 16px; text-align:left;">Creador</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${eventos.map((e, i) => `
                                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                                    <td style="padding:12px 16px; color:rgba(255,255,255,0.35);">${i + 1}</td>
                                    <td style="padding:12px 16px; color:white; font-weight:600;">${escapeHtml(e.nombre)}</td>
                                    <td style="padding:12px 16px; color:#54cfe0;">${formatearFecha(e.fecha_evento)}</td>
                                    <td style="padding:12px 16px; color:rgba(255,255,255,0.6);">${e.hora || '—'}</td>
                                    <td style="padding:12px 16px; color:rgba(255,255,255,0.6);">${escapeHtml(e.descripcion) || '—'}</td>
                                    <td style="padding:12px 16px; color:rgba(255,255,255,0.4);">${e.creador || '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;
        } else {
            eventList.innerHTML = `
                <div class="eventListGrid">
                    ${eventos.map(e => `
                        <div class="eventItem">
                            <h3>${escapeHtml(e.nombre)}</h3>
                            <p class="eventMeta">
                                📅 ${e.fecha_evento || 'Sin fecha'}
                                ${e.hora ? ' · ⏰ ' + e.hora.substring(0, 5) : ''}
                            </p>
                            <p class="eventText">${escapeHtml(e.descripcion) || 'Sin descripción.'}</p>
                            ${esAdmin ? `
                            <div class="eventActions">
                                <button class="secondaryBtn" onclick='editarEvento(
                                    ${e.id_evento},
                                    "${escapar(e.nombre)}",
                                    "${e.fecha_evento}",
                                    "${e.hora || ''}",
                                    "${escapar(e.descripcion)}"
                                )'>Editar</button>
                                <button class="dangerBtn" onclick="eliminarEvento(${e.id_evento})">Eliminar</button>
                            </div>` : ''}
                        </div>
                    `).join('')}
                </div>`;
        }
    } catch (err) {
        console.error('Error cargando eventos:', err);
        eventList.innerHTML = '<div class="emptyState">Error cargando eventos.</div>';
    }
}

// ===== GUARDAR (solo admin) =====
guardarBtn?.addEventListener('click', async () => {
    if (!esAdmin) return;

    const nombre = nombreInput.value.trim();
    const fecha = fechaInput.value;
    const hora = horaInput.value;
    const descripcion = descripcionInput.value.trim();
    const id = eventoIdInput.value;

    if (!nombre || !fecha) {
        alert('El nombre y la fecha son obligatorios.');
        return;
    }

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/eventos/${id}` : `${API_URL}/eventos`;
    const body = id
        ? { nombre, fecha_evento: fecha, hora, descripcion }
        : { nombre, fecha_evento: fecha, hora, descripcion, creado_por: loggedUser.id };

    try {
        guardarBtn.disabled = true;
        guardarBtn.textContent = 'Guardando...';

        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error('Error al guardar');

        limpiarFormulario();
        await cargarEventos();
        alert('Evento guardado correctamente');
    } catch (err) {
        console.error('Error guardando evento:', err);
        alert('Ocurrió un error al guardar el evento.');
    } finally {
        guardarBtn.disabled = false;
        guardarBtn.textContent = 'Guardar evento';
    }
});

// ===== EDITAR (solo admin) =====
function editarEvento(id, nombre, fecha, hora, descripcion) {
    if (!esAdmin) return;

    eventoIdInput.value = id;
    nombreInput.value = nombre;
    fechaInput.value = fecha.split('T')[0];
    horaInput.value = hora || '';
    descripcionInput.value = descripcion || '';

    formLabel.textContent = 'Editando evento';
    guardarBtn.textContent = 'Actualizar evento';
    cancelarBtn.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== CANCELAR EDICIÓN =====
cancelarBtn?.addEventListener('click', limpiarFormulario);

function limpiarFormulario() {
    eventoIdInput.value = '';
    nombreInput.value = '';
    fechaInput.value = '';
    horaInput.value = '';
    descripcionInput.value = '';

    formLabel.textContent = 'Nuevo evento';
    guardarBtn.textContent = 'Guardar evento';
    cancelarBtn.style.display = 'none';
}

// ===== ELIMINAR (solo admin) =====
async function eliminarEvento(id) {
    if (!esAdmin) return;
    if (!confirm('¿Seguro que quieres eliminar este evento?')) return;

    try {
        const res = await fetch(`${API_URL}/eventos/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al eliminar');
        await cargarEventos();
        alert('Evento eliminado correctamente');
    } catch (err) {
        console.error('Error eliminando evento:', err);
        alert('Ocurrió un error al eliminar el evento.');
    }
}

// ===== TOGGLE REPORTE =====
toggleReporteBtn?.addEventListener('click', () => {
    modoReporte = !modoReporte;
    toggleReporteBtn.textContent = modoReporte ? 'Ver gestión' : 'Ver reporte';
    cargarEventos();
});

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

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapar(str) {
    return escapeHtml(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ===== INIT =====
cargarEventos();