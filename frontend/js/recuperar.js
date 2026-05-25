const API_URL = '/api';

document.getElementById('sendBtn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const msgDiv = document.getElementById('message');
    if (!email) {
        msgDiv.innerHTML = '<div class="error">Ingresa tu correo electrónico</div>';
        return;
    }
    msgDiv.innerHTML = '<div class="success">Enviando...</div>';
    try {
        const res = await fetch(`${API_URL}/recuperar/solicitar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        msgDiv.innerHTML = `<div class="success">${data.mensaje || 'Revisa tu correo'}</div>`;
        document.getElementById('email').value = '';
    } catch (error) {
        msgDiv.innerHTML = '<div class="error">Error de conexión</div>';
    }
});