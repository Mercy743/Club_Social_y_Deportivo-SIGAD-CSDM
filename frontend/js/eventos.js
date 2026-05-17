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

let modoReporte = false;

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
                        Crea el primero usando el formulario de arriba.
                    </p>
                </div>`;
            return;
        }

        if (modoReporte) {
            eventList.innerHTML = `
                <div class="dashboardCard">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr><th style="padding:12px 16px; text-align:left;">Nombre</th>
                                <th style="padding:12px 16px; text-align:left;">Fecha</th>
                                <th style="padding:12px 16px; text-align:left;">Hora</th>
                                <th style="padding:12px 16px; text-align:left;">Descripción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${eventos.map(e => `
                                <tr>
                                    <td style="padding:12px 16px;">${escapeHtml(e.nombre)}</td>
                                    <td style="padding:12px 16px;">${e.fecha_evento || '—'}</td>
                                    <td style="padding:12px 16px;">${e.hora || '—'}</td>
                                    <td style="padding:12px 16px;">${escapeHtml(e.descripcion) || '—'}</td>
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
                            <div class="eventActions">
                                <button class="secondaryBtn" onclick='editarEvento(${JSON.stringify(e)})'>Editar</button>
                                <button class="dangerBtn" onclick="eliminarEvento(${e.id_evento})">Eliminar</button>
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

// ===== GUARDAR =====
if (guardarBtn) {
    guardarBtn.addEventListener('click', async () => {
        const nombre = nombreInput?.value.trim();
        const fecha = fechaInput?.value;
        const hora = horaInput?.value;
        const descripcion = descripcionInput?.value.trim();
        const id = eventoIdInput?.value;

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
}

// ===== EDITAR =====
window.editarEvento = function(evento) {
    if (eventoIdInput) eventoIdInput.value = evento.id_evento;
    if (nombreInput) nombreInput.value = evento.nombre;
    if (fechaInput) fechaInput.value = evento.fecha_evento ? evento.fecha_evento.split('T')[0] : '';
    if (horaInput) horaInput.value = evento.hora || '';
    if (descripcionInput) descripcionInput.value = evento.descripcion || '';

    if (formLabel) formLabel.textContent = 'Editando evento';
    if (guardarBtn) guardarBtn.textContent = 'Actualizar evento';
    if (cancelarBtn) cancelarBtn.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ===== CANCELAR =====
if (cancelarBtn) {
    cancelarBtn.addEventListener('click', limpiarFormulario);
}

function limpiarFormulario() {
    if (eventoIdInput) eventoIdInput.value = '';
    if (nombreInput) nombreInput.value = '';
    if (fechaInput) fechaInput.value = '';
    if (horaInput) horaInput.value = '';
    if (descripcionInput) descripcionInput.value = '';

    if (formLabel) formLabel.textContent = 'Nuevo evento';
    if (guardarBtn) guardarBtn.textContent = 'Guardar evento';
    if (cancelarBtn) cancelarBtn.style.display = 'none';
}

// ===== ELIMINAR =====
window.eliminarEvento = async function(id) {
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
};

// ===== TOGGLE REPORTE =====
if (toggleReporteBtn) {
    toggleReporteBtn.addEventListener('click', () => {
        modoReporte = !modoReporte;
        toggleReporteBtn.textContent = modoReporte ? 'Ver gestión' : 'Ver reporte';
        cargarEventos();
    });
}

// ===== HELPERS =====
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ===== INIT =====
cargarEventos();