const API_URL = '/api';

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

if (!token) {
    document.getElementById('message').innerHTML = '<div class="error">Token no válido o enlace expirado</div>';
    document.getElementById('resetBtn').disabled = true;
}

document.getElementById('resetBtn').addEventListener('click', async () => {
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmPassword').value;
    const msgDiv = document.getElementById('message');

    if (!password || !confirm) {
        msgDiv.innerHTML = '<div class="error">Completa todos los campos</div>';
        return;
    }
    if (password.length < 6) {
        msgDiv.innerHTML = '<div class="error">La contraseña debe tener al menos 6 caracteres</div>';
        return;
    }
    if (password !== confirm) {
        msgDiv.innerHTML = '<div class="error">Las contraseñas no coinciden</div>';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/recuperar/restablecer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, nueva_password: password })
        });
        const data = await res.json();
        if (res.ok) {
            msgDiv.innerHTML = '<div class="success">Contraseña actualizada. Redirigiendo...</div>';
            setTimeout(() => window.location.href = 'index.html', 2000);
        } else {
            msgDiv.innerHTML = `<div class="error">${data.error || 'Error al actualizar'}</div>`;
        }
    } catch (error) {
        msgDiv.innerHTML = '<div class="error">Error de conexión</div>';
    }
});