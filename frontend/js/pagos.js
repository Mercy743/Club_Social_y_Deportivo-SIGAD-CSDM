const API_URL = 'http://localhost:3000/api';
const loggedUser = JSON.parse(localStorage.getItem('loggedUser'));

if (!loggedUser) {
    window.location.href = 'index.html';
}

document.getElementById('userInfo').innerHTML = loggedUser.nombre + ' (' + loggedUser.rol + ')';

document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('registrarPagoBtn').addEventListener('click', registrarPago);

async function registrarPago() {
    const pago = {
        usuario_id: document.getElementById('pagoUsuarioInput').value,
        monto: document.getElementById('pagoMonto').value,
        fecha: document.getElementById('pagoFecha').value,
        metodo_pago: document.getElementById('pagoMetodo').value,
        estado: document.getElementById('pagoEstado').value
    };

    if (!pago.usuario_id || !pago.monto || !pago.fecha) {
        alert('Completa todos los campos obligatorios');
        return;
    }

    try {
        const res = await fetch(API_URL + '/pagos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pago)
        });

        if (res.ok) {
            alert('Pago registrado correctamente');
            document.getElementById('pagoUsuarioInput').value = '';
            document.getElementById('pagoMonto').value = '';
            document.getElementById('pagoFecha').value = '';
            cargarPagosRecientes();
        } else {
            const data = await res.json();
            alert(data.error || 'Error al registrar pago');
        }
    } catch (error) {
        console.error(error);
        alert('Error de conexión');
    }
}

async function cargarPagosRecientes() {
    try {
        const res = await fetch(API_URL + '/pagos');
        const pagos = await res.json();
        
        let html = '<table border="1" cellpadding="8"><tr><th>ID</th><th>Usuario</th><th>Monto</th><th>Fecha</th><th>Método</th><th>Estado</th></tr>';
        pagos.slice(-10).reverse().forEach(p => {
            html += `<tr>
                <td>${p.id}</td>
                <td>${p.usuario_id}</td>
                <td>$${p.monto}</td>
                <td>${p.fecha}</td>
                <td>${p.metodo_pago}</td>
                <td>${p.estado}</td>
            </tr>`;
        });
        html += '</table>';
        document.getElementById('pagosList').innerHTML = html;
    } catch (error) {
        document.getElementById('pagosList').innerHTML = 'Error cargando pagos';
    }
}

cargarPagosRecientes();

function logout() {
    localStorage.removeItem('loggedUser');
    window.location.href = 'index.html';
}