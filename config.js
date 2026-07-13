// config.js - Configuración de colores y WhatsApp

const CONFIG = {
    // Color primario
    colorPrimario: '#10b981',
    colorPrimarioHover: '#059669',
    
    // Color secundario
    colorSecundario: '#f59e0b',
    colorSecundarioHover: '#fbbf24',
    
    // Fondos
    fondoOscuro: '#1a1a1a',
    fondoMedio: '#222',
    fondoClaro: '#2a2a2a',
    fondoTarjeta: '#333',
    
    // Textos
    textoBlanco: '#fff',
    textoGris: '#ccc',
    textoGrisOscuro: '#aaa',
    
    // Otros
    colorError: '#d32f2f',
    colorErrorHover: '#ff5252',
    colorExito: '#4caf50',
    borderColor: '#444',
    shadowColor: 'rgba(0, 0, 0, 0.6)',
    
    // WHATSAPP - IMPORTANTE
    numeroWhatsApp: '573218870869'
};

// Aplicar colores
function aplicarColores() {
    const root = document.documentElement;
    root.style.setProperty('--color-primario', CONFIG.colorPrimario);
    root.style.setProperty('--color-primario-hover', CONFIG.colorPrimarioHover);
    root.style.setProperty('--color-secundario', CONFIG.colorSecundario);
    root.style.setProperty('--color-secundario-hover', CONFIG.colorSecundarioHover);
    root.style.setProperty('--fondo-oscuro', CONFIG.fondoOscuro);
    root.style.setProperty('--fondo-medio', CONFIG.fondoMedio);
    root.style.setProperty('--fondo-claro', CONFIG.fondoClaro);
    root.style.setProperty('--fondo-tarjeta', CONFIG.fondoTarjeta);
    root.style.setProperty('--texto-blanco', CONFIG.textoBlanco);
    root.style.setProperty('--texto-gris', CONFIG.textoGris);
    root.style.setProperty('--texto-gris-oscuro', CONFIG.textoGrisOscuro);
    root.style.setProperty('--color-error', CONFIG.colorError);
    root.style.setProperty('--color-error-hover', CONFIG.colorErrorHover);
    root.style.setProperty('--color-exito', CONFIG.colorExito);
    root.style.setProperty('--border-color', CONFIG.borderColor);
    root.style.setProperty('--shadow-color', CONFIG.shadowColor);
}

// Ejecutar cuando DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicarColores);
} else {
    aplicarColores();
}