const API_URL = '/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) window.location.href = 'index.html';

const rol = loggedUser.rol;
const usuarioId = loggedUser.id;

function formatearDuracion(minutos) {
    if (!minutos) return '60 min';
    const horas = minutos / 60;
    if (minutos % 60 === 0) {
        if (horas === 1) return '1 hora';
        return horas + ' horas';
    }
    const horasEnteras = Math.floor(horas);
    const minutosRestantes = minutos % 60;
    if (horasEnteras === 0) return minutos + ' minutos';
    if (minutosRestantes === 0) return horasEnteras + (horasEnteras === 1 ? ' hora' : ' horas');
    return horasEnteras + ' hora ' + minutosRestantes + ' min';
}

async function getActividades() {
    const res = await apiRequest(`${API_URL}/actividades`);
    return await res.json();
}

let paginaActual = 1;
const actividadesPorPagina = 10;

async function renderActividades(filtro = "") {
    const contenedor = document.getElementById("contenedorActividades");
    if (!contenedor) return;

    const actividades = await getActividades();
    const filtradas = actividades.filter(a =>
        a.nombre.toLowerCase().includes(filtro.toLowerCase())
    );
    const totalPaginas = Math.ceil(filtradas.length / actividadesPorPagina);
    const inicio = (paginaActual - 1) * actividadesPorPagina;
    const paginadas = filtradas.slice(inicio, inicio + actividadesPorPagina);

    const totalResultados = document.getElementById('totalResultados');
    if (totalResultados) totalResultados.innerText = filtradas.length;

    contenedor.innerHTML = "";

    for (const act of paginadas) {
        const inscritos = act.inscritos || 0;
        const capacidad = act.capacidad || 1;
        const porcentaje = capacidad > 0 ? (inscritos / capacidad) * 100 : 0;
        let color = "verde";
        if (porcentaje >= 100) color = "rojo";
        else if (porcentaje >= 70) color = "naranja";

        const esPropietario = (act.creado_por === usuarioId);
        let botones = "";

        if (rol === 'admin') {
            botones = `
                <div class="botones-admin">
                    <button class="btn-editar" onclick="editarActividad(${act.id})">Editar</button>
                    <button class="btn-eliminar" onclick="eliminarActividad(${act.id})">Eliminar</button>
                </div>
            `;
        } else if (rol === 'instructor') {
            if (esPropietario) {
                botones = `
                    <div class="botones-instructor">
                        <button class="btn-editar" onclick="editarActividad(${act.id})">Editar</button>
                        <button class="btn-eliminar" onclick="eliminarActividad(${act.id})">Eliminar</button>
                    </div>
                `;
            } else {
                botones = `
                    <div class="botones-instructor">
                        <button class="btn-asignarse" onclick="asignarseInstructor(${act.id})">Asignarme</button>
                    </div>
                `;
            }
        } else if (rol === 'socio') {
            botones = `
                <div class="botones-socio">
                    <button class="btn-inscribirse" onclick="inscribirseActividad(${act.id})">Inscribirme</button>
                </div>
            `;
        }

        contenedor.innerHTML += `
            <div class="card">
                <div class="card-badge">
                    <span class="card-icono">${act.nivel || 'Principiante'}</span>
                </div>
                <h2>${act.nombre}</h2>
                <p class="descripcion">${act.descripcion || "Sin descripción"}</p>
                <p><strong>Capacidad:</strong> ${inscritos}/${capacidad}</p>
                <div class="barra"><div class="progreso ${color}" style="width:${Math.min(porcentaje, 100)}%"></div></div>
                <p><strong>Duración:</strong> ${formatearDuracion(parseInt(act.duracion || '60'))}</p>
                <div id="resumen-act-${act.id}" style="color:#f5c518; font-size:13px; margin:6px 0;">Cargando...</div>
                <button class="btn-detalle" onclick="verDetalle(${act.id})">Ver detalles</button>
                ${botones}
            </div>
        `;
        cargarInstructores(act.id);
        cargarResumenReseñaActividad(act.id);
    }

    if (paginadas.length === 0) {
        contenedor.innerHTML = '<div class="emptyState">No hay actividades registradas</div>';
    }

    const paginaInfo = document.getElementById('paginaInfo');
    const btnAnterior = document.getElementById('btnAnterior');
    const btnSiguiente = document.getElementById('btnSiguiente');

    if (paginaInfo) paginaInfo.innerText = `Página ${paginaActual}`;
    if (btnAnterior) btnAnterior.disabled = paginaActual === 1;
    if (btnSiguiente) btnSiguiente.disabled = paginaActual === totalPaginas || totalPaginas === 0;

    actualizarPaginacionNumeros(paginaActual, totalPaginas);
}

function actualizarPaginacionNumeros(paginaRef, totalPaginas) {
    const contenedor = document.getElementById('paginacionNumeros');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    if (totalPaginas <= 1) return;
    let inicio = Math.max(1, paginaRef - 2);
    let fin = Math.min(totalPaginas, inicio + 4);
    if (fin - inicio < 4 && inicio > 1) {
        inicio = Math.max(1, fin - 4);
    }
    for (let i = inicio; i <= fin; i++) {
        const btn = document.createElement('button');
        btn.innerText = i;
        btn.className = 'paginacion-numero';
        if (i === paginaRef) btn.classList.add('active');
        btn.addEventListener('click', () => {
            paginaActual = i;
            renderActividades(document.getElementById("busqueda")?.value || "");
        });
        contenedor.appendChild(btn);
    }
    const inputPagina = document.getElementById('irAPagina');
    const btnIr = document.getElementById('btnIrPagina');
    if (btnIr && inputPagina) {
        btnIr.onclick = () => {
            const num = parseInt(inputPagina.value);
            if (num >= 1 && num <= totalPaginas) {
                paginaActual = num;
                renderActividades(document.getElementById("busqueda")?.value || "");
                inputPagina.value = '';
            }
        };
    }
}

function configurarPaginacion() {
    const btnAnterior = document.getElementById('btnAnterior');
    const btnSiguiente = document.getElementById('btnSiguiente');
    if (btnAnterior) {
        btnAnterior.addEventListener('click', () => {
            if (paginaActual > 1) {
                paginaActual--;
                renderActividades(document.getElementById("busqueda")?.value || "");
            }
        });
    }
    if (btnSiguiente) {
        btnSiguiente.addEventListener('click', () => {
            paginaActual++;
            renderActividades(document.getElementById("busqueda")?.value || "");
        });
    }
}

function activarBusqueda() {
    const input = document.getElementById("busqueda");
    if (input) {
        input.addEventListener("input", () => {
            paginaActual = 1;
            renderActividades(input.value);
        });
    }
}

async function cargarInstructores(actividadId) {
    try {
        const res = await apiRequest(`${API_URL}/actividades/${actividadId}/instructores`);
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
        const res = await apiRequest(`${API_URL}/actividades/${actividadId}/asignar-instructor`, {
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

async function inscribirseActividad(actividadId) {
    if (!loggedUser) return alert('Debes iniciar sesión');
    try {
        const res = await apiRequest(`${API_URL}/actividades/${actividadId}/inscribirse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ socio_id: usuarioId })
        });
        const data = await res.json();
        if (res.ok) {
            alert('Inscripción exitosa');
            renderActividades(document.getElementById("busqueda")?.value || "");
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

function editarActividad(id) {
    window.location.href = `actividades-form.html?id=${id}`;
}

async function eliminarActividad(id) {
    if (rol !== 'admin' && rol !== 'instructor') {
        alert('No tienes permiso para eliminar actividades');
        return;
    }
    const password = rol === 'admin' ? prompt('Ingresa tu contraseña de administrador:') : null;
    if (rol === 'admin' && !password) return;
    if (!confirm('¿Estás seguro de eliminar esta actividad?')) return;
    try {
        const body = rol === 'admin'
            ? { admin_id: usuarioId, password }
            : { usuario_id: usuarioId };
        const res = await apiRequest(`${API_URL}/actividades/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
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

function configurarBotonCrear() {
    const btnCrear = document.getElementById("btnCrear");
    if (!btnCrear) return;
    if (rol === 'admin' || rol === 'instructor') {
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
        configurarPaginacion();
    }
});

// ===== FORMULARIO (crear/editar) =====
async function guardarActividad(event) {
    event.preventDefault();
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const nombre = document.getElementById('nombre').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const capacidad = parseInt(document.getElementById('capacidad').value);
    const icono = '';
    const nivel = document.getElementById('nivel').value;
    const selDur = document.getElementById('duracion');
    const duracion = selDur.value === 'personalizado'
        ? document.getElementById('duracionPersonalizada').value.trim()
        : selDur.value + ' min';
    const equipo = document.getElementById('equipo').checked;

    if (!nombre || !capacidad) {
        alert('Nombre y capacidad son obligatorios');
        return;
    }

    const data = {
        nombre, descripcion, capacidad, icono, nivel, duracion, equipo,
        tipo_actividad_id: document.getElementById('tipo_actividad').value,
        usuario_id: loggedUser.id   // IMPORTANTE: para saber quién crea
    };

    try {
        const url = id ? `${API_URL}/actividades/${id}` : `${API_URL}/actividades`;
        const method = id ? 'PUT' : 'POST';
        const res = await apiRequest(url, {
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
    const btnGuardar = document.querySelector('.btn-guardar');
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.textContent = 'Cargando...';
    }
    try {
        const res = await apiRequest(`${API_URL}/actividades/${id}`);
        if (!res.ok) throw new Error('No se pudo obtener la actividad');
        const actividad = await res.json();
        document.getElementById('nombre').value = actividad.nombre || '';
        document.getElementById('descripcion').value = actividad.descripcion || '';
        document.getElementById('capacidad').value = actividad.capacidad || 10;
        document.getElementById('nivel').value = actividad.nivel || 'Principiante';
        const duracionValue = String(actividad.duracion || '60').replace(' min', '').trim();
        const selectDuracion = document.getElementById('duracion');
        selectDuracion.value = duracionValue;
        if (!selectDuracion.value) {
            selectDuracion.value = 'personalizado';
            const inputCustom = document.getElementById('duracionPersonalizada');
            if (inputCustom) {
                inputCustom.style.display = 'block';
                inputCustom.value = actividad.duracion || '';
            }
        }
        document.getElementById('equipo').checked = actividad.equipo === true;
        const selectTipo = document.getElementById('tipo_actividad');
        if (selectTipo && actividad.tipo_actividad_id) {
            selectTipo.value = actividad.tipo_actividad_id;
        }
    } catch (error) {
        console.error(error);
        alert('Error al cargar los datos de la actividad');
    } finally {
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
        const selDur = document.getElementById('duracion');
    }
});

// ===== DETALLE =====
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
        const resAct = await apiRequest(`${API_URL}/actividades/${id}`);
        if (!resAct.ok) throw new Error();
        const a = await resAct.json();
        const resIns = await apiRequest(`${API_URL}/actividades/${id}/instructores`);
        const instructores = await resIns.json();
        const inscritos = a.inscritos || 0;
        const capacidad = a.capacidad || 1;
        const porcentaje = capacidad > 0 ? (inscritos / capacidad) * 100 : 0;
        let colorBarra = "verde";
        if (porcentaje >= 100) colorBarra = "rojo";
        else if (porcentaje >= 70) colorBarra = "naranja";
        contenedor.innerHTML = `
            <div class="detalle-header">
                <div class="detalle-icono">${a.icono && a.icono.trim() ? a.icono : '🏃'}</div>
                <h1>${a.nombre}</h1>
                <span class="card-icono">${a.nivel || 'Principiante'}</span>
            </div>
            <div class="detalle-info">
                <div class="info-item">
                    <span class="info-label">Descripción</span>
                    <span class="info-value">${a.descripcion || "Sin descripción"}</span>
                </div>
                <div class="info-row">
                    <div class="info-item">
                        <span class="info-label">Capacidad</span>
                        <span class="info-value">${inscritos} / ${capacidad} inscritos</span>
                        <div class="barra-detalle">
                            <div class="progreso ${colorBarra}" style="width:${Math.min(porcentaje, 100)}%"></div>
                        </div>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Duración</span>
                        <p><strong>Duración:</strong> ${formatearDuracion(parseInt(a.duracion || '60'))}</p>
                    </div>
                </div>
                <div class="info-row">
                    <div class="info-item">
                        <span class="info-label">Equipo especial</span>
                        <span class="info-value">${a.equipo ? "✔ Requerido" : "No requerido"}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Instructores</span>
                        <span class="info-value">${instructores.length === 0 ? "Sin asignar" : instructores.map(i => i.nombre).join(", ")}</span>
                    </div>
                </div>
            </div>
            <div class="detalle-acciones">
                <button class="btn-volver" onclick="window.location.href='actividades.html'">← Volver a Actividades</button>
            </div>
        `;
    } catch (error) {
        contenedor.innerHTML = `<div style="text-align:center;padding:40px;"><p>Error al cargar detalles</p></div>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("detalleActividad")) {cargarDetalle();}
    if (document.getElementById('seccionReseñas')) cargarReseñasActividad();
});
async function cargarResumenReseñaActividad(actId) {
    try {
        const res = await apiRequest(`${API_URL}/resenas/resumen?tipo=actividad&referencia_id=${actId}`);
        const data = await res.json();
        const promedio = parseFloat(data.promedio) || 0;
        const total = parseInt(data.total) || 0;
        const el = document.getElementById(`resumen-act-${actId}`);
        if (!el) return;
        if (total === 0) { el.textContent = 'Sin reseñas aún'; el.style.color = 'rgba(255,255,255,0.3)'; return; }
        el.innerHTML = `${'★'.repeat(Math.round(promedio))}${'☆'.repeat(5 - Math.round(promedio))} <span style="color:rgba(255,255,255,0.5)">${promedio} (${total})</span>`;
    } catch(e) {}
}

async function cargarReseñasActividad() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id || !document.getElementById('seccionReseñas')) return;

    const esSocio = loggedUser.rol === 'socio';

    try {
        const res = await apiRequest(`${API_URL}/resenas/resumen?tipo=actividad&referencia_id=${id}`);
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

    if (esSocio) {
        try {
            const puedeRes = await apiRequest(`${API_URL}/resenas/puedo-calificar?tipo=actividad&referencia_id=${id}&usuario_id=${loggedUser.id}`);
            const { puede } = await puedeRes.json();
            const form = document.getElementById('formularioReseña');
            if (!puede) {
                form.innerHTML = `<p style="color:rgba(255,255,255,0.3); font-size:13px;">Solo puedes calificar actividades en las que estás inscrito.</p>`;
                return;
            }
            const miaRes = await apiRequest(`${API_URL}/resenas/mia?tipo=actividad&referencia_id=${id}&usuario_id=${loggedUser.id}`);
            const mia = await miaRes.json();
            if (mia) {
                const estrellasMia = '★'.repeat(mia.estrellas) + '☆'.repeat(5 - mia.estrellas);
                form.innerHTML = `
                    <div style="background:rgba(84,207,224,0.08); border:1px solid rgba(84,207,224,0.2); border-radius:12px; padding:16px;">
                        <p style="color:rgba(255,255,255,0.5); font-size:13px; margin-bottom:8px;">Tu reseña</p>
                        <div style="color:#f5c518; font-size:20px;">${estrellasMia}</div>
                        <p style="margin-top:8px; font-size:14px;">${mia.comentario || 'Sin comentario'}</p>
                    </div>`;
            } else {
                form.innerHTML = `
                    <div style="margin-top:8px;">
                        <p style="font-size:14px; color:rgba(255,255,255,0.6); margin-bottom:12px;">¿Cómo calificarías esta actividad?</p>
                        <div id="starSelector" style="display:flex; gap:8px; font-size:28px; cursor:pointer; margin-bottom:12px;">
                            ${[1,2,3,4,5].map(n => `<span data-val="${n}" style="color:rgba(255,255,255,0.2); transition:color 0.15s;">★</span>`).join('')}
                        </div>
                        <input type="hidden" id="estrellasSeleccionadas" value="0">
                        <textarea id="comentarioReseña" placeholder="Comentario (opcional)" style="width:100%; padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.4); color:white; font-size:14px; resize:vertical; min-height:80px; box-sizing:border-box;"></textarea>
                        <button id="enviarReseñaBtn" style="margin-top:12px; max-width:180px;">Enviar reseña</button>
                        <p id="reseñaMsg" style="font-size:13px; margin-top:8px;"></p>
                    </div>`;
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
                        const r = await apiRequest(`${API_URL}/resenas`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tipo: 'actividad', referencia_id: parseInt(id), usuario_id: loggedUser.id, estrellas, comentario })
                        });
                        if (r.ok) { cargarReseñasActividad(); }
                        else { const d = await r.json(); msg.style.color = '#ff6b6b'; msg.textContent = d.error || 'Error'; }
                    } catch(e) { msg.style.color = '#ff6b6b'; msg.textContent = 'Error de conexión'; }
                });
            }
        } catch(e) { console.error('Error reseñas:', e); }
    }
}