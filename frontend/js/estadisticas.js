const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

if (loggedUser.rol !== 'admin') {
    alert('Acceso denegado. Solo administradores pueden ver estadisticas.');
    window.location.href = 'dashboard.html';
}

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
});

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
        const response = await fetch(API_URL + '/estadisticas');
        const data = await response.json();

        const basics = data.basics || data;
        
        // Formatear números
        document.getElementById('totalSocios').innerText = (basics.socios || 0).toLocaleString();
        document.getElementById('totalInstructores').innerText = (basics.instructores || 0).toLocaleString();
        document.getElementById('totalEventos').innerText = (basics.eventos || 0).toLocaleString();
        
        const totalIngresos = basics.ingresosTotales || 0;
        document.getElementById('ingresosTotales').innerHTML = '$' + totalIngresos.toLocaleString();

        const sociosPorTipo = data.sociosPorTipo || [];
        const sociosPorEstatus = data.sociosPorEstatus || [];
        const actividadesPopulares = data.actividadesPopulares || [];
        const ingresosMensuales = data.ingresosMensuales || [];

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
        }

        // Grafica 4: Linea - Ingresos mensuales
        if (charts.ingresos) charts.ingresos.destroy();
        charts.ingresos = new Chart(document.getElementById('ingresosChart'), {
            type: 'line',
            data: {
                labels: ingresosMensuales.map(item => {
                    const [year, month] = item.mes.split('-');
                    return `${month}/${year.slice(2)}`;
                }),
                datasets: [{
                    label: 'Ingresos',
                    data: ingresosMensuales.map(item => parseFloat(item.total || 0)),
                    borderColor: '#4caf50',
                    backgroundColor: 'rgba(76,175,80,0.05)',
                    borderWidth: 2,
                    pointBackgroundColor: '#4caf50',
                    pointBorderColor: 'transparent',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                ...barOptions,
                plugins: {
                    ...chartOptions.plugins,
                    tooltip: {
                        callbacks: {
                            label: (ctx) => '$' + ctx.raw.toLocaleString()
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error cargando estadisticas:', error);
    }
}

cargarEstadisticas();
setInterval(cargarEstadisticas, 30000);