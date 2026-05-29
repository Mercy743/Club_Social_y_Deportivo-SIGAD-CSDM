const API_URL = '/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

if (loggedUser.rol !== 'admin') {
    alert('Acceso denegado. Solo administradores pueden ver estadisticas.');
    window.location.href = 'dashboard.html';
}

let charts = {};

// Configuracion base para graficas
const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                color: 'rgba(255,255,255,0.7)',
                font: { size: 11 }
            }
        }
    }
};

const barOptions = {
    ...chartOptions,
    scales: {
        y: { 
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: 'rgba(255,255,255,0.5)' }
        },
        x: {
            ticks: { color: 'rgba(255,255,255,0.5)' }
        }
    }
};

async function cargarEstadisticas() {
    try {
        const response = await apiRequest(API_URL + '/estadisticas');
        const data = await response.json();

        const basics = data.basics || data;
        
        // Formatear números
        document.getElementById('totalSocios').innerText = (basics.socios || 0).toLocaleString();
        document.getElementById('totalInstructores').innerText = (basics.instructores || 0).toLocaleString();
        document.getElementById('totalEventos').innerText = (basics.eventos || 0).toLocaleString();
        
        const totalIngresos = basics.ingresosTotales || 0;

        const sociosPorTipo = data.sociosPorTipo || [];
        const sociosPorEstatus = data.sociosPorEstatus || [];
        const actividadesPopulares = data.actividadesPopulares || [];

        // Grafica 1: Doughnut - Socios por tipo
        if (charts.tipoAccion) charts.tipoAccion.destroy();
        charts.tipoAccion = new Chart(document.getElementById('tipoAccionChart'), {
            type: 'doughnut',
            data: {
                labels: sociosPorTipo.map(item => item.tipo_accion || 'Otros'),
                datasets: [{
                    data: sociosPorTipo.map(item => parseInt(item.total)),
                    backgroundColor: ['#54cfe0', '#0E6873', '#FE7E3C', '#4caf50'],
                    borderWidth: 0
                }]
            },
            options: chartOptions
        });

        // Grafica 2: Pie - Socios por estatus
        if (charts.estatusAccion) charts.estatusAccion.destroy();
        charts.estatusAccion = new Chart(document.getElementById('estatusAccionChart'), {
            type: 'pie',
            data: {
                labels: sociosPorEstatus.map(item => item.estatus_accion || 'Otros'),
                datasets: [{
                    data: sociosPorEstatus.map(item => parseInt(item.total)),
                    backgroundColor: ['#4caf50', '#ff9800', '#2196f3', '#9c27b0'],
                    borderWidth: 0
                }]
            },
            options: chartOptions
        });

        // Grafica 3: Actividades populares (top 10 del endpoint)
        if (charts.actividades) charts.actividades.destroy();

        if (actividadesPopulares.length === 0) {
            const container = document.getElementById('actividadesChart').parentElement;
            container.innerHTML = '<div style="text-align:center; padding:40px;">No hay actividades con inscritos</div>';
        } else {
            charts.actividades = new Chart(document.getElementById('actividadesChart'), {
                type: 'bar',
                data: {
                    labels: actividadesPopulares.map(item => {
                        let nombre = item.nombre || 'Sin nombre';
                        return nombre.length > 20 ? nombre.substring(0, 18) + '...' : nombre;
                    }),
                    datasets: [{
                        label: 'Inscritos',
                        data: actividadesPopulares.map(item => parseInt(item.inscritos || 0)),
                        backgroundColor: '#54cfe0',
                        borderRadius: 6,
                        barPercentage: 0.7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'top', labels: { color: 'white', font: { size: 10 } } }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: 'rgba(255,255,255,0.6)', stepSize: 1 }
                        },
                        x: {
                            ticks: { 
                                color: 'rgba(255,255,255,0.6)', 
                                rotation: 25,
                                maxRotation: 35,
                                autoSkip: true,
                                font: { size: 10 }
                            }
                        }
                    }
                }
            });
        };
    } catch (error) {
        console.error('Error cargando estadisticas:', error);
    }
}
cargarEstadisticas();
setInterval(cargarEstadisticas, 30000);

/* ===== RESEÑAS ADMIN ===== */
async function cargarOpcionesReferencia() {
    const tipo = document.getElementById('filtroTipoReseña').value;
    const select = document.getElementById('filtroReferenciaReseña');
    select.innerHTML = '<option value="">Cargando...</option>';
    try {
        const endpoint = tipo === 'actividad' ? '/actividades' : '/torneos';
        const res = await apiRequest(API_URL + endpoint);
        const data = await res.json();
        select.innerHTML = '<option value="">Selecciona...</option>';
        data.forEach(item => {
            select.innerHTML += `<option value="${item.id}">${item.nombre}</option>`;
        });
    } catch(e) {
        select.innerHTML = '<option value="">Error al cargar</option>';
    }
}

async function cargarReseñasAdmin() {
    const tipo = document.getElementById('filtroTipoReseña').value;
    const referenciaId = document.getElementById('filtroReferenciaReseña').value;
    const filtro = document.getElementById('filtroSentimiento').value;
    const lista = document.getElementById('listaReseñasAdmin');
    const resumen = document.getElementById('resumenReseñasAdmin');

    if (!referenciaId) {
        lista.innerHTML = '<p style="color:rgba(255,255,255,0.4); font-size:14px;">Selecciona una actividad o torneo</p>';
        return;
    }

    lista.innerHTML = '<p style="color:rgba(255,255,255,0.4); font-size:14px;">Cargando...</p>';

    try {
        const [resRes, reseñasRes] = await Promise.all([
            apiRequest(`${API_URL}/reseñas/resumen?tipo=${tipo}&referencia_id=${referenciaId}`),
            apiRequest(`${API_URL}/reseñas?tipo=${tipo}&referencia_id=${referenciaId}&filtro=${filtro}`)
        ]);
        const resumenData = await resRes.json();
        const reseñas = await reseñasRes.json();

        const promedio = parseFloat(resumenData.promedio) || 0;
        const total = parseInt(resumenData.total) || 0;
        resumen.innerHTML = `
            <div style="display:flex; align-items:center; gap:16px; padding:12px; background:rgba(84,207,224,0.06); border-radius:10px;">
                <span style="font-size:28px; color:#f5c518;">${'★'.repeat(Math.round(promedio))}${'☆'.repeat(5 - Math.round(promedio))}</span>
                <div>
                    <span style="font-size:20px; font-weight:700; color:#54cfe0;">${promedio > 0 ? promedio : '—'}</span>
                    <span style="font-size:13px; color:rgba(255,255,255,0.4); margin-left:8px;">${total} reseña${total !== 1 ? 's' : ''} en total</span>
                </div>
            </div>
        `;

        if (reseñas.length === 0) {
            lista.innerHTML = '<p style="color:rgba(255,255,255,0.4); font-size:14px; margin-top:12px;">No hay reseñas con ese filtro</p>';
            return;
        }

        lista.innerHTML = reseñas.map(r => {
            const estrellas = '★'.repeat(r.estrellas) + '☆'.repeat(5 - r.estrellas);
            const color = r.estrellas >= 4 ? '#4caf50' : r.estrellas <= 2 ? '#ff6b6b' : '#ff9800';
            const fecha = new Date(r.created_at).toLocaleDateString('es-MX');
            return `
                <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; gap:14px; align-items:flex-start;">
                    <div style="min-width:80px; text-align:center;">
                        <div style="font-size:18px; color:${color};">${estrellas}</div>
                        <div style="font-size:11px; color:rgba(255,255,255,0.3); margin-top:2px;">${fecha}</div>
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:600; font-size:14px; color:#54cfe0;">${r.nombre} ${r.apellido}</div>
                        <div style="font-size:13px; color:rgba(255,255,255,0.6); margin-top:4px;">${r.comentario || '<em style="color:rgba(255,255,255,0.3)">Sin comentario</em>'}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch(e) {
        lista.innerHTML = '<p style="color:#ff6b6b; font-size:14px;">Error al cargar reseñas</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cargarOpcionesReferencia();
    document.getElementById('filtroTipoReseña')?.addEventListener('change', cargarOpcionesReferencia);
    document.getElementById('btnCargarReseñas')?.addEventListener('click', cargarReseñasAdmin);
});