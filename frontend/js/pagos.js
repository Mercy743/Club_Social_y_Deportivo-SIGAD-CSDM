const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) window.location.href = 'index.html';

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
});

// Fecha de hoy por defecto
document.getElementById('fechaPago').valueAsDate = new Date();

let todosPagos = [];

// ===== CARGAR PAGOS =====
async function cargarPagos() {
    try {
        const res   = await fetch(API_URL + '/pagos');
        todosPagos  = await res.json();
        actualizarResumen(todosPagos);
        renderPagos(todosPagos);
    } catch (err) {
        console.error(err);
        document.getElementById('pagosList').innerHTML =
            '<div class="emptyState">Error al cargar pagos.</div>';
    }
}

// ===== RESUMEN =====
function actualizarResumen(pagos) {
    const hoy = new Date().toISOString().split('T')[0];

    document.getElementById('totalPagos').textContent = pagos.length;

    const total = pagos.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0);
    document.getElementById('totalMonto').textContent =
        '$' + total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const hoyCount = pagos.filter(p => p.fecha && p.fecha.startsWith(hoy)).length;
    document.getElementById('pagosHoy').textContent = hoyCount;

    const pendientes = pagos.filter(p => p.estado === 'pendiente').length;
    document.getElementById('pagosPendientes').textContent = pendientes;
}

// ===== RENDER TABLA =====
function renderPagos(pagos) {
    if (!pagos.length) {
        document.getElementById('pagosList').innerHTML =
            '<div class="emptyState">No hay pagos registrados.</div>';
        return;
    }

    const colores = {
        pagado:    { bg: 'rgba(14,104,115,0.15)',  color: '#54cfe0' },
        pendiente: { bg: 'rgba(254,126,60,0.15)',  color: '#FE7E3C' },
        cancelado: { bg: 'rgba(228,32,27,0.15)',   color: '#ff6b6b' }
    };

    document.getElementById('pagosList').innerHTML = `
        <div style="overflow-x: auto;">
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr>
                        ${['#','Usuario ID','Monto','Fecha','Método','Estado'].map(h => `
                            <th style="padding:12px 16px; text-align:left; border-bottom:1px solid rgba(255,255,255,0.08);
                                color:rgba(255,255,255,0.4); font-size:11px; letter-spacing:1px; text-transform:uppercase; white-space:nowrap;">
                                ${h}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${pagos.map((p, i) => {
                        const c = colores[p.estado] || colores.pendiente;
                        return `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                            <td style="padding:12px 16px; color:rgba(255,255,255,0.35); font-size:13px;">${i + 1}</td>
                            <td style="padding:12px 16px; color:white; font-weight:600; font-size:14px;">${p.usuario_id}</td>
                            <td style="padding:12px 16px; color:#54cfe0; font-size:14px; font-weight:600;">
                                $${parseFloat(p.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </td>
                            <td style="padding:12px 16px; color:rgba(255,255,255,0.6); font-size:13px;">
                                ${formatearFecha(p.fecha)}
                            </td>
                            <td style="padding:12px 16px; color:rgba(255,255,255,0.6); font-size:13px; text-transform:capitalize;">
                                ${p.metodo_pago || '—'}
                            </td>
                            <td style="padding:12px 16px;">
                                <span style="background:${c.bg}; color:${c.color}; border-radius:20px;
                                    padding:3px 12px; font-size:11px; font-weight:600; text-transform:capitalize;">
                                    ${p.estado || '—'}
                                </span>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}

// ===== REGISTRAR PAGO =====
document.getElementById('guardarPagoBtn').addEventListener('click', async () => {
    const usuario_id  = document.getElementById('usuarioId').value.trim();
    const monto       = document.getElementById('monto').value.trim();
    const fecha       = document.getElementById('fechaPago').value;
    const metodo_pago = document.getElementById('metodoPago').value;
    const estado      = document.getElementById('estadoPago').value;

    if (!usuario_id || !monto || !fecha) {
        alert('Usuario, monto y fecha son obligatorios.');
        return;
    }

    const btn = document.getElementById('guardarPagoBtn');
    btn.disabled    = true;
    btn.textContent = 'Guardando...';

    try {
        const res = await fetch(API_URL + '/pagos', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ usuario_id, monto, fecha, metodo_pago, estado })
        });

        if (!res.ok) throw new Error('Error al registrar');

        document.getElementById('usuarioId').value = '';
        document.getElementById('monto').value     = '';
        document.getElementById('fechaPago').valueAsDate = new Date();

        await cargarPagos();

    } catch (err) {
        console.error(err);
        alert('Error al registrar el pago.');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Registrar pago';
    }
});

// ===== FILTROS =====
document.getElementById('filtrarBtn').addEventListener('click', () => {
    const usuario = document.getElementById('filtroUsuario').value.trim();
    const estado  = document.getElementById('filtroEstado').value;

    let filtrados = todosPagos;

    if (usuario) {
        filtrados = filtrados.filter(p => String(p.usuario_id) === usuario);
    }
    if (estado) {
        filtrados = filtrados.filter(p => p.estado === estado);
    }

    actualizarResumen(filtrados);
    renderPagos(filtrados);
});

document.getElementById('resetFiltroBtn').addEventListener('click', () => {
    document.getElementById('filtroUsuario').value = '';
    document.getElementById('filtroEstado').value  = '';
    actualizarResumen(todosPagos);
    renderPagos(todosPagos);
});

// ===== HELPERS =====
function formatearFecha(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ===== INIT =====
cargarPagos();