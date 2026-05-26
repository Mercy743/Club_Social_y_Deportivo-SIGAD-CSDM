document.addEventListener("DOMContentLoaded", () => {

const API_URL = '/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) window.location.href = 'index.html';

document.getElementById('refreshBtn').onclick = () => {
    cargarReservaciones();
    cargarEspacios();
};

flatpickr("#fecha", {
    dateFormat: "Y-m-d",
    minDate: "today"
});

function generarHoras() {
    let horas = [];
    for (let h = 6; h <= 22; h++) {
        horas.push((h < 10 ? '0' : '') + h + ":00");
    }
    return horas;
}

function llenarLista(idInput, idLista) {
    const input = document.getElementById(idInput);
    const lista = document.getElementById(idLista);

    generarHoras().forEach(h => {
        const div = document.createElement("div");
        div.textContent = h;
        div.onclick = () => {
            input.value = h;
            lista.style.display = "none";
        };
        lista.appendChild(div);
    });

    input.onclick = () => lista.style.display = "block";
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !lista.contains(e.target)) {
            lista.style.display = "none";
        }
    });
}

llenarLista("horaInicio", "listaInicio");
llenarLista("horaFin", "listaFin");

async function cargarEspacios() {
    try {
        const res = await apiRequest(API_URL + '/espacios');
        const data = await res.json();
        const espaciosActivos = data.filter(e => e.activo === true);

        document.getElementById('tablaEspacios').innerHTML = `
            <table class="espacios-table">
                <thead>
                    <tr><th>#</th><th>Nombre</th><th>Tipo</th><th>Capacidad</th></tr>
                </thead>
                <tbody>
                    ${espaciosActivos.map((e,i)=>`
                        <tr onclick="seleccionarEspacio(${e.id}, this)">
                            <td>${i+1}</td>
                            <td><strong>${escapeHtml(e.nombre)}</strong></td>
                            <td><span class="espacio-tipo-badge">${escapeHtml(e.tipo)}</span></td>
                            <td>${e.capacidad || '—'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error('Error cargando espacios:', err);
    }
}

window.seleccionarEspacio = (id, fila) => {
    document.getElementById('espacioSeleccionado').value = id;
    document.querySelectorAll('#tablaEspacios tr').forEach(tr => tr.classList.remove('selectedRow'));
    fila.classList.add('selectedRow');
    const nombre = fila.querySelector('td:nth-child(2)')?.textContent?.trim() || '';
    const hint = document.getElementById('seleccionHint');
    if (hint && nombre) hint.innerHTML = 'Seleccionado: <strong>' + escapeHtml(nombre) + '</strong>';
};

async function cargarReservaciones() {
    try {
        const res = await apiRequest(API_URL + '/reservaciones');
        const data = await res.json();
        const activas = data.filter(r => r.estado !== 'cancelada');

        const lista = document.getElementById('reservacionesList');
        
        if (!activas.length) {
            lista.innerHTML = '<div class="empty-state">No hay reservaciones activas.</div>';
            return;
        }

        lista.innerHTML = `
            <div class="reservas-grid">
                ${activas.map(r => {
                    let puedeCancelar = false;
                    if (loggedUser.rol === 'admin') {
                        puedeCancelar = true;
                    } else if (loggedUser.rol === 'instructor' && r.usuario_id === loggedUser.id) {
                        puedeCancelar = true;
                    } else if (loggedUser.rol === 'socio' && r.usuario_id === loggedUser.id) {
                        puedeCancelar = true;
                    }

                    const cancelBtn = puedeCancelar
                        ? `<button class="dangerBtn" onclick="cancelarReserva(${r.id}, this)"><i class="fa-solid fa-xmark"></i> Cancelar</button>`
                        : `<button class="secondaryBtn" disabled>No disponible</button>`;

                    return `
                        <div class="reserva-card">
                            <div class="reserva-card-body">
                                <h3>${escapeHtml(r.espacio_nombre)}</h3>
                                <div class="reserva-info">
                                    <p><i class="fa-solid fa-calendar-day"></i> ${new Date(r.fecha_reserva).toLocaleDateString('es-MX')}</p>
                                    <p><i class="fa-solid fa-clock"></i> ${r.hora_inicio.substring(0,5)} – ${r.hora_fin.substring(0,5)} hrs</p>
                                    <p><i class="fa-solid fa-user"></i> ${escapeHtml(r.usuario_nombre)}</p>
                                    <p class="full-row"><span class="badge badge-confirmada">${r.estado}</span></p>
                                </div>
                            </div>
                            <div class="reserva-card-footer">
                                ${cancelBtn}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (err) {
        console.error('Error cargando reservaciones:', err);
    }
}

window.cancelarReserva = async (id, btn) => {
    if (!confirm('¿Seguro que quieres cancelar esta reservacion?')) return;
    btn.disabled = true;
    btn.textContent = 'Cancelando...';

    try {
        const res = await apiRequest(`${API_URL}/reservaciones/${id}/cancelar`, { method: 'PUT' });
        if (!res.ok) throw new Error();
        await cargarReservaciones();
    } catch {
        alert('No se pudo cancelar la reservacion.');
        btn.disabled = false;
        btn.textContent = 'Cancelar';
    }
};

document.getElementById('guardarBtn').onclick = async () => {
    const espacioId = document.getElementById('espacioSeleccionado').value;
    const fecha = document.getElementById('fecha').value;
    const horaInicio = document.getElementById('horaInicio').value;
    const horaFin = document.getElementById('horaFin').value;

    if (!espacioId || !fecha || !horaInicio || !horaFin) {
        alert('Completa todos los campos.');
        return;
    }

    if (horaInicio >= horaFin) {
        alert('La hora de inicio debe ser menor a la hora de fin.');
        return;
    }

    const btn = document.getElementById('guardarBtn');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const body = {
        usuario_id: loggedUser.id,
        espacio_id: parseInt(espacioId),
        fecha_reserva: fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin
    };

    try {
        const res = await apiRequest(API_URL + '/reservaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.error || 'Error al guardar');
            return;
        }

        alert('Reservacion creada exitosamente');
        
        document.getElementById('espacioSeleccionado').value = '';
        document.getElementById('fecha').value = '';
        document.getElementById('horaInicio').value = '';
        document.getElementById('horaFin').value = '';
        document.querySelectorAll('#tablaEspacios tr').forEach(tr => tr.classList.remove('selectedRow'));
        
        await cargarReservaciones();
    } catch (err) {
        console.error(err);
        alert('Error al guardar la reservacion');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar reservacion';
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

cargarEspacios();
cargarReservaciones();

});