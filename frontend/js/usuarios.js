const API_URL = '/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

// Variables de paginacion
let paginaActual = 1;
const usuariosPorPagina = 15;

if (!loggedUser) {
    window.location.href = 'index.html';
}

document.getElementById('logoutBtn').addEventListener('click', logout);

cargarTodosLosUsuarios();

document.getElementById('searchBtn').addEventListener('click', buscarSocios);
document.getElementById('resetBtn').addEventListener('click', function () {
    document.getElementById('searchInput').value = '';
    paginaActual = 1;
    cargarTodosLosUsuarios();
});
document.getElementById('searchInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') buscarSocios();
});

/* ===== CARGAR USUARIOS CON PAGINACION ===== */
async function cargarTodosLosUsuarios() {
    try {
        const res = await fetch(API_URL + `/usuarios/except/${loggedUser.id}?page=${paginaActual}&limit=${usuariosPorPagina}`);
        const data = await res.json();
        
        const usuarios = data.usuarios || [];
        const paginacion = data.paginacion || {};

        if (!usuarios.length) {
            document.getElementById('userList').innerHTML = '<div class="emptyState">No hay usuarios registrados.</div>';
            return;
        }

        let html = `
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr>
                            <th style="padding:8px 10px; text-align:left;">No. Accion</th>
                            <th style="padding:8px 10px; text-align:left;">Nombre</th>
                            <th style="padding:8px 10px; text-align:left;">Email</th>
                            <th style="padding:8px 10px; text-align:left;">Telefono</th>
                            <th style="padding:8px 10px; text-align:left;">Tipo</th>
                            <th style="padding:8px 10px; text-align:center;">Estado</th>
                            <th style="padding:8px 10px; text-align:center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${usuarios.map(u => `
                            <tr data-user-id="${u.id}" style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                <td style="padding:10px; color:rgba(255,255,255,0.7); font-weight:500;">${u.numero_accion || '—'}</td>
                                <td style="padding:10px; font-weight:500;">${u.nombre || '—'} ${u.apellido || ''}</td>
                                <td style="padding:10px; color:rgba(255,255,255,0.7);">${u.email || '—'}</td>
                                <td style="padding:10px;">${u.telefono || '—'}</td>
                                <td style="padding:10px;">
                                    <span style="background:rgba(14,104,115,0.2); color:#54cfe0; border-radius:20px; padding:3px 10px; font-size:11px;">
                                        ${u.tipo_accion || u.rol || '—'}
                                    </span>
                                </td>
                                <td style="padding:10px; text-align:center;">
                                    <span style="background:${u.activo ? 'rgba(14,104,115,0.15)' : 'rgba(228,32,27,0.15)'}; color:${u.activo ? '#54cfe0' : '#ff6b6b'}; border-radius:20px; padding:3px 10px; font-size:11px;">
                                        ${u.activo ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                                <td style="padding:10px; text-align:center; white-space: nowrap;">
                                    <button class="editBtn" style="margin-right:6px;">Editar</button>
                                    <button class="deleteBtn">Eliminar</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; gap: 12px; flex-wrap: wrap;">
                <div style="color: rgba(255,255,255,0.5); font-size: 13px;">
                    Mostrando ${usuarios.length} de ${paginacion.totalRegistros || usuarios.length} usuarios
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="prevPageBtn" class="secondaryBtn" style="min-width: auto; padding: 8px 16px;" ${!paginacion.hasPrev ? 'disabled' : ''}>
                        Anterior
                    </button>
                    <span style="background: rgba(255,255,255,0.08); padding: 8px 16px; border-radius: 8px;">
                        Pagina ${paginacion.currentPage || paginaActual} de ${paginacion.totalPages || 1}
                    </span>
                    <button id="nextPageBtn" class="secondaryBtn" style="min-width: auto; padding: 8px 16px;" ${!paginacion.hasNext ? 'disabled' : ''}>
                        Siguiente
                    </button>
                </div>
            </div>`;

        document.getElementById('userList').innerHTML = html;

        document.getElementById('prevPageBtn')?.addEventListener('click', () => {
            if (paginaActual > 1) {
                paginaActual--;
                cargarTodosLosUsuarios();
            }
        });

        document.getElementById('nextPageBtn')?.addEventListener('click', () => {
            paginaActual++;
            cargarTodosLosUsuarios();
        });

        document.querySelectorAll('.editBtn').forEach(btn => {
            btn.addEventListener('click', function() {
                editarUsuario(this.closest('tr').dataset.userId);
            });
        });

        document.querySelectorAll('.deleteBtn').forEach(btn => {
            btn.addEventListener('click', function() {
                confirmarEliminar(this.closest('tr').dataset.userId);
            });
        });

    } catch (error) {
        console.error(error);
        document.getElementById('userList').innerHTML = '<div class="emptyState">Error al cargar usuarios.</div>';
    }
}

/* ===== BUSCAR SOCIOS ===== */
async function buscarSocios() {
    const termino = document.getElementById('searchInput').value.trim();
    if (!termino) {
        paginaActual = 1;
        return cargarTodosLosUsuarios();
    }

    try {
        const res = await fetch(API_URL + '/socios/buscar?q=' + encodeURIComponent(termino));
        const socios = await res.json();

        if (!socios.length) {
            document.getElementById('userList').innerHTML = '<div class="emptyState">No se encontraron socios.</div>';
            return;
        }

        let html = `
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr>
                            <th style="padding:8px 10px;">No. Accion</th>
                            <th style="padding:8px 10px;">Nombre</th>
                            <th style="padding:8px 10px;">Email</th>
                            <th style="padding:8px 10px;">Telefono</th>
                            <th style="padding:8px 10px;">Tipo</th>
                            <th style="padding:8px 10px;">Estatus</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${socios.map(s => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                <td style="padding:10px;">${s.numero_accion || s.id}</td>
                                <td style="padding:10px; font-weight:500;">${s.nombre || '—'} ${s.apellido || ''}</td>
                                <td style="padding:10px;">${s.email || '—'}</td>
                                <td style="padding:10px;">${s.telefono || '—'}</td>
                                <td style="padding:10px;">${s.tipo_accion || '—'}</td>
                                <td style="padding:10px;">${s.estatus_accion || '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
        document.getElementById('userList').innerHTML = html;
    } catch (error) {
        console.error(error);
        document.getElementById('userList').innerHTML = '<div class="emptyState">Error en la busqueda.</div>';
    }
}

/* ===== EDITAR USUARIO ===== */
async function editarUsuario(id) {
    const res = await fetch(API_URL + '/usuarios/' + id);
    const u = await res.json();

    document.getElementById('editId').value       = u.id;
    document.getElementById('editNombre').value   = u.nombre   || '';
    document.getElementById('editApellido').value = u.apellido || '';  
    document.getElementById('editEmail').value    = u.email    || '';
    document.getElementById('editTelefono').value = u.telefono || '';

    document.getElementById('editPanel').style.display    = 'block';
    document.getElementById('modalBackdrop').style.display = 'block';
}

async function guardarCambios() {
    const id = document.getElementById('editId').value;
    const data = {
        nombre:   document.getElementById('editNombre').value,
        apellido: document.getElementById('editApellido').value,
        email:    document.getElementById('editEmail').value,
        telefono: document.getElementById('editTelefono').value
    };

    await fetch(API_URL + '/usuarios/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    cerrarEditar();
    paginaActual = 1;
    cargarTodosLosUsuarios();
}

function cerrarEditar() {
    document.getElementById('editPanel').style.display    = 'none';
    document.getElementById('modalBackdrop').style.display = 'none';
}

function cerrarTodo() {
    cerrarEditar();
    cerrarEliminar();
}

/* ===== ELIMINAR USUARIO ===== */
let usuarioAEliminar = null;

function confirmarEliminar(id) {
    usuarioAEliminar = id;
    document.getElementById('deletePassword').value        = '';
    document.getElementById('deletePanel').style.display   = 'block';
    document.getElementById('modalBackdrop').style.display = 'block';
}

function cerrarEliminar() {
    usuarioAEliminar = null;
    document.getElementById('deletePanel').style.display   = 'none';
    document.getElementById('modalBackdrop').style.display = 'none';
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async function () {
    const password = document.getElementById('deletePassword').value;

    if (!password) {
        alert('Ingresa la contrasena');
        return;
    }

    try {
        const res = await fetch(API_URL + '/usuarios/' + usuarioAEliminar + '/seguro', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_id: loggedUser.id,
                password: password
            })
        });

        if (res.ok) {
            alert('Usuario eliminado correctamente');
            cerrarEliminar();
            paginaActual = 1;
            cargarTodosLosUsuarios();
        } else {
            const data = await res.json();
            alert(JSON.stringify(data));
        }

    } catch (error) {
        console.error(error);
        alert('Error de conexion');
    }
});

const importarSocios = async (archivo) => {
    const modal = document.getElementById('importModal');
    const statusEl = document.getElementById('importStatus');
    const progressEl = document.getElementById('importProgress');
    const closeBtn = document.getElementById('closeImportBtn');
    
    modal.style.display = 'flex';
    statusEl.innerText = 'Procesando archivo...';
    progressEl.innerHTML = `
        <div style="text-align: center;">
            <div style="background: #1a1a2e; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
                <div id="progressBar" style="width: 0%; height: 8px; background: #4caf50; transition: width 0.3s;"></div>
            </div>
            <p id="progressText">Leyendo archivo... esto puede tomar varios minutos</p>
        </div>
    `;
    closeBtn.style.display = 'none';
    
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('admin_id', loggedUser.id);
    
    // Simular progreso visual mientras espera
    let progressValue = 0;
    const progressInterval = setInterval(() => {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        if (progressBar && progressText && progressValue < 90) {
            progressValue += 5;
            progressBar.style.width = progressValue + '%';
            progressText.innerText = 'Procesando en el servidor... ' + progressValue + '%';
        }
    }, 3000);
    
    try {
        const response = await fetch(API_URL + '/socios/importar-excel', {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.width = '100%';
        
        const resultado = await response.json();
        
        if (response.ok) {
            statusEl.innerText = 'Importacion completada';
            
            let html = `
                <div style="background: #1a2a1a; padding: 12px; border-radius: 8px; margin-top: 8px;">
                    <p><strong>Resumen:</strong></p>
                    <p>Total grupos: ${resultado.total_grupos || 0}</p>
                    <p>Insertados: ${resultado.insertados || 0}</p>
                    <p>Omitidos: ${resultado.omitidos || 0}</p>
                    <p>Errores: ${resultado.errores || 0}</p>
                </div>
            `;
            
            if (resultado.credenciales && resultado.credenciales.length > 0) {
                const mostrarLimite = Math.min(resultado.credenciales.length, 30);
                html += `
                    <div style="background: #0d1a2a; padding: 16px; border-radius: 8px; margin-top: 16px; border-left: 3px solid #4caf50;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                            <p style="margin: 0;"><strong>Contrasenas temporales</strong> (${resultado.credenciales.length} nuevas)</p>
                            <button id="copyPasswordsBtn" style="background: rgba(84,207,224,0.2); border: 1px solid rgba(84,207,224,0.3); color: #54cfe0; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin: 0;">
                                Copiar todas
                            </button>
                        </div>
                        <div style="max-height: 250px; overflow-y: auto; font-size: 11px;">
                            <table style="width:100%; border-collapse:collapse;">
                                <thead>
                                    <tr><th style="padding:6px 4px;">No. Accion</th><th style="padding:6px 4px;">Nombre</th><th style="padding:6px 4px;">Email</th><th style="padding:6px 4px;">Contrasena</th></tr>
                                </thead>
                                <tbody>
                                    ${resultado.credenciales.slice(0, mostrarLimite).map(c => `
                                        <tr>
                                            <td style="padding:6px 4px;">${c.numero_accion || '—'}</td>
                                            <td style="padding:6px 4px;">${c.nombre ? c.nombre.substring(0, 30) : '—'}</td>
                                            <td style="padding:6px 4px;">${c.email || '—'}</td>
                                            <td style="padding:6px 4px;"><code style="background:#1a1a2e; padding:2px 6px; border-radius:4px;">${c.contrasena}</code></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        ${resultado.credenciales.length > mostrarLimite ? `<p class="mt-2 text-muted">... y ${resultado.credenciales.length - mostrarLimite} mas</p>` : ''}
                    </div>
                `;
            }
            
            if (resultado.detalle && resultado.detalle.length > 0) {
                const erroresLista = resultado.detalle.filter(d => !d.exito);
                if (erroresLista.length > 0) {
                    html += `
                        <details style="margin-top: 16px;">
                            <summary style="cursor: pointer; color: #ff9800;">Errores / Omitidos (${erroresLista.length})</summary>
                            <pre style="font-size: 11px; max-height: 200px; overflow: auto; background: #1a0d0d; padding: 8px; border-radius: 6px; margin-top: 8px;">${JSON.stringify(erroresLista.slice(0, 50), null, 2)}</pre>
                        </details>
                    `;
                }
            }
            
            progressEl.innerHTML = html;
            
            setTimeout(() => {
                const copyBtn = document.getElementById('copyPasswordsBtn');
                if (copyBtn) {
                    copyBtn.addEventListener('click', () => {
                        let texto = 'Numero Accion\tNombre\tEmail\tContrasena\n';
                        resultado.credenciales.forEach(c => {
                            texto += `${c.numero_accion || '—'}\t${(c.nombre || '—').replace(/\t/g, ' ')}\t${c.email || '—'}\t${c.contrasena}\n`;
                        });
                        navigator.clipboard.writeText(texto);
                        const original = copyBtn.innerText;
                        copyBtn.innerText = 'Copiado';
                        setTimeout(() => { copyBtn.innerText = original; }, 2000);
                    });
                }
            }, 100);
            
            setTimeout(() => {
                paginaActual = 1;
                cargarTodosLosUsuarios();
            }, 2000);
            
        } else {
            statusEl.innerText = 'Error en importacion';
            progressEl.innerHTML = `<div style="color: #ff6b6b; padding: 16px;">${resultado.error || 'Error desconocido'}</div>`;
        }
        
        closeBtn.style.display = 'block';
        
    } catch (error) {
        clearInterval(progressInterval);
        console.error('Error:', error);
        statusEl.innerText = 'Error de conexion';
        progressEl.innerHTML = `<div style="color: #ff6b6b; padding: 16px;">${error.message}</div>`;
        closeBtn.style.display = 'block';
    }
};

/* ===== CONFIGURAR BOTON DE IMPORTAR ===== */
const setupImportButton = () => {
    const fileInput = document.getElementById('excelUploadInput');
    if (!fileInput) {
        console.error('No se encontro el input con id "excelUploadInput"');
        return;
    }
    
    console.log('Boton de importacion configurado');
    
    fileInput.addEventListener('change', async (event) => {
        const archivo = event.target.files[0];
        if (!archivo) return;
        
        console.log('Archivo seleccionado:', archivo.name);
        
        const extension = archivo.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls'].includes(extension)) {
            alert('Solo se permiten archivos .xlsx o .xls');
            fileInput.value = '';
            return;
        }
        
        if (archivo.size > 50 * 1024 * 1024) {
            alert('El archivo no debe superar los 50 MB');
            fileInput.value = '';
            return;
        }
        
        const confirmar = confirm(`Importar socios desde "${archivo.name}"?\n\nEsto agregara nuevos socios a la base de datos.`);
        if (!confirmar) {
            fileInput.value = '';
            return;
        }
        
        await importarSocios(archivo);
        fileInput.value = '';
    });
};

/* ===== EXPORTAR SOCIOS A EXCEL ===== */
const exportarSocios = async () => {
    try {
        const response = await fetch(API_URL + '/socios/exportar-excel');
        
        if (!response.ok) {
            throw new Error('Error al exportar');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fecha = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = `socios_${fecha}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        alert('Exportacion completada');
        
    } catch (error) {
        console.error('Error al exportar:', error);
        alert('Error al exportar socios');
    }
};

/* ===== CERRAR MODAL IMPORTACION ===== */
window.cerrarImportModal = () => {
    const modal = document.getElementById('importModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

/* ===== INICIALIZAR BOTONES ===== */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupImportButton();
        const exportarBtn = document.getElementById('exportarBtn');
        if (exportarBtn) {
            exportarBtn.addEventListener('click', exportarSocios);
        }
    });
} else {
    setupImportButton();
    const exportarBtn = document.getElementById('exportarBtn');
    if (exportarBtn) {
        exportarBtn.addEventListener('click', exportarSocios);
    }
}

/* ===== LOGOUT ===== */
function logout() {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
}