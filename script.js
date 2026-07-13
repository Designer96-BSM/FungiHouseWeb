// script.js

let carrito = [];

// FUNCIÓN: Formatear precio en pesos colombianos
function formatearPrecio(numero) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(numero);
}

// FUNCIÓN: Formatear solo el número con separador de miles
function formatearNumero(numero) {
    return numero.toLocaleString('es-CO');
}

// Mostrar sección específica
function mostrarSeccion(seccion) {
    const secciones = document.querySelectorAll('.section');
    secciones.forEach(sec => sec.classList.remove('active'));

    document.getElementById(seccion).classList.add('active');

    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => link.classList.remove('active'));
    document.querySelector(`[data-section="${seccion}"]`).classList.add('active');

    window.scrollTo(0, 0);
}

// Agregar eventos a los links de navegación
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const seccion = link.getAttribute('data-section');
        mostrarSeccion(seccion);
    });
});


// FUNCIÓN: Incrementar cantidad
function incrementarCantidad(boton) {
    const input = boton.parentElement.querySelector('.cantidad-input');
    let valor = parseInt(input.value) || 1;
    valor = Math.min(valor + 1, 999); // Máximo 999
    input.value = valor;
}

// FUNCIÓN: Decrementar cantidad
function decrementarCantidad(boton) {
    const input = boton.parentElement.querySelector('.cantidad-input');
    let valor = parseInt(input.value) || 1;
    valor = Math.max(valor - 1, 1); // Mínimo 1
    input.value = valor;
}

// FUNCIÓN: Validar cantidad (cuando se escribe directamente)
function validarCantidad(input) {
    let valor = parseInt(input.value);
    
    // Si está vacío o es NaN
    if (!valor || isNaN(valor)) {
        input.value = 1;
        return;
    }
    
    // Si es menor a 1
    if (valor < 1) {
        input.value = 1;
        return;
    }
    
    // Si es mayor a 999
    if (valor > 999) {
        input.value = 999;
        return;
    }
    
    // Si es válido, dejar como está
    input.value = valor;
}

// FUNCIÓN: Validar que solo se escriban números
function validarInput(event) {
    // Permitir solo números, backspace, delete, tab
    const permitidas = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Backspace', 'Delete', 'Tab'];
    
    if (!permitidas.includes(event.key)) {
        event.preventDefault();
    }
}

// Actualizar la función agregarAlCarrito para usar la nueva estructura
function agregarAlCarrito(nombre, precio, boton) {
    const cantidadInput = boton.parentElement.querySelector('.cantidad-input');
    const cantidad = parseInt(cantidadInput.value) || 1;
    
    // Validar cantidad
    if (cantidad < 1) {
        alert('Por favor ingresa una cantidad válida (mínimo 1)');
        cantidadInput.value = 1;
        return;
    }
    
    // Buscar si el producto ya existe en el carrito
    const productoExistente = carrito.find(item => item.nombre === nombre && item.precio === precio);
    
    if (productoExistente) {
        // Si existe, sumar la cantidad
        productoExistente.cantidad += cantidad;
        productoExistente.total = productoExistente.precio * productoExistente.cantidad;
        console.log(`Cantidad actualizada: ${nombre} ahora tiene ${productoExistente.cantidad} unidades`);
    } else {
        // Si no existe, crear nuevo item
        const item = {
            nombre: nombre,
            precio: precio,
            cantidad: cantidad,
            total: precio * cantidad,
            id: Date.now()
        };
        carrito.push(item);
        console.log(`Producto agregado: ${nombre}`);
    }
    
    actualizarCarrito();
    
    // Resetear cantidad a 1
    cantidadInput.value = 1;
    
    // Mostrar confirmación
    boton.textContent = '✓ Agregado';
    boton.style.backgroundColor = '#4caf50';
    setTimeout(() => {
        boton.textContent = 'Agregar al carrito';
        boton.style.backgroundColor = '#444';
    }, 1500);
}

// Actualizar carrito
function actualizarCarrito() {
    const carritoItems = document.getElementById('carrito-items');
    carritoItems.innerHTML = '';

    if (carrito.length === 0) {
        carritoItems.innerHTML = '<p class="vacio">Tu carrito está vacío</p>';
        document.getElementById('total').textContent = '$0';
        return;
    }

    let totalGeneral = 0;

    carrito.forEach((item, index) => {
        totalGeneral += item.total;
        const itemHTML = `
            <div class="carrito-item">
                <div class="carrito-item-info">
                    <h3>${item.nombre}</h3>
                    <p>Precio: ${formatearPrecio(item.precio)}</p>
                    <p>Cantidad: ${item.cantidad}</p>
                    <p>Total: ${formatearPrecio(item.total)}</p>
                </div>
                <button class="carrito-item-eliminar" onclick="eliminarDelCarrito(${index})">Eliminar</button>
            </div>
        `;
        carritoItems.innerHTML += itemHTML;
    });

    document.getElementById('total').textContent = formatearPrecio(totalGeneral);
}

// Eliminar del carrito
function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarrito();
}

// ===== FUNCIÓN MEJORADA: PROCEDER AL PAGO CON WHATSAPP =====
function procederPago() {
    if (carrito.length === 0) {
        alert('Tu carrito está vacío');
        return;
    }

    // Calcular total
    let totalGeneral = 0;
    carrito.forEach(item => {
        totalGeneral += item.total;
    });

    // Crear mensaje para WhatsApp
    const mensaje = crearMensajeWhatsApp(totalGeneral);

    // Enviar a WhatsApp
    enviarWhatsApp(mensaje);
}

// FUNCIÓN: Crear mensaje con detalles del pedido
function crearMensajeWhatsApp(total) {
    let mensaje = '─────────────────────\n';
    mensaje += '*PEDIDO FUNGIHOUSE*\n';
    
    mensaje += '─────────────────────\n';
    mensaje += '*Detalles del Pedido:*\n';

    // Agregar cada producto
    carrito.forEach((item, index) => {
        mensaje += `${index + 1}. *${item.nombre}*\n`;
        mensaje += `   • Precio: ${formatearPrecio(item.precio)}\n`;
        mensaje += `   • Cantidad: ${item.cantidad}\n`;
        mensaje += `   • Subtotal: ${formatearPrecio(item.total)}\n`;
    });

    // Agregar total
    mensaje += '─────────────────────\n';
    mensaje += `*TOTAL: ${formatearPrecio(total)}*\n`;
    mensaje += '─────────────────────\n';

    return mensaje;
}

// FUNCIÓN: Enviar mensaje a WhatsApp
function enviarWhatsApp(mensaje) {
    // Obtener número de WhatsApp de config.js
    const numeroWhatsApp = CONFIG.numeroWhatsApp;

    // Codificar el mensaje para URL
    const mensajeEncodificado = encodeURIComponent(mensaje);

    // URL de WhatsApp
    const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${mensajeEncodificado}`;

    // Abrir WhatsApp
    window.open(urlWhatsApp, '_blank');

    // Limpiar carrito después de enviar
    setTimeout(() => {
        carrito = [];
        actualizarCarrito();
        mostrarSeccion('inicio');
        alert('¡Pedido enviado! Espera la confirmación en WhatsApp');
    }, 500);
}