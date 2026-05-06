const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) window.location.href = 'index.html';

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
});

// ===== ELEMENTOS =====
const horarioIdInput  = document.getElementById('horarioId');
const espacioSelect   = document.getElementById('espacioSelect');
const actividadSelect = document.getElementById('actividadSelect');
const instructorSelect= document.getElementById('instructorSelect');
const diaSelect       = document.getElementById('diaSelect');
const horaInicio      = document.getElementById('horaInicio');
const horaFin         = document.getElementById('horaFin');
const fechaInicio     = document.getElementById('fechaInicio');
const fechaFin        = document.getElementById('fechaFin');
const guardarBtn      = document.getElementById('guardarBtn');
const cancelarBtn     = document.getElementById('cancelarBtn');
const formLabel       = document.getElementById('formLabel');
const horarioList     = document.getElementById('horarioList');
const filtroDia       = document.getElementById('filtroDia');

// ===== CARGAR SELECTS =====
async function cargarSelects() {
    try {
        const [espacios, actividades, instructores] = await Promise.all([
            fetch(API_URL + '/espacios').then(r => r.json()),
            fetch(API_URL + '/actividades').then(r => r.json()),
            fetch(API_URL + '/instructores').then(r => r.json())
        ]);

        espacios.forEach(e => {
            espacioSelect.innerHTML += `<option value="${e.id}">${e.nombre} (${e.tipo})</option>`;
        });

        actividades.forEach(a => {
            actividadSelect.innerHTML += `<option value="${a.id}">${a.nombre}</option>`;
        });

        instructores.forEach(i => {
            instructorSelect.innerHTML += `<option value="${i.id}">${i.nombre} - ${i.especialidad || 'Sin especialidad'}</option>`;
        });

    } catch (err) {
        console.error('Error cargando selects:', err);
    }
}

// ===== CARGAR HORARIOS =====
async function cargarHorarios() {
    try {
        const res      = await fetch(API_URL + '/horarios');
        const horarios = await res.json();

        const diaFiltro = filtroDia.value;
        const filtrados = diaFiltro ? horarios.filter(h => h.dia_semana === diaFiltro) : horarios;

        if (!filtrados.length) {
            horarioList.innerHTML = `
                <div class="emptyState">
                    <p>No hay horarios registrados${diaFiltro ? ' para ' + diaFiltro : ''}.</p>
                    <p style="font-size:12px; margin-top:8px; opacity:.6;">
                        Crea el primero usando el formulario de arriba.
                    </p>
                </div>`;
            return;
        }

        // Agrupar por día
        const dias = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
        const agrupados = {};
        dias.forEach(d => agrupados[d] = []);
        filtrados.forEach(h => {
            if (agrupados[h.dia_semana]) agrupados[h.dia_semana].push(h);
        });

        let html = '';
        dias.forEach(dia => {
            if (!agrupados[dia].length) return;

            html += `<p class="section-label" style="margin-top:20px;">${dia}</p>`;
            html += `<div class="eventListGrid">`;

            agrupados[dia].forEach(h => {
                const estadoColor = h.activo
                    ? 'rgba(14,104,115,0.2); color:#54cfe0; border-color:rgba(14,104,115,0.3)'
                    : 'rgba(228,32,27,0.15); color:#ff6b6b; border-color:rgba(228,32,27,0.3)';

                html += `
                    <div class="eventItem">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                            <h3 style="margin:0;">${h.actividad_nombre || 'Sin actividad'}</h3>
                            <span style="background:${estadoColor}; border:1px solid; border-radius:20px; padding:3px 10px; font-size:11px; font-weight:600; white-space:nowrap; margin-left:8px;">
                                ${h.activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                        <p class="eventMeta">🏟️ ${h.espacio_nombre || '—'}</p>
                        <p class="eventMeta">⏰ ${h.hora_inicio} – ${h.hora_fin}</p>
                        <p class="eventMeta">👤 ${h.instructor_nombre || 'Sin instructor'}</p>
                        ${h.fecha_inicio_vigencia ? `<p style="font-size:11px; color:rgba(255,255,255,0.3); margin:4px 0;">Vigencia: ${formatearFecha(h.fecha_inicio_vigencia)} → ${formatearFecha(h.fecha_fin_vigencia)}</p>` : ''}
                        <div class="eventActions" style="margin-top:14px;">
                            <button class="secondaryBtn" onclick="editarHorario(${h.id})">Editar</button>
                            <button class="secondaryBtn" onclick="toggleEstado(${h.id}, ${h.activo})">
                                ${h.activo ? 'Desactivar' : 'Activar'}
                            </button>
                            <button class="dangerBtn" onclick="eliminarHorario(${h.id})">Eliminar</button>
                        </div>
                    </div>`;
            });

            html += `</div>`;
        });

        horarioList.innerHTML = html;

    } catch (err) {
        console.error('Error cargando horarios:', err);
        horarioList.innerHTML = '<div class="emptyState">Error cargando horarios.</div>';
    }
}

// ===== GUARDAR =====
guardarBtn.addEventListener('click', async () => {
    const id = horarioIdInput.value;

    const espacio_id             = espacioSelect.value;
    const actividad_id           = actividadSelect.value;
    const instructor_id          = instructorSelect.value;
    const dia_semana             = diaSelect.value;
    const hora_inicio            = horaInicio.value;
    const hora_fin               = horaFin.value;
    const fecha_inicio_vigencia  = fechaInicio.value;
    const fecha_fin_vigencia     = fechaFin.value;

    if (!espacio_id || !dia_semana || !hora_inicio || !hora_fin) {
        alert('Espacio, día y horario son obligatorios.');
        return;
    }

    if (hora_inicio >= hora_fin) {
        alert('La hora de inicio debe ser menor a la hora de fin.');
        return;
    }

    const metodo = id ? 'PUT' : 'POST';
    const url    = id ? `${API_URL}/horarios/${id}` : `${API_URL}/horarios`;

    try {
        guardarBtn.disabled    = true;
        guardarBtn.textContent = 'Guardando...';

        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                espacio_id, actividad_id, instructor_id,
                dia_semana, hora_inicio, hora_fin,
                fecha_inicio_vigencia, fecha_fin_vigencia
            })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Error al guardar');
        }

        limpiarFormulario();
        await cargarHorarios();

    } catch (err) {
        console.error('Error guardando horario:', err);
        alert(err.message || 'Ocurrió un error al guardar el horario.');
    } finally {
        guardarBtn.disabled    = false;
        guardarBtn.textContent = 'Guardar horario';
    }
});

// ===== EDITAR =====
async function editarHorario(id) {
    try {
        const res      = await fetch(API_URL + '/horarios');
        const horarios = await res.json();
        const h        = horarios.find(x => x.id === id);
        if (!h) return;

        horarioIdInput.value    = h.id;
        espacioSelect.value     = h.espacio_id;
        actividadSelect.value   = h.actividad_id;
        instructorSelect.value  = h.instructor_id;
        diaSelect.value         = h.dia_semana;
        horaInicio.value        = h.hora_inicio;
        horaFin.value           = h.hora_fin;
        fechaInicio.value       = h.fecha_inicio_vigencia?.split('T')[0] || '';
        fechaFin.value          = h.fecha_fin_vigencia?.split('T')[0] || '';

        formLabel.textContent     = 'Editando horario';
        guardarBtn.textContent    = 'Actualizar horario';
        cancelarBtn.style.display = 'block';

        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
        console.error('Error cargando horario:', err);
    }
}

// ===== TOGGLE ESTADO =====
async function toggleEstado(id, activo) {
    try {
        const res = await fetch(`${API_URL}/horarios/${id}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: !activo })
        });
        if (!res.ok) throw new Error('Error al cambiar estado');
        await cargarHorarios();
    } catch (err) {
        console.error('Error cambiando estado:', err);
        alert('Error al cambiar el estado del horario.');
    }
}

// ===== ELIMINAR =====
async function eliminarHorario(id) {
    if (!confirm('¿Seguro que quieres eliminar este horario?')) return;

    try {
        const res = await fetch(`${API_URL}/horarios/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al eliminar');
        await cargarHorarios();
    } catch (err) {
        console.error('Error eliminando horario:', err);
        alert('Error al eliminar el horario.');
    }
}

// ===== CANCELAR =====
cancelarBtn.addEventListener('click', limpiarFormulario);

function limpiarFormulario() {
    horarioIdInput.value   = '';
    espacioSelect.value    = '';
    actividadSelect.value  = '';
    instructorSelect.value = '';
    diaSelect.value        = '';
    horaInicio.value       = '';
    horaFin.value          = '';
    fechaInicio.value      = '';
    fechaFin.value         = '';

    formLabel.textContent     = 'Nuevo horario';
    guardarBtn.textContent    = 'Guardar horario';
    cancelarBtn.style.display = 'none';
}

// ===== FILTRO =====
filtroDia.addEventListener('change', cargarHorarios);

// ===== HELPERS =====
function formatearFecha(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ===== INIT =====
async function init() {
    await cargarSelects();
    await cargarHorarios();
}

init(); 