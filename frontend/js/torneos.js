const API_URL = '/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) window.location.href = 'index.html';

const esAdmin = loggedUser.rol === 'admin';

let paginaActual = 1;
const torneosPorPagina = 6;

// Paginación para participantes
let paginaParticipantes = 1;
const participantesPorPagina = 5;
let participantesGlobal = [];
let torneoIdActual = null;

// Paginación para usuarios disponibles
let paginaUsuarios = 1;
const usuariosPorPagina = 6;
let usuariosGlobal = [];
let torneoIdActualParaUsuarios = null;

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function fetchJSON(url, options = {}) {
    const res = await apiRequest(url, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en la petición');
    return data;
}

function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-MX');
}

/* ===== CARGAR ACTIVIDADES PARA EL SELECT DEL MODAL ===== */
async function cargarActividadesEnSelectModal() {
    const select = document.getElementById('actividadTorneo');
    if (!select) return;
    try {
        const res = await apiRequest(`${API_URL}/actividades`);
        const actividades = await res.json();
        select.innerHTML = '<option value="">Seleccione actividad</option>';
        actividades.forEach(a => {
            if (a.nombre !== 'Ludoteca') {
                select.innerHTML += `<option value="${a.id}">${escapeHTML(a.nombre)}</option>`;
            }
        });
    } catch (error) {
        console.error('Error cargando actividades:', error);
    }
}

/* ===== CARGAR LISTA DE TORNEOS ===== */
async function cargarTorneos() {
    const contenedor = document.getElementById('contenedorTorneos');
    if (!contenedor) return;
    try {
        const torneos = await fetchJSON(`${API_URL}/torneos`);
        if (!torneos.length) {
            contenedor.innerHTML = '<div class="emptyState">No hay torneos</div>';
            return;
        }
        const totalPaginas = Math.ceil(torneos.length / torneosPorPagina);
        const inicio = (paginaActual - 1) * torneosPorPagina;
        const paginados = torneos.slice(inicio, inicio + torneosPorPagina);
        let html = '<div class="grid-torneos">';
        for (const t of paginados) {
            let estadoClass = '';
            switch (t.estado) {
                case 'programado': estadoClass = 'estado-programado'; break;
                case 'en curso': estadoClass = 'estado-en-curso'; break;
                case 'finalizado': estadoClass = 'estado-finalizado'; break;
                case 'cancelado': estadoClass = 'estado-cancelado'; break;
                default: estadoClass = 'estado-programado';
            }
            html += `
                <div class="card-torneo">
                    <span class="estado-torneo ${estadoClass}">${t.estado || 'Programado'}</span>
                    <h3>${escapeHTML(t.nombre)}</h3>
                    <p><i class="fas fa-calendar-alt"></i> ${formatearFecha(t.fecha_inicio)} - ${formatearFecha(t.fecha_fin)}</p>
                    <p><i class="fas fa-tag"></i> ${escapeHTML(t.actividad_nombre || 'General')}</p>
                    <p class="descripcion-torneo">${escapeHTML(t.descripcion || 'Sin descripción')}</p>
                    <div class="botones-torneo">
                        <button class="btn-ver-torneo" onclick="verDetalle(${t.id})"><i class="fas fa-eye"></i> Ver</button>
                        ${esAdmin ? `
                            <button class="btn-editar-torneo" onclick="editarTorneo(${t.id})"><i class="fas fa-edit"></i> Editar</button>
                            <button class="btn-eliminar-torneo" onclick="eliminarTorneo(${t.id})"><i class="fas fa-trash"></i> Eliminar</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        html += '</div>';
        if (totalPaginas > 1) {
            html += `
                <div class="paginacion-container">
                    <button id="btnAnterior" class="btn-paginacion" ${paginaActual === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i> Anterior</button>
                    <span class="pagina-badge">Página ${paginaActual} de ${totalPaginas}</span>
                    <button id="btnSiguiente" class="btn-paginacion" ${paginaActual === totalPaginas ? 'disabled' : ''}>Siguiente <i class="fas fa-chevron-right"></i></button>
                </div>
            `;
        }
        contenedor.innerHTML = html;
        document.getElementById('btnAnterior')?.addEventListener('click', () => { if (paginaActual > 1) { paginaActual--; cargarTorneos(); } });
        document.getElementById('btnSiguiente')?.addEventListener('click', () => { paginaActual++; cargarTorneos(); });
    } catch (error) {
        console.error(error);
        contenedor.innerHTML = '<div class="emptyState">Error al cargar torneos</div>';
    }
}

/* ===== ELIMINAR TORNEO ===== */
async function eliminarTorneo(id) {
    if (!esAdmin) {
        alert('No tienes permiso para eliminar torneos.');
        return;
    }
    const password = prompt('Ingresa tu contraseña de administrador:');
    if (!password) return;
    if (!confirm('¿Eliminar este torneo?')) return;
    try {
        await fetchJSON(`${API_URL}/torneos/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: loggedUser.id, password })
        });
        cargarTorneos();
    } catch (error) { alert(error.message); }
}

/* ===== CAMBIAR ESTADO ===== */
async function cambiarEstado(id, estado) {
    if (!esAdmin) {
        alert('No tienes permiso para cambiar el estado del torneo.');
        return;
    }
    try {
        await fetchJSON(`${API_URL}/torneos/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado })
        });
        if (document.getElementById('contenedorTorneos')) cargarTorneos();
        if (document.getElementById('detalle')) cargarDetalle();
    } catch (error) { alert(error.message); }
}

/* ===== DETALLE DEL TORNEO ===== */
async function cargarDetalle() {
    const contenedor = document.getElementById('detalle');
    if (!contenedor) return;
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;
    try {
        const torneo = await fetchJSON(`${API_URL}/torneos/${id}`);
        const puedeAgregar = (torneo.estado !== 'finalizado' && torneo.estado !== 'cancelado') && esAdmin;
        const btnAgregar = document.getElementById('btnTogglePanel');
        if (btnAgregar) {
            btnAgregar.style.display = esAdmin ? 'inline-flex' : 'none';
            if (!puedeAgregar && esAdmin) {
                btnAgregar.disabled = true;
                btnAgregar.textContent = 'Torneo finalizado';
                btnAgregar.style.opacity = '0.5';
            } else if (esAdmin) {
                btnAgregar.disabled = false;
                btnAgregar.textContent = 'Agregar Participante';
                btnAgregar.style.opacity = '1';
            }
        }
        let participantes = [];
        try { participantes = await fetchJSON(`${API_URL}/torneos/${id}/participantes`); } catch(e) {}
        participantesGlobal = participantes;
        torneoIdActual = id;
        paginaParticipantes = 1;
        renderizarParticipantes();
        const puedeParticipar = (torneo.estado === 'programado' || torneo.estado === 'en curso');
        const botonParticipar = puedeParticipar ? `<button class="btn-crear-torneo" onclick="inscribirme(${id})">Participar</button>` : '<button disabled class="btn-crear-torneo">Torneo cerrado</button>';
        const botonesAdmin = esAdmin ? `<div class="botones-torneo" style="margin:20px 0;"><button class="btn-editar-torneo" onclick="generarBracket(${id})">Generar Bracket</button><button class="btn-ver-torneo" onclick="generarSiguienteRonda(${id})">Siguiente Ronda</button></div>` : '';
        const estadoSelect = esAdmin ? `
            <p><strong>Estado:</strong>
                <select onchange="cambiarEstado(${id}, this.value)" class="estado-select">
                    <option value="programado" ${torneo.estado === 'programado' ? 'selected' : ''}>Programado</option>
                    <option value="en curso" ${torneo.estado === 'en curso' ? 'selected' : ''}>En curso</option>
                    <option value="finalizado" ${torneo.estado === 'finalizado' ? 'selected' : ''}>Finalizado</option>
                </select>
            </p>` : `<p><strong>Estado:</strong> ${torneo.estado}</p>`;

        contenedor.innerHTML = `
            <div class="card-torneo">
                <h2>${escapeHTML(torneo.nombre)}</h2>
                <p>${escapeHTML(torneo.descripcion || 'Sin descripción')}</p>
                ${estadoSelect}
                <p><strong>Participantes:</strong> ${participantes.length} / ${torneo.max_participantes || 16}</p>
                ${botonParticipar}
                ${botonesAdmin}
            </div>
        `;
        cargarBracket(id);
        cargarTop3(id);
        await cargarUsuariosDisponibles(id);
    } catch (error) {
        contenedor.innerHTML = '<div class="emptyState">Error al cargar detalle</div>';
    }
}

function renderizarParticipantes() {
    const contenedor = document.getElementById('participantes');
    if (!contenedor) return;
    const totalPaginas = Math.ceil(participantesGlobal.length / participantesPorPagina);
    if (paginaParticipantes > totalPaginas && totalPaginas > 0) paginaParticipantes = totalPaginas;
    if (paginaParticipantes < 1) paginaParticipantes = 1;
    const inicio = (paginaParticipantes - 1) * participantesPorPagina;
    const paginados = participantesGlobal.slice(inicio, inicio + participantesPorPagina);
    let html = '';
    if (paginados.length === 0) {
        html = '<p>No hay participantes</p>';
    } else {
        html = paginados.map(p => `
            <div class="card-torneo" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div><strong>${p.nombre ? escapeHTML(p.nombre + ' ' + (p.apellido || '')) : escapeHTML(p.nombre_invitado || 'Invitado')}</strong>${p.resultado ? `<div>Resultado: ${escapeHTML(p.resultado)}</div>` : ''}</div>
                ${esAdmin ? `<button class="btn-eliminar-torneo" onclick="eliminarParticipante(${torneoIdActual}, ${p.id})">Eliminar</button>` : ''}
            </div>
        `).join('');
    }
    contenedor.innerHTML = html;
    const btnAnt = document.getElementById('btnAnteriorParticipantes');
    const btnSig = document.getElementById('btnSiguienteParticipantes');
    const info = document.getElementById('paginaParticipantesInfo');
    if (btnAnt) btnAnt.disabled = (paginaParticipantes === 1 || totalPaginas === 0);
    if (btnSig) btnSig.disabled = (paginaParticipantes === totalPaginas || totalPaginas === 0);
    if (info) info.textContent = `Página ${paginaParticipantes} de ${totalPaginas || 1}`;
}

function anteriorPaginaParticipantes() {
    if (paginaParticipantes > 1) { paginaParticipantes--; renderizarParticipantes(); }
}
function siguientePaginaParticipantes() {
    const total = Math.ceil(participantesGlobal.length / participantesPorPagina);
    if (paginaParticipantes < total) { paginaParticipantes++; renderizarParticipantes(); }
}

/* ===== USUARIOS DISPONIBLES (solo admin) ===== */
async function cargarUsuariosDisponibles(idTorneo) {
    const contenedor = document.getElementById('listaUsuarios');
    if (!contenedor) return;
    if (!esAdmin) {
        contenedor.innerHTML = '';
        return;
    }
    torneoIdActualParaUsuarios = idTorneo;
    try {
        const usuarios = await fetchJSON(`${API_URL}/usuarios`);
        const idsParticipantes = participantesGlobal.map(p => p.usuario_id).filter(id => id !== null);
        let disponibles = usuarios.filter(u => u.rol !== 'admin' && u.activo !== false);
        disponibles = disponibles.filter(u => !idsParticipantes.includes(u.id));
        usuariosGlobal = disponibles;
        paginaUsuarios = 1;
        renderizarUsuarios();

        const buscador = document.getElementById('buscarUsuario');
        if (buscador) {
            const nuevoBuscador = buscador.cloneNode(true);
            buscador.parentNode.replaceChild(nuevoBuscador, buscador);
            nuevoBuscador.addEventListener('input', (e) => {
                const texto = e.target.value.toLowerCase();
                let filtrados = usuariosGlobal.filter(u => 
                    u.nombre.toLowerCase().includes(texto) || u.email.toLowerCase().includes(texto)
                );
                const idsPart = participantesGlobal.map(p => p.usuario_id).filter(id => id !== null);
                filtrados = filtrados.filter(u => !idsPart.includes(u.id));
                usuariosGlobal = filtrados;
                paginaUsuarios = 1;
                renderizarUsuarios();
            });
        }
    } catch (error) {
        console.error(error);
        contenedor.innerHTML = '<div class="emptyState">Error al cargar usuarios</div>';
    }
}

function renderizarUsuarios() {
    const contenedor = document.getElementById('listaUsuarios');
    if (!contenedor) return;
    if (!esAdmin) return;
    const totalPaginas = Math.ceil(usuariosGlobal.length / usuariosPorPagina);
    if (paginaUsuarios > totalPaginas && totalPaginas > 0) paginaUsuarios = totalPaginas;
    if (paginaUsuarios < 1) paginaUsuarios = 1;
    const inicio = (paginaUsuarios - 1) * usuariosPorPagina;
    const paginados = usuariosGlobal.slice(inicio, inicio + usuariosPorPagina);
    if (paginados.length === 0) {
        contenedor.innerHTML = '<div class="emptyState">No hay usuarios disponibles</div>';
    } else {
        contenedor.innerHTML = paginados.map(u => `
            <div class="card" style="padding: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; background: rgba(20,20,20,0.8); border-radius: 12px;">
                <div>
                    <strong>${escapeHTML(u.nombre)}</strong>
                    <div style="font-size: 11px; color: #54cfe0;">${u.email}</div>
                    <div style="font-size: 10px; opacity: 0.6;">${u.rol}</div>
                </div>
                <button class="btn-editar-torneo" onclick="agregarParticipante(${torneoIdActualParaUsuarios}, ${u.id})" style="width: auto; padding: 4px 10px; font-size: 11px; border-radius: 20px; background: #0E6873; color: white; border: none; display: inline-flex; align-items: center; gap: 4px; flex: none; cursor: pointer;"><i class="fas fa-plus" style="font-size: 10px;"></i> Agregar</button>
            </div>
        `).join('');
    }
    const btnAnt = document.getElementById('btnAnteriorUsuarios');
    const btnSig = document.getElementById('btnSiguienteUsuarios');
    const info = document.getElementById('paginaUsuariosInfo');
    if (btnAnt) btnAnt.disabled = (paginaUsuarios === 1 || totalPaginas === 0);
    if (btnSig) btnSig.disabled = (paginaUsuarios === totalPaginas || totalPaginas === 0);
    if (info) info.textContent = `Página ${paginaUsuarios} de ${totalPaginas || 1}`;
}

function anteriorPaginaUsuarios() {
    if (paginaUsuarios > 1) { paginaUsuarios--; renderizarUsuarios(); }
}
function siguientePaginaUsuarios() {
    const total = Math.ceil(usuariosGlobal.length / usuariosPorPagina);
    if (paginaUsuarios < total) { paginaUsuarios++; renderizarUsuarios(); }
}

// ===== OPERACIONES CRUD =====
async function inscribirme(id) {
    if (!loggedUser) return alert('Debes iniciar sesión');
    try {
        await fetchJSON(`${API_URL}/torneos/${id}/participantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: loggedUser.id })
        });
        alert('Inscripción exitosa');
        await cargarDetalle();
    } catch (error) { alert(error.message); }
}

async function agregarParticipante(torneoId, usuarioId) {
    if (!esAdmin) {
        alert('No tienes permiso para agregar participantes.');
        return;
    }
    try {
        await fetchJSON(`${API_URL}/torneos/${torneoId}/participantes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: usuarioId })
        });
        alert('Participante agregado');
        await cargarDetalle();
    } catch (error) { alert(error.message); }
}

async function eliminarParticipante(torneoId, participanteId) {
    if (!esAdmin) {
        alert('No tienes permiso para eliminar participantes.');
        return;
    }
    if (!confirm('¿Eliminar participante?')) return;
    try {
        await fetchJSON(`${API_URL}/torneos/${torneoId}/participantes/${participanteId}`, { method: 'DELETE' });
        await cargarDetalle();
    } catch (error) { alert(error.message); }
}

async function generarBracket(torneoId) {
    if (!esAdmin) return alert('No autorizado');
    try {
        const data = await fetchJSON(`${API_URL}/torneos/${torneoId}/generar-bracket`, { method: 'POST' });
        alert(data.mensaje);
        cargarDetalle();
    } catch (error) { alert(error.message); }
}

async function generarSiguienteRonda(torneoId) {
    if (!esAdmin) return alert('No autorizado');
    try {
        const data = await fetchJSON(`${API_URL}/torneos/${torneoId}/siguiente-ronda`, { method: 'POST' });
        alert(data.mensaje);
        cargarDetalle();
    } catch (error) { alert(error.message); }
}

async function cargarBracket(id) {
    const contenedor = document.getElementById('bracket');
    if (!contenedor) return;
    try {
        const data = await fetchJSON(`${API_URL}/torneos/${id}/bracket`);
        let html = '<div style="display:flex; gap:40px; overflow-x:auto; padding:20px 0;">';
        for (const ronda in data) {
            html += `<div style="min-width:280px;"><h3 style="margin-bottom:20px; color:#54cfe0;">${escapeHTML(ronda)}</h3>`;
            for (const p of data[ronda]) {
                const finalizado = p.estado === 'finalizado';
                const ganador1 = p.ganador_id == p.participante1_id;
                const ganador2 = p.ganador_id == p.participante2_id;
                html += `
                    <div style="background:${finalizado ? 'rgba(84,207,224,0.12)' : 'rgba(255,255,255,0.05)'}; border:${finalizado ? '1px solid #54cfe0' : '1px solid rgba(255,255,255,0.08)'}; border-radius:16px; padding:18px; margin-bottom:20px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-weight:${ganador1 ? '700' : '500'}; color:${ganador1 ? '#54cfe0' : 'white'}">
                            <span>${escapeHTML(p.jugador1)}</span><span>${p.marcador1 ?? 0}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:16px; font-weight:${ganador2 ? '700' : '500'}; color:${ganador2 ? '#54cfe0' : 'white'}">
                            <span>${escapeHTML(p.jugador2)}</span><span>${p.marcador2 ?? 0}</span>
                        </div>
                        <div style="font-size:12px; opacity:0.7; margin-bottom:14px;">Estado: ${escapeHTML(p.estado)}</div>
                `;
                if (!finalizado && esAdmin) {
                    html += `
                        <div style="display:flex; gap:10px; margin-bottom:10px;">
                            <input type="number" id="m1-${p.id}" placeholder="0" style="width:100%; padding:10px; border-radius:10px; border:none; background:rgba(0,0,0,0.4); color:white;">
                            <input type="number" id="m2-${p.id}" placeholder="0" style="width:100%; padding:10px; border-radius:10px; border:none; background:rgba(0,0,0,0.4); color:white;">
                        </div>
                        <button onclick="guardarResultado(${p.id}, ${id})" style="width:100%; padding:10px; border:none; border-radius:10px; background:linear-gradient(135deg,#0E6873,#54cfe0); color:white; cursor:pointer; font-weight:600;">Guardar resultado</button>
                    `;
                } else if (finalizado) {
                    html += `<div style="margin-top:10px; color:#54cfe0; font-weight:700; text-align:center;">✅ Clasificado</div>`;
                }
                html += `</div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
        contenedor.innerHTML = html || '<p>No hay bracket disponible</p>';
    } catch (error) {
        console.error(error);
        contenedor.innerHTML = '<p>No hay bracket disponible</p>';
    }
}

async function guardarResultado(partidoId, torneoId) {
    if (!esAdmin) return alert('No autorizado');
    const marcador1 = document.getElementById(`m1-${partidoId}`).value;
    const marcador2 = document.getElementById(`m2-${partidoId}`).value;
    if (marcador1 === '' || marcador2 === '') return alert('Ingrese ambos marcadores');
    try {
        await fetchJSON(`${API_URL}/partidos/${partidoId}/resultado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ marcador1, marcador2 })
        });
        alert('Resultado guardado');
        cargarBracket(torneoId);
    } catch (error) { alert(error.message); }
}

async function cargarTop3(id) {
    const contenedor = document.getElementById('top3');
    if (!contenedor) return;
    try {
        const data = await fetchJSON(`${API_URL}/torneos/${id}/top3`);
        contenedor.innerHTML = `<div class="podio"><p>🥇 ${escapeHTML(data.primer_nombre || `Usuario ${data.primer_lugar}`)}</p><p>🥈 ${escapeHTML(data.segundo_nombre || `Usuario ${data.segundo_lugar}`)}</p><p>🥉 ${escapeHTML(data.tercer_nombre || `Usuario ${data.tercer_lugar}`)}</p></div>`;
    } catch (error) { contenedor.innerHTML = '<p>Top 3 no disponible</p>'; }
}

// ===== NAVEGACIÓN =====
function verDetalle(id) { window.location.href = `torneos-detalle.html?id=${id}`; }

async function editarTorneo(id) {
    if (!esAdmin) return;
    try {
        const res = await apiRequest(`${API_URL}/torneos/${id}`);
        const t = await res.json();
        document.getElementById('torneoIdModal').value = t.id;
        document.getElementById('nombreTorneo').value = t.nombre;
        document.getElementById('descripcionTorneo').value = t.descripcion || '';
        document.getElementById('fechaInicioTorneo').value = t.fecha_inicio.split('T')[0];
        document.getElementById('fechaFinTorneo').value = t.fecha_fin.split('T')[0];
        document.getElementById('tipoTorneo').value = t.tipo_torneo || 'eliminacion';
        await cargarActividadesEnSelectModal();
        document.getElementById('actividadTorneo').value = t.actividad_id;
        document.getElementById('modalTorneoTitulo').textContent = 'Editar Torneo';
        document.getElementById('modalTorneo').style.display = 'flex';
    } catch (err) {
        alert('Error al cargar torneo: ' + err.message);
    }
}
function togglePanelUsuarios() {
    if (!esAdmin) return;
    const panel = document.getElementById('panelUsuarios');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    cargarActividadesEnSelectModal();
    if (document.getElementById('contenedorTorneos')) cargarTorneos();
    if (document.getElementById('detalle')) cargarDetalle();

    document.getElementById('btnAnteriorParticipantes')?.addEventListener('click', anteriorPaginaParticipantes);
    document.getElementById('btnSiguienteParticipantes')?.addEventListener('click', siguientePaginaParticipantes);
    document.getElementById('btnAnteriorUsuarios')?.addEventListener('click', anteriorPaginaUsuarios);
    document.getElementById('btnSiguienteUsuarios')?.addEventListener('click', siguientePaginaUsuarios);

    const formModal = document.getElementById('formTorneoModal');
    if (formModal) {
        formModal.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('torneoIdModal').value;
            const nombre = document.getElementById('nombreTorneo').value.trim();
            const descripcion = document.getElementById('descripcionTorneo').value.trim();
            const fecha_inicio = document.getElementById('fechaInicioTorneo').value;
            const fecha_fin = document.getElementById('fechaFinTorneo').value;
            const actividad_id = document.getElementById('actividadTorneo').value;
            const tipo_torneo = document.getElementById('tipoTorneo').value;
            if (!nombre || !fecha_inicio || !fecha_fin || !actividad_id) {
                alert('Complete los campos obligatorios');
                return;
            }
            const data = {
                nombre, descripcion, fecha_inicio, fecha_fin,
                actividad_id: Number(actividad_id),
                tipo_torneo,
                creado_por: loggedUser.id
            };
            const url = id ? `${API_URL}/torneos/${id}` : `${API_URL}/torneos`;
            const method = id ? 'PUT' : 'POST';
            try {
                await fetchJSON(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                alert(id ? 'Torneo actualizado' : 'Torneo creado');
                document.getElementById('modalTorneo').style.display = 'none';
                cargarTorneos();
            } catch (err) { alert(err.message); }
        });
    }
    document.getElementById('cerrarModalBtn')?.addEventListener('click', () => {
        document.getElementById('modalTorneo').style.display = 'none';
    });
    document.getElementById('btnCrear')?.addEventListener('click', () => {
        if (!esAdmin) {
            alert('Solo administradores pueden crear torneos.');
            return;
        }
        document.getElementById('torneoIdModal').value = '';
        document.getElementById('nombreTorneo').value = '';
        document.getElementById('descripcionTorneo').value = '';
        document.getElementById('fechaInicioTorneo').value = '';
        document.getElementById('fechaFinTorneo').value = '';
        document.getElementById('tipoTorneo').value = 'eliminacion';
        cargarActividadesEnSelectModal();
        document.getElementById('modalTorneoTitulo').textContent = 'Nuevo Torneo';
        document.getElementById('modalTorneo').style.display = 'flex';
    });
    const btnCrear = document.getElementById('btnCrear');
    if (btnCrear && esAdmin) btnCrear.style.display = 'inline-flex';
    if (document.getElementById('seccionReseñas')) cargarReseñas();
});
/* ===== RESEÑAS ===== */
async function cargarReseñas() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id || !document.getElementById('seccionReseñas')) return;

    const esSocio = loggedUser.rol === 'socio';

    // Resumen
    try {
        const res = await apiRequest(`${API_URL}/reseñas/resumen?tipo=torneo&referencia_id=${id}`);
        const data = await res.json();
        const promedio = parseFloat(data.promedio) || 0;
        const total = parseInt(data.total) || 0;
        const estrellas = '★'.repeat(Math.round(promedio)) + '☆'.repeat(5 - Math.round(promedio));
        document.getElementById('resumenReseñas').innerHTML = `
            <div style="display:flex; align-items:center; gap:16px;">
                <span style="font-size:32px; color:#f5c518;">${estrellas}</span>
                <div>
                    <div style="font-size:22px; font-weight:700; color:#54cfe0;">${promedio > 0 ? promedio : 'Sin reseñas'}</div>
                    <div style="font-size:13px; color:rgba(255,255,255,0.4);">${total} reseña${total !== 1 ? 's' : ''}</div>
                </div>
            </div>
        `;
    } catch(e) {}

    // Verificar si ya reseñó
    if (esSocio) {
        try {
            const puedeRes = await apiRequest(`${API_URL}/reseñas/puedo-reseñar?tipo=torneo&referencia_id=${id}&usuario_id=${loggedUser.id}`);
            const { puede } = await puedeRes.json();
            if (!puede) {
                document.getElementById('formularioReseña').innerHTML = `
                    <p style="color:rgba(255,255,255,0.3); font-size:13px;">Solo puedes calificar torneos en los que participaste.</p>
                `;
                return;
            }
            const miaRes = await apiRequest(`${API_URL}/reseñas/mia?tipo=torneo&referencia_id=${id}&usuario_id=${loggedUser.id}`);
            const mia = await miaRes.json();
            const form = document.getElementById('formularioReseña');
            if (mia) {
                const estrellasMia = '★'.repeat(mia.estrellas) + '☆'.repeat(5 - mia.estrellas);
                form.innerHTML = `
                    <div style="background:rgba(84,207,224,0.08); border:1px solid rgba(84,207,224,0.2); border-radius:12px; padding:16px;">
                        <p style="color:rgba(255,255,255,0.5); font-size:13px; margin-bottom:8px;">Tu reseña</p>
                        <div style="color:#f5c518; font-size:20px;">${estrellasMia}</div>
                        <p style="margin-top:8px; font-size:14px;">${mia.comentario || 'Sin comentario'}</p>
                    </div>
                `;
            } else {
                form.innerHTML = `
                    <div style="margin-top:8px;">
                        <p style="font-size:14px; color:rgba(255,255,255,0.6); margin-bottom:12px;">¿Cómo calificarías este torneo?</p>
                        <div id="starSelector" style="display:flex; gap:8px; font-size:28px; cursor:pointer; margin-bottom:12px;">
                            ${[1,2,3,4,5].map(n => `<span data-val="${n}" style="color:rgba(255,255,255,0.2); transition:color 0.15s;">★</span>`).join('')}
                        </div>
                        <input type="hidden" id="estrellasSeleccionadas" value="0">
                        <textarea id="comentarioReseña" placeholder="Comentario (opcional)" style="width:100%; padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.4); color:white; font-size:14px; resize:vertical; min-height:80px; box-sizing:border-box;"></textarea>
                        <button id="enviarReseñaBtn" style="margin-top:12px; max-width:180px;">Enviar reseña</button>
                        <p id="reseñaMsg" style="font-size:13px; margin-top:8px;"></p>
                    </div>
                `;
                // Lógica de estrellas
                const spans = document.querySelectorAll('#starSelector span');
                spans.forEach(span => {
                    span.addEventListener('mouseenter', () => {
                        const val = parseInt(span.dataset.val);
                        spans.forEach(s => s.style.color = parseInt(s.dataset.val) <= val ? '#f5c518' : 'rgba(255,255,255,0.2)');
                    });
                    span.addEventListener('mouseleave', () => {
                        const sel = parseInt(document.getElementById('estrellasSeleccionadas').value);
                        spans.forEach(s => s.style.color = parseInt(s.dataset.val) <= sel ? '#f5c518' : 'rgba(255,255,255,0.2)');
                    });
                    span.addEventListener('click', () => {
                        document.getElementById('estrellasSeleccionadas').value = span.dataset.val;
                        spans.forEach(s => s.style.color = parseInt(s.dataset.val) <= parseInt(span.dataset.val) ? '#f5c518' : 'rgba(255,255,255,0.2)');
                    });
                });
                document.getElementById('enviarReseñaBtn').addEventListener('click', async () => {
                    const estrellas = parseInt(document.getElementById('estrellasSeleccionadas').value);
                    const comentario = document.getElementById('comentarioReseña').value.trim();
                    const msg = document.getElementById('reseñaMsg');
                    if (!estrellas) { msg.style.color = '#ff6b6b'; msg.textContent = 'Selecciona una calificación'; return; }
                    try {
                        const r = await apiRequest(`${API_URL}/reseñas`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tipo: 'torneo', referencia_id: parseInt(id), usuario_id: loggedUser.id, estrellas, comentario })
                        });
                        if (r.ok) { cargarReseñas(); }
                        else { const d = await r.json(); msg.style.color = '#ff6b6b'; msg.textContent = d.error || 'Error'; }
                    } catch(e) { msg.style.color = '#ff6b6b'; msg.textContent = 'Error de conexión'; }
                });
            }
        } catch(e) {}
    }
}
