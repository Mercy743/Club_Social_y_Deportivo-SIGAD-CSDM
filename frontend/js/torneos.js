const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) window.location.href = 'index.html';

let paginaActual = 1;
const torneosPorPagina = 6;

function escapeHTML(str) {
    return String(str || '').replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function fetchJSON(url, options = {}) {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en la petición');
    return data;
}

function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-MX');
}

/* ===== CARGAR ACTIVIDADES PARA SELECT ===== */
async function cargarActividadesEnSelect() {
    const select = document.getElementById('actividad_id');
    if (!select) return;
    try {
        const data = await fetchJSON(`${API_URL}/actividades`);
        select.innerHTML = '<option value="">Seleccione actividad</option>';
        data.forEach(a => {
            if (a.nombre !== 'Ludoteca') {
                select.innerHTML += `<option value="${a.id}">${escapeHTML(a.nombre)}</option>`;
            }
        });
    } catch (error) { console.error(error); }
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
            let color = '#444';
            switch ((t.actividad_nombre || '').toLowerCase()) {
                case 'futbol': color = '#2e7d32'; break;
                case 'tenis': color = '#1565c0'; break;
                case 'padel': color = '#6a1b9a'; break;
                case 'natacion': color = '#00838f'; break;
                case 'basquetbol': color = '#ef6c00'; break;
                case 'voleibol': color = '#ad1457'; break;
                case 'squash': color = '#5d4037'; break;
                default: color = '#0E6873';
            }
            
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
                        <button class="btn-editar-torneo" onclick="editarTorneo(${t.id})"><i class="fas fa-edit"></i> Editar</button>
                        <button class="btn-eliminar-torneo" onclick="eliminarTorneo(${t.id})"><i class="fas fa-trash"></i> Eliminar</button>
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
/* ===== GUARDAR TORNEO (CREAR/EDITAR) ===== */
async function guardarTorneo(event) {
    event.preventDefault();

    const id = new URLSearchParams(window.location.search).get('id');

    const nombre =
        document.getElementById('nombre').value.trim();

    const descripcion =
        document.getElementById('descripcion').value.trim();

    const fecha_inicio =
        document.getElementById('fecha_inicio').value;

    const fecha_fin =
        document.getElementById('fecha_fin').value;

    const actividad_id =
        document.getElementById('actividad_id').value;

    // 🔹 NUEVO
    const tipo_torneo =
        document.getElementById('tipo_torneo').value;

    // 🔹 validaciones
    if (
        !nombre ||
        !fecha_inicio ||
        !fecha_fin ||
        !actividad_id ||
        !tipo_torneo
    ) {
        alert('Datos incompletos');
        return;
    }

    // 🔹 validar fechas
    if (new Date(fecha_fin) < new Date(fecha_inicio)) {
        alert('La fecha fin no puede ser menor a la fecha inicio');
        return;
    }

    // 🔹 objeto
    const data = {

        nombre,
        descripcion,

        fecha_inicio,
        fecha_fin,

        actividad_id: Number(actividad_id),

        // 🔹 NUEVO
        tipo_torneo,

        creado_por: loggedUser.id
    };

    const url =
        id
            ? `${API_URL}/torneos/${id}`
            : `${API_URL}/torneos`;

    const method =
        id
            ? 'PUT'
            : 'POST';

    try {

        await fetchJSON(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        alert(
            id
                ? 'Torneo actualizado'
                : 'Torneo creado'
        );

        window.location.href = 'torneos.html';

    } catch (error) {

        alert(error.message);
    }
}

/* ===== ELIMINAR TORNEO ===== */
async function eliminarTorneo(id) {
    if (!confirm('¿Eliminar este torneo?')) return;
    try {
        await fetchJSON(`${API_URL}/torneos/${id}`, { method: 'DELETE' });
        cargarTorneos();
    } catch (error) { alert(error.message); }
}

/* ===== CAMBIAR ESTADO ===== */
async function cambiarEstado(id, estado) {
    try {
        await fetchJSON(`${API_URL}/torneos/${id}/estado`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado }) });
        if (document.getElementById('contenedorTorneos')) cargarTorneos();
        if (document.getElementById('detalle')) cargarDetalle();
    } catch (error) { alert(error.message); }
}

/* ===== INSCRIBIRSE (SOCIO) ===== */
async function inscribirme(id) {
    if (!loggedUser) return alert('Debes iniciar sesión');
    try {
        await fetchJSON(`${API_URL}/torneos/${id}/participantes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: loggedUser.id }) });
        alert('Inscripción exitosa');
        cargarDetalle();
    } catch (error) { alert(error.message); }
}

/* ===== AGREGAR PARTICIPANTE (ADMIN) ===== */
async function agregarParticipante(torneoId, usuarioId) {
    try {
        await fetchJSON(`${API_URL}/torneos/${torneoId}/participantes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: usuarioId }) });
        alert('Participante agregado');
        cargarDetalle();
    } catch (error) { alert(error.message); }
}

/* ===== ELIMINAR PARTICIPANTE ===== */
async function eliminarParticipante(torneoId, participanteId) {
    if (!confirm('¿Eliminar participante?')) return;
    try {
        await fetchJSON(`${API_URL}/torneos/${torneoId}/participantes/${participanteId}`, { method: 'DELETE' });
        cargarDetalle();
    } catch (error) { alert(error.message); }
}

/* ===== GENERAR BRACKET ===== */
async function generarBracket() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;
    try {
        const data = await fetchJSON(`${API_URL}/torneos/${id}/generar-bracket`, { method: 'POST' });
        alert(data.mensaje);
        cargarDetalle();
    } catch (error) { alert(error.message); }
}

/* ===== SIGUIENTE RONDA ===== */
async function generarSiguienteRonda() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;
    try {
        const data = await fetchJSON(`${API_URL}/torneos/${id}/siguiente-ronda`, { method: 'POST' });
        alert(data.mensaje);
        cargarDetalle();
    } catch (error) { alert(error.message); }
}

/* ===== CARGAR DETALLE DEL TORNEO ===== */
async function cargarDetalle() {
    const contenedor = document.getElementById('detalle');
    if (!contenedor) return;
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;
    
    try {
        const torneo = await fetchJSON(`${API_URL}/torneos/${id}`);
        let participantes = [];
        try { participantes = await fetchJSON(`${API_URL}/torneos/${id}/participantes`); } catch(e) {}
        
        const puedeParticipar = (torneo.estado === 'programado' || torneo.estado === 'en curso');
        const botonParticipar = puedeParticipar ? `<button class="btn-crear-torneo" onclick="inscribirme(${id})">Participar</button>` : '<button disabled class="btn-crear-torneo">Torneo cerrado</button>';
        const botonesAdmin = loggedUser.rol === 'admin' ? `<div class="botones-torneo" style="margin:20px 0;"><button class="btn-editar-torneo" onclick="generarBracket()">Generar Bracket</button><button class="btn-ver-torneo" onclick="generarSiguienteRonda()">Siguiente Ronda</button></div>` : '';
        
        let listaParticipantes = participantes.length ? '' : '<p>No hay participantes</p>';
        for (const p of participantes) {
            listaParticipantes += `
                <div class="card-torneo" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div><strong>${p.nombre ? escapeHTML(p.nombre + ' ' + (p.apellido || '')) : escapeHTML(p.nombre_invitado || 'Invitado')}</strong>${p.resultado ? `<div>Resultado: ${escapeHTML(p.resultado)}</div>` : ''}</div>
                    <button class="btn-eliminar-torneo" onclick="eliminarParticipante(${id}, ${p.id})">Eliminar</button>
                </div>
            `;
        }
        
        contenedor.innerHTML = `
            <div class="card-torneo">
                <h2>${escapeHTML(torneo.nombre)}</h2>
                <p>${escapeHTML(torneo.descripcion || 'Sin descripción')}</p>
                <p><strong>Estado:</strong> <select onchange="cambiarEstado(${id}, this.value)" class="estado-select"><option value="programado" ${torneo.estado === 'programado' ? 'selected' : ''}>Programado</option><option value="en curso" ${torneo.estado === 'en curso' ? 'selected' : ''}>En curso</option><option value="finalizado" ${torneo.estado === 'finalizado' ? 'selected' : ''}>Finalizado</option></select></p>
                <p><strong>Participantes:</strong> ${participantes.length} / ${torneo.max_participantes || 16}</p>
                ${botonParticipar}
                ${botonesAdmin}
            </div>
        `;
        document.getElementById('participantes').innerHTML = listaParticipantes;
        cargarBracket(id);
        cargarTop3(id);
        cargarUsuariosDisponibles(id);
    } catch (error) {
        contenedor.innerHTML = '<div class="emptyState">Error al cargar detalle</div>';
    }
}

/* ===== CARGAR BRACKET ===== */
async function cargarBracket(id) {

    const contenedor =
        document.getElementById('bracket');

    if (!contenedor) return;

    try {

        const data =
            await fetchJSON(`${API_URL}/torneos/${id}/bracket`);

        let html = `
            <div style="
                display:flex;
                gap:40px;
                overflow-x:auto;
                padding:20px 0;
            ">
        `;

        for (const ronda in data) {

            html += `
                <div style="min-width:280px;">
                    <h3 style="
                        margin-bottom:20px;
                        color:#54cfe0;
                    ">
                        ${escapeHTML(ronda)}
                    </h3>
            `;

            for (const p of data[ronda]) {

                const finalizado =
                    p.estado === 'finalizado';

                const ganador1 =
                    p.ganador_id == p.participante1_id;

                const ganador2 =
                    p.ganador_id == p.participante2_id;

                html += `
                    <div style="
                        background:${finalizado ? 'rgba(84,207,224,0.12)' : 'rgba(255,255,255,0.05)'};
                        border:${finalizado ? '1px solid #54cfe0' : '1px solid rgba(255,255,255,0.08)'};
                        border-radius:16px;
                        padding:18px;
                        margin-bottom:20px;
                    ">

                        <div style="
                            display:flex;
                            justify-content:space-between;
                            margin-bottom:10px;
                            font-weight:${ganador1 ? '700' : '500'};
                            color:${ganador1 ? '#54cfe0' : 'white'};
                        ">
                            <span>${escapeHTML(p.jugador1)}</span>
                            <span>${p.marcador1 ?? 0}</span>
                        </div>

                        <div style="
                            display:flex;
                            justify-content:space-between;
                            margin-bottom:16px;
                            font-weight:${ganador2 ? '700' : '500'};
                            color:${ganador2 ? '#54cfe0' : 'white'};
                        ">
                            <span>${escapeHTML(p.jugador2)}</span>
                            <span>${p.marcador2 ?? 0}</span>
                        </div>

                        <div style="
                            font-size:12px;
                            opacity:0.7;
                            margin-bottom:14px;
                        ">
                            Estado:
                            ${escapeHTML(p.estado)}
                        </div>
                `;

                if (!finalizado) {

                    html += `
                        <div style="
                            display:flex;
                            gap:10px;
                            margin-bottom:10px;
                        ">
                            <input
                                type="number"
                                id="m1-${p.id}"
                                placeholder="0"
                                style="
                                    width:100%;
                                    padding:10px;
                                    border-radius:10px;
                                    border:none;
                                    background:rgba(0,0,0,0.4);
                                    color:white;
                                "
                            >

                            <input
                                type="number"
                                id="m2-${p.id}"
                                placeholder="0"
                                style="
                                    width:100%;
                                    padding:10px;
                                    border-radius:10px;
                                    border:none;
                                    background:rgba(0,0,0,0.4);
                                    color:white;
                                "
                            >
                        </div>

                        <button
                            onclick="guardarResultado(${p.id}, ${id})"
                            style="
                                width:100%;
                                padding:10px;
                                border:none;
                                border-radius:10px;
                                background:linear-gradient(135deg,#0E6873,#54cfe0);
                                color:white;
                                cursor:pointer;
                                font-weight:600;
                            "
                        >
                            Guardar resultado
                        </button>
                    `;
                }

                if (finalizado) {

                    html += `
                        <div style="
                            margin-top:10px;
                            color:#54cfe0;
                            font-weight:700;
                            text-align:center;
                        ">
                            ✅ Clasificado
                        </div>
                    `;
                }

                html += `</div>`;
            }

            html += `</div>`;
        }

        html += `</div>`;

        contenedor.innerHTML =
            html || '<p>No hay bracket disponible</p>';

    } catch (error) {

        console.error(error);

        contenedor.innerHTML =
            '<p>No hay bracket disponible</p>';
    }
}

async function guardarResultado(partidoId, torneoId) {

    const marcador1 =
        document.getElementById(`m1-${partidoId}`).value;

    const marcador2 =
        document.getElementById(`m2-${partidoId}`).value;

    if (
        marcador1 === '' ||
        marcador2 === ''
    ) {
        return alert('Ingrese ambos marcadores');
    }

    try {

        await fetchJSON(
            `${API_URL}/partidos/${partidoId}/resultado`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    marcador1,
                    marcador2
                })
            }
        );

        alert('Resultado guardado');

        cargarBracket(torneoId);

    } catch (error) {

        alert(error.message);
    }
}

/* ===== CARGAR TOP 3 ===== */
async function cargarTop3(id) {
    const contenedor = document.getElementById('top3');
    if (!contenedor) return;
    try {
        const data = await fetchJSON(`${API_URL}/torneos/${id}/top3`);
        contenedor.innerHTML = `<div class="podio"><p>🥇 ${escapeHTML(data.primer_nombre || `Usuario ${data.primer_usuario}`)}</p><p>🥈 ${escapeHTML(data.segundo_nombre || `Usuario ${data.segundo_usuario}`)}</p><p>🥉 ${escapeHTML(data.tercer_nombre || `Usuario ${data.tercer_usuario}`)}</p></div>`;
    } catch (error) { contenedor.innerHTML = '<p>Top 3 no disponible</p>'; }
}

/* ===== CARGAR USUARIOS DISPONIBLES ===== */
async function cargarUsuariosDisponibles(idTorneo) {
    const contenedor = document.getElementById('listaUsuarios');
    if (!contenedor) return;
    try {
        const usuarios = await fetchJSON(`${API_URL}/usuarios`);
        const filtrados = usuarios.filter(u => u.rol !== 'admin' && u.rol !== 'instructor');
        const buscador = document.getElementById('buscarUsuario');
        const render = (lista) => {
            contenedor.innerHTML = '';
            lista.forEach(u => {
                contenedor.innerHTML += `<div class="card-torneo" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;"><span>${escapeHTML(u.nombre + ' ' + (u.apellido || ''))}</span><button class="btn-editar-torneo" onclick="agregarParticipante(${idTorneo}, ${u.id})">Agregar</button></div>`;
            });
        };
        render(filtrados);
        if (buscador) {
            buscador.oninput = () => {
                const texto = buscador.value.toLowerCase();
                render(filtrados.filter(u => (u.nombre + ' ' + (u.apellido || '')).toLowerCase().includes(texto)));
            };
        }
    } catch (error) { console.error(error); }
}

/* ===== NAVEGACIÓN ===== */
function verDetalle(id) { window.location.href = `torneos-detalle.html?id=${id}`; }
function editarTorneo(id) { window.location.href = `torneos-form.html?id=${id}`; }
function togglePanelUsuarios() { 
    const panel = document.getElementById('panelUsuarios');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

/* ===== INICIALIZAR ===== */
document.addEventListener('DOMContentLoaded', () => {
    cargarActividadesEnSelect();
    if (document.getElementById('contenedorTorneos')) cargarTorneos();
    if (document.getElementById('detalle')) cargarDetalle();
    const form = document.getElementById('formTorneo');
    if (form) form.addEventListener('submit', guardarTorneo);
    const btnCrear = document.getElementById('btnCrear');
    if (btnCrear) btnCrear.onclick = () => window.location.href = 'torneos-form.html';
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.removeItem('loggedUser'); window.location.href = 'index.html'; });
});