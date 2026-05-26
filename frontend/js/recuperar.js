const API_URL = '/api';
let emailUsuario = '';

function showMessage(elementId, text, isError = true) {
    const msgDiv = document.getElementById(elementId);
    const className = isError ? 'error' : 'success';
    msgDiv.innerHTML = `<div class="${className}">${text}</div>`;
    setTimeout(() => {
        if (msgDiv.innerHTML) msgDiv.innerHTML = '';
    }, 5000);
}

// Toggle de visibilidad de contraseña
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
        }
    });
});

// Paso 1: Solicitar PIN
document.getElementById('sendPinBtn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    if (!email) {
        showMessage('step1Message', 'Ingresa tu correo electrónico', true);
        return;
    }
    const btn = document.getElementById('sendPinBtn');
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
        const res = await fetch(`${API_URL}/recuperar/solicitar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok) {
            showMessage('step1Message', data.mensaje || 'Revisa tu correo', false);
            emailUsuario = email;
            document.getElementById('step1').classList.remove('active');
            document.getElementById('step2').classList.add('active');
        } else {
            showMessage('step1Message', data.error || 'Error al enviar', true);
        }
    } catch (error) {
        showMessage('step1Message', 'Error de conexión', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar código PIN';
    }
});

// Paso 2: Restablecer contraseña
document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
    const pin = document.getElementById('pin').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!pin || !newPassword || !confirmPassword) {
        showMessage('step2Message', 'Completa todos los campos', true);
        return;
    }
    if (newPassword.length < 6) {
        showMessage('step2Message', 'La contraseña debe tener al menos 6 caracteres', true);
        return;
    }
    if (newPassword !== confirmPassword) {
        showMessage('step2Message', 'Las contraseñas no coinciden', true);
        return;
    }

    const btn = document.getElementById('resetPasswordBtn');
    btn.disabled = true;
    btn.textContent = 'Procesando...';
    try {
        const res = await fetch(`${API_URL}/recuperar/restablecer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailUsuario, pin, nueva_password: newPassword })
        });
        const data = await res.json();
        if (res.ok) {
            showMessage('step2Message', data.mensaje || 'Contraseña actualizada. Redirigiendo...', false);
            setTimeout(() => window.location.href = 'index.html', 2000);
        } else {
            showMessage('step2Message', data.error || 'Error al actualizar', true);
        }
    } catch (error) {
        showMessage('step2Message', 'Error de conexión', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Restablecer contraseña';
    }
});

// Volver al paso 1
document.getElementById('backToStep1Btn').addEventListener('click', () => {
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step1').classList.add('active');
    document.getElementById('pin').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    document.getElementById('step2Message').innerHTML = '';
});