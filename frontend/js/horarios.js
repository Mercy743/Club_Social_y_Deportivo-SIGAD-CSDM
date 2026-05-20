const API_URL = '/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) window.location.href = 'index.html';

const esAdmin = loggedUser.rol === 'admin';
const esInstructor = loggedUser.rol === 'instructor';
const usuarioId = loggedUser.id;

// ===== OCULTAR FORMULARIO Y BOTONES SI NO ES ADMIN O INSTRUCTOR =====
if (!esAdmin && !esInstructor) {
    const formCard = document.querySelector('.dashboardCard');
    if (formCard) formCard.style.display = 'none';
    const formLabel = document.getElementById('formLabel');
    if (formLabel) formLabel.style.display = 'none';
}

// ===== ELEMENTOS DEL DOM =====
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

// ===== CARGAR SELECTS (solo si es admin o instructor, porque ellos pueden crear) =====
async function cargarSelects() {
    if (!esAdmin && !esInstructor) return;
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
        const res = await fetch(API_URL + '/horarios');
        const horarios = await res.json();
        const diaFiltro = filtroDia.value;
        const filtrados = diaFiltro ? horarios.filter(h => h.dia_semana === diaFiltro) : horarios;

        if (!filtrados.length) {
            horarioList.innerHTML = `
                <div class="emptyState">
                    <p>No hay horarios registrados${diaFiltro ? ' para ' + diaFiltro : ''}.</p>
                    <p style="font-size:12px; margin-top:8px; opacity:.6;">
                        ${(esAdmin || esInstructor) ? 'Crea el primero usando el formulario de arriba.' : 'Próximamente habrá horarios disponibles.'}
                    </p>
                </div>`;
            return;
        }

        const dias = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
        let html = '';
        for (const dia of dias) {
            const grupo = filtrados.filter(h => h.dia_semana === dia);
            if (grupo.length === 0) continue;
            html += `<p class="section-label" style="margin-top:20px;">${dia}</p><div class="eventListGrid">`;
            for (const h of grupo) {
                const estadoColor = h.activo
                    ? 'rgba(14,104,115,0.2); color:#54cfe0; border-color:rgba(14,104,115,0.3)'
                    : 'rgba(228,32,27,0.15); color:#ff6b6b; border-color:rgba(228,32,27,0.3)';
                let acciones = '';
                const puedeEditar = (esAdmin || (esInstructor && h.instructor_id === usuarioId));
                if (puedeEditar) {
                    acciones = `
                        <div class="eventActions" style="margin-top:14px;">
                            <button class="secondaryBtn" onclick="editarHorario(${h.id})">Editar</button>
                            <button class="secondaryBtn" onclick="toggleEstado(${h.id}, ${h.activo})">${h.activo ? 'Desactivar' : 'Activar'}</button>
                            <button class="dangerBtn" onclick="eliminarHorario(${h.id})">Eliminar</button>
                        </div>
                    `;
                }
                html += `
                    <div class="eventItem">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                            <h3 style="margin:0;">${h.actividad_nombre || 'Sin actividad'}</h3>
                            <span style="background:${estadoColor}; border:1px solid; border-radius:20px; padding:3px 10px; font-size:11px; font-weight:600; white-space:nowrap;">
                                ${h.activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </div>
                        <p class="eventMeta">🏟️ ${h.espacio_nombre || '—'}</p>
                        <p class="eventMeta">⏰ ${h.hora_inicio} – ${h.hora_fin}</p>
                        <p class="eventMeta">👤 ${h.instructor_nombre || 'Sin instructor'}</p>
                        ${h.fecha_inicio_vigencia ? `<p style="font-size:11px; color:rgba(255,255,255,0.3); margin:4px 0;">Vigencia: ${formatearFecha(h.fecha_inicio_vigencia)} → ${formatearFecha(h.fecha_fin_vigencia)}</p>` : ''}
                        ${acciones}
                    </div>
                `;
            }
            html += `</div>`;
        }
        horarioList.innerHTML = html;
    } catch (err) {
        console.error('Error cargando horarios:', err);
        horarioList.innerHTML = '<div class="emptyState">Error cargando horarios.</div>';
    }
}

// ===== GUARDAR (crear o actualizar) =====
guardarBtn?.addEventListener('click', async () => {
    if (!esAdmin && !esInstructor) {
        alert('No tienes permiso para crear horarios.');
        return;
    }
    const id = horarioIdInput.value;
    let espacio_id = espacioSelect.value;
    let actividad_id = actividadSelect.value;
    let instructor_id = instructorSelect.value;
    const dia_semana = diaSelect.value;
    const hora_inicio = horaInicio.value;
    const hora_fin = horaFin.value;
    const fecha_inicio_vigencia = fechaInicio.value;
    const fecha_fin_vigencia = fechaFin.value;

    if (!espacio_id || !dia_semana || !hora_inicio || !hora_fin) {
        alert('Espacio, día y horario son obligatorios.');
        return;
    }
    if (hora_inicio >= hora_fin) {
        alert('La hora de inicio debe ser menor a la hora de fin.');
        return;
    }

    // Si es instructor, forzar instructor_id a su propio ID (solo en creación)
    if (esInstructor && !id) {
        instructor_id = usuarioId;
    }

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/horarios/${id}` : `${API_URL}/horarios`;

    try {
        guardarBtn.disabled = true;
        guardarBtn.textContent = 'Guardando...';
        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                espacio_id, actividad_id, instructor_id,
                dia_semana, hora_inicio, hora_fin,
                fecha_inicio_vigencia, fecha_fin_vigencia,
                usuario_id: loggedUser.id   // para validación en backend
            })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Error al guardar');
        }
        limpiarFormulario();
        await cargarHorarios();
        alert(id ? 'Horario actualizado' : 'Horario creado');
    } catch (err) {
        console.error('Error guardando horario:', err);
        alert(err.message || 'Ocurrió un error al guardar el horario.');
    } finally {
        guardarBtn.disabled = false;
        guardarBtn.textContent = 'Guardar horario';
    }
});

// ===== EDITAR =====
async function editarHorario(id) {
    if (!esAdmin && !esInstructor) {
        alert('No tienes permiso para editar horarios.');
        return;
    }
    try {
        const res = await fetch(API_URL + '/horarios');
        const horarios = await res.json();
        const h = horarios.find(x => x.id === id);
        if (!h) return;
        // Verificar propiedad (instructor solo puede editar sus propios horarios)
        if (!esAdmin && h.instructor_id !== usuarioId) {
            alert('No puedes editar un horario que no te pertenece.');
            return;
        }
        horarioIdInput.value = h.id;
        espacioSelect.value = h.espacio_id;
        actividadSelect.value = h.actividad_id;
        instructorSelect.value = h.instructor_id;
        diaSelect.value = h.dia_semana;
        horaInicio.value = h.hora_inicio;
        horaFin.value = h.hora_fin;
        fechaInicio.value = h.fecha_inicio_vigencia?.split('T')[0] || '';
        fechaFin.value = h.fecha_fin_vigencia?.split('T')[0] || '';
        formLabel.textContent = 'Editando horario';
        guardarBtn.textContent = 'Actualizar horario';
        cancelarBtn.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        console.error('Error cargando horario:', err);
        alert('Error al cargar el horario para editar.');
    }
}

// ===== TOGGLE ESTADO (activar/desactivar) =====
async function toggleEstado(id, activo) {
    if (!esAdmin && !esInstructor) {
        alert('No tienes permiso para cambiar el estado.');
        return;
    }
    try {
        // Primero obtener el horario para verificar propiedad (si es instructor)
        const resHor = await fetch(API_URL + '/horarios');
        const horarios = await resHor.json();
        const h = horarios.find(x => x.id === id);
        if (!h) return;
        if (!esAdmin && h.instructor_id !== usuarioId) {
            alert('No puedes modificar un horario que no te pertenece.');
            return;
        }
        const res = await fetch(`${API_URL}/horarios/${id}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: !activo, usuario_id: loggedUser.id })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Error al cambiar estado');
        }
        await cargarHorarios();
    } catch (err) {
        console.error('Error cambiando estado:', err);
        alert(err.message);
    }
}

// ===== ELIMINAR =====
async function eliminarHorario(id) {
    if (!esAdmin && !esInstructor) {
        alert('No tienes permiso para eliminar horarios.');
        return;
    }
    try {
        const resHor = await fetch(API_URL + '/horarios');
        const horarios = await resHor.json();
        const h = horarios.find(x => x.id === id);
        if (!h) return;
        if (!esAdmin && h.instructor_id !== usuarioId) {
            alert('No puedes eliminar un horario que no te pertenece.');
            return;
        }
        if (!confirm('¿Seguro que quieres eliminar este horario?')) return;
        const res = await fetch(`${API_URL}/horarios/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: loggedUser.id })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Error al eliminar');
        }
        await cargarHorarios();
        alert('Horario eliminado');
    } catch (err) {
        console.error('Error eliminando horario:', err);
        alert(err.message);
    }
}

// ===== CANCELAR EDICIÓN =====
cancelarBtn?.addEventListener('click', limpiarFormulario);

function limpiarFormulario() {
    horarioIdInput.value = '';
    espacioSelect.value = '';
    actividadSelect.value = '';
    instructorSelect.value = '';
    diaSelect.value = '';
    horaInicio.value = '';
    horaFin.value = '';
    fechaInicio.value = '';
    fechaFin.value = '';
    formLabel.textContent = 'Nuevo horario';
    guardarBtn.textContent = 'Guardar horario';
    cancelarBtn.style.display = 'none';
}

// ===== FILTRO POR DÍA =====
filtroDia?.addEventListener('change', cargarHorarios);

// ===== HELPERS =====
function formatearFecha(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ===== INICIALIZACIÓN =====
async function init() {
    await cargarSelects();
    await cargarHorarios();
}

init();