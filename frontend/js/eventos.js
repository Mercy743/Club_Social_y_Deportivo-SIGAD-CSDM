const API_URL = '/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) window.location.href = 'index.html';

const esAdmin = loggedUser?.rol === 'admin';
let modoReporte = false;

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
});

// ===== ELEMENTOS DEL DOM =====
const eventList = document.getElementById('eventList');
const toggleReporteBtn = document.getElementById('toggleReporteBtn');
const btnCrearEvento = document.getElementById('btnCrearEvento');

// Mostrar botón crear solo para admin
if (btnCrearEvento) {
    btnCrearEvento.style.display = esAdmin ? 'inline-flex' : 'none';
    btnCrearEvento.addEventListener('click', () => {
        abrirModalEvento();
    });
}

// ===== MODAL =====
const modalEvento = document.getElementById('modalEvento');
const formEventoModal = document.getElementById('formEventoModal');
const eventoIdModal = document.getElementById('eventoIdModal');
const modalTitulo = document.getElementById('modalEventoTitulo');
const cerrarModalBtn = document.getElementById('cerrarEventoModalBtn');

function abrirModalEvento(editar = false) {
    modalEvento.style.display = 'flex';
    if (!editar) {
        modalTitulo.textContent = 'Nuevo Evento';
        eventoIdModal.value = '';
        formEventoModal.reset();
    }
}

function cerrarModalEvento() {
    modalEvento.style.display = 'none';
}

cerrarModalBtn?.addEventListener('click', cerrarModalEvento);

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
                        ${esAdmin ? 'Crea el primero usando el botón "Crear Evento".' : 'Próximamente habrá eventos disponibles.'}
                    </p>
                </div>`;
            return;
        }

        if (modoReporte) {
            // Modo reporte: tabla
            eventList.innerHTML = `
                <div class="dashboardCard">
                    <div style="overflow-x:auto;">
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
                    </div>
                </div>`;
        } else {
            // Modo tarjetas (diseño moderno)
            eventList.innerHTML = `
                <div class="eventListGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
                    ${eventos.map(e => `
                        <div class="eventItem" style="background: rgba(20,20,20,0.68); backdrop-filter: blur(12px); border-radius: 20px; padding: 22px; transition: all 0.3s; border: 1px solid rgba(255,255,255,0.06); position: relative; overflow: hidden;">
                            <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #0E6873, #54cfe0, #FE7E3C); opacity: 0; transition: opacity 0.3s;"></div>
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                                <i class="fas fa-calendar-alt" style="font-size: 28px; color: #54cfe0;"></i>
                                <h3 style="margin: 0; font-size: 1.2rem; color: white; font-family: 'Oswald', sans-serif;">${escapeHtml(e.nombre)}</h3>
                            </div>
                            <p style="margin: 4px 0; display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.6);">
                                <i class="fas fa-calendar-day" style="width: 20px;"></i> ${e.fecha_evento || 'Sin fecha'}
                            </p>
                            ${e.hora ? `<p style="margin: 4px 0; display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.6);"><i class="fas fa-clock" style="width: 20px;"></i> ${e.hora.substring(0,5)}</p>` : ''}
                            <p class="descripcion" style="margin: 12px 0; color: rgba(255,255,255,0.55); font-size: 0.85rem; line-height: 1.5;">${escapeHtml(e.descripcion) || 'Sin descripción'}</p>
                            ${esAdmin ? `
                                <div class="eventActions" style="margin-top: 16px; display: flex; gap: 10px;">
                                    <button class="secondaryBtn" onclick="editarEvento(${e.id_evento})" style="flex: 1; padding: 8px; background: rgba(14,104,115,0.2); border: 1px solid rgba(14,104,115,0.3); color: #54cfe0;">
                                        <i class="fas fa-edit"></i> Editar
                                    </button>
                                    <button class="dangerBtn" onclick="eliminarEvento(${e.id_evento})" style="flex: 1; padding: 8px; background: rgba(228,32,27,0.15); border: 1px solid rgba(228,32,27,0.3); color: #ff8a8a;">
                                        <i class="fas fa-trash"></i> Eliminar
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>`;
        }

        // Efecto hover para tarjetas (añade clase al pasar mouse)
        document.querySelectorAll('.eventItem').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-4px)';
                card.style.borderColor = 'rgba(84,207,224,0.25)';
                card.querySelector('div:first-child')?.style.setProperty('opacity', '1');
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = '';
                card.style.borderColor = '';
                card.querySelector('div:first-child')?.style.setProperty('opacity', '0');
            });
        });
    } catch (err) {
        console.error('Error cargando eventos:', err);
        eventList.innerHTML = '<div class="emptyState">Error cargando eventos.</div>';
    }
}

// ===== GUARDAR EVENTO (crear o actualizar) =====
formEventoModal?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!esAdmin) return;

    const id = eventoIdModal.value;
    const nombre = document.getElementById('nombreEventoModal').value.trim();
    const fecha = document.getElementById('fechaEventoModal').value;
    const hora = document.getElementById('horaEventoModal').value;
    const descripcion = document.getElementById('descripcionEventoModal').value.trim();

    if (!nombre || !fecha) {
        alert('El nombre y la fecha son obligatorios.');
        return;
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaEvento = new Date(fecha);
    if (fechaEvento < hoy) {
        alert('No se pueden crear/editar eventos con fechas pasadas.');
        return;
    }

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/eventos/${id}` : `${API_URL}/eventos`;
    const body = id
        ? { nombre, fecha_evento: fecha, hora, descripcion }
        : { nombre, fecha_evento: fecha, hora, descripcion, creado_por: loggedUser.id };

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Error al guardar');
        cerrarModalEvento();
        await cargarEventos();
        alert(id ? 'Evento actualizado' : 'Evento creado');
    } catch (err) {
        console.error(err);
        alert('Ocurrió un error al guardar el evento.');
    }
});

// ===== EDITAR EVENTO (abre modal) =====
window.editarEvento = async (id) => {
    if (!esAdmin) return;
    try {
        const res = await fetch(`${API_URL}/eventos/${id}`);
        const evento = await res.json();
        eventoIdModal.value = evento.id_evento;
        document.getElementById('nombreEventoModal').value = evento.nombre;
        document.getElementById('fechaEventoModal').value = evento.fecha_evento.split('T')[0];
        document.getElementById('horaEventoModal').value = evento.hora || '';
        document.getElementById('descripcionEventoModal').value = evento.descripcion || '';
        modalTitulo.textContent = 'Editar Evento';
        abrirModalEvento(true);
    } catch (err) {
        console.error(err);
        alert('Error al cargar el evento');
    }
};

// ===== ELIMINAR EVENTO =====
window.eliminarEvento = async (id) => {
    if (!esAdmin) return;
    if (!confirm('¿Seguro que quieres eliminar este evento?')) return;
    try {
        const res = await fetch(`${API_URL}/eventos/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al eliminar');
        await cargarEventos();
        alert('Evento eliminado');
    } catch (err) {
        console.error(err);
        alert('Ocurrió un error al eliminar el evento.');
    }
};

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
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
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

// ===== INICIALIZAR =====
cargarEventos();