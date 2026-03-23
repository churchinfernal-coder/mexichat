const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 1080, H = 1920;
const outDir = path.join(__dirname, 'store-assets');

async function createScreenshot(name, svgContent) {
  await sharp(Buffer.from(svgContent)).resize(W, H).png().toFile(path.join(outDir, name));
  console.log('OK ' + name);
}

(async () => {

// 1. HOME SCREEN
await createScreenshot('screenshot-01-home.png', `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#dbeafe"/><stop offset="100%" style="stop-color:#e0e7ff"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg1)"/>
  <rect x="0" y="0" width="${W}" height="60" fill="#1d4ed8"/>
  <text x="540" y="42" text-anchor="middle" font-family="Arial" font-size="24" fill="white" font-weight="bold">MexiChat</text>
  <text x="540" y="320" text-anchor="middle" font-family="Arial" font-size="52" font-weight="bold" fill="#0f172a">Mexi<tspan fill="#1d4ed8">Chat</tspan></text>
  <rect x="180" y="440" width="280" height="280" rx="32" fill="rgba(29,78,216,0.12)"/><text x="320" y="580" text-anchor="middle" font-size="72">💬</text><text x="320" y="670" text-anchor="middle" font-family="Arial" font-size="28" font-weight="bold" fill="#0f172a">Chats</text>
  <rect x="620" y="440" width="280" height="280" rx="32" fill="rgba(29,78,216,0.12)"/><text x="760" y="580" text-anchor="middle" font-size="72">👥</text><text x="760" y="670" text-anchor="middle" font-family="Arial" font-size="28" font-weight="bold" fill="#0f172a">Grupos</text>
  <rect x="180" y="800" width="280" height="280" rx="32" fill="rgba(16,185,129,0.12)"/><text x="320" y="940" text-anchor="middle" font-size="72">💲</text><text x="320" y="1030" text-anchor="middle" font-family="Arial" font-size="28" font-weight="bold" fill="#0f172a">Pagos</text>
  <rect x="620" y="800" width="280" height="280" rx="32" fill="rgba(139,92,246,0.12)"/><text x="760" y="940" text-anchor="middle" font-size="72">🌎</text><text x="760" y="1030" text-anchor="middle" font-family="Arial" font-size="28" font-weight="bold" fill="#0f172a">Comunidad</text>
  <circle cx="540" cy="1300" r="48" fill="rgba(0,0,0,0.06)"/><text x="540" y="1314" text-anchor="middle" font-size="36">⚙️</text>
  <rect x="0" y="1760" width="${W}" height="160" fill="white" opacity="0.9"/>
  <text x="270" y="1845" text-anchor="middle" font-family="Arial" font-size="22" fill="#64748b">🏠 Inicio</text>
  <text x="540" y="1845" text-anchor="middle" font-family="Arial" font-size="22" fill="#64748b">💬 Chats</text>
  <text x="810" y="1845" text-anchor="middle" font-family="Arial" font-size="22" fill="#64748b">👤 Perfil</text>
</svg>`);

// 2. CHAT SCREEN
await createScreenshot('screenshot-02-chat.png', `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#f0f4f8"/>
  <rect x="0" y="0" width="${W}" height="120" fill="#1d4ed8"/>
  <text x="60" y="75" font-family="Arial" font-size="32" fill="white">←</text>
  <circle cx="140" cy="60" r="28" fill="#3b82f6"/><text x="140" y="70" text-anchor="middle" font-family="Arial" font-size="18" fill="white" font-weight="bold">M</text>
  <text x="190" y="55" font-family="Arial" font-size="24" fill="white" font-weight="bold">María García</text>
  <text x="190" y="82" font-family="Arial" font-size="16" fill="rgba(255,255,255,0.7)">en línea</text>
  <text x="920" y="70" font-family="Arial" font-size="28" fill="white">📞  📹</text>
  <rect x="400" y="160" width="200" height="36" rx="18" fill="rgba(0,0,0,0.06)"/><text x="500" y="184" text-anchor="middle" font-family="Arial" font-size="16" fill="#94a3b8">Hoy</text>
  <rect x="60" y="240" width="440" height="90" rx="20" fill="white"/><text x="90" y="280" font-family="Arial" font-size="22" fill="#0f172a">Hola! Ya llegaste? 👋</text><text x="460" y="310" text-anchor="end" font-family="Arial" font-size="14" fill="#94a3b8">10:30</text>
  <rect x="500" y="370" width="520" height="90" rx="20" fill="#1d4ed8"/><text x="530" y="410" font-family="Arial" font-size="22" fill="white">Sí! Acabo de llegar ✈️</text><text x="980" y="440" text-anchor="end" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.7)">10:31 ✓✓</text>
  <rect x="60" y="500" width="540" height="90" rx="20" fill="white"/><text x="90" y="540" font-family="Arial" font-size="22" fill="#0f172a">Qué emoción!! 🎉 Te mando</text><text x="90" y="570" font-family="Arial" font-size="22" fill="#0f172a">mi ubicación</text>
  <rect x="60" y="630" width="400" height="110" rx="20" fill="white"/><rect x="80" y="650" width="60" height="60" rx="10" fill="rgba(29,78,216,0.1)"/><text x="110" y="690" text-anchor="middle" font-size="28">📍</text><text x="170" y="690" font-family="Arial" font-size="18" fill="#0f172a">Ubicación compartida</text><text x="420" y="720" text-anchor="end" font-family="Arial" font-size="14" fill="#94a3b8">10:32</text>
  <rect x="440" y="780" width="580" height="90" rx="20" fill="#1d4ed8"/><text x="470" y="820" font-family="Arial" font-size="22" fill="white">Perfecto! Ya voy para allá 🚗💨</text><text x="980" y="850" text-anchor="end" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.7)">10:33 ✓✓</text>
  <rect x="540" y="910" width="480" height="80" rx="20" fill="#1d4ed8"/><text x="570" y="950" font-family="Arial" font-size="20" fill="white">🎤 ▎▌▍▎▏▎▌▍▎▏▌▍  0:12</text><text x="980" y="970" text-anchor="end" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.7)">10:34 ✓✓</text>
  <rect x="60" y="1040" width="580" height="90" rx="20" fill="white"/><text x="90" y="1080" font-family="Arial" font-size="22" fill="#0f172a">Aquí te espero! Trae las tortas 🌮😂</text><text x="600" y="1110" text-anchor="end" font-family="Arial" font-size="14" fill="#94a3b8">10:35</text>
  <rect x="440" y="1170" width="580" height="90" rx="20" fill="#1d4ed8"/><text x="470" y="1210" font-family="Arial" font-size="22" fill="white">Jaja sí! De jamón? 🥪</text><text x="980" y="1240" text-anchor="end" font-family="Arial" font-size="14" fill="rgba(255,255,255,0.7)">10:36 ✓✓</text>
  <rect x="0" y="${H-120}" width="${W}" height="120" fill="white"/>
  <text x="60" y="${H-55}" font-size="28">📎</text>
  <rect x="110" y="${H-95}" width="800" height="52" rx="26" fill="#f1f5f9"/><text x="140" y="${H-60}" font-family="Arial" font-size="20" fill="#94a3b8">Mensaje...</text>
  <circle cx="980" cy="${H-68}" r="28" fill="#1d4ed8"/><text x="980" y="${H-58}" text-anchor="middle" font-family="Arial" font-size="22" fill="white">→</text>
</svg>`);

// 3. COMMUNITY SCREEN
await createScreenshot('screenshot-03-community.png', `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="white"/>
  <rect x="0" y="0" width="${W}" height="100" fill="white"/>
  <text x="60" y="65" font-family="Arial" font-size="28" fill="#0f172a">← </text>
  <text x="120" y="55" font-family="Arial" font-size="28" font-weight="bold" fill="#0f172a">Comunidad</text>
  <text x="120" y="82" font-family="Arial" font-size="16" fill="#64748b">MexiVanza</text>
  <rect x="40" y="120" width="140" height="44" rx="22" fill="#1d4ed8"/><text x="110" y="148" text-anchor="middle" font-family="Arial" font-size="18" fill="white" font-weight="bold">● Social</text>
  <rect x="200" y="120" width="170" height="44" rx="22" fill="#f1f5f9"/><text x="285" y="148" text-anchor="middle" font-family="Arial" font-size="18" fill="#64748b">📦 MexiMart</text>
  <rect x="390" y="120" width="140" height="44" rx="22" fill="#f1f5f9"/><text x="460" y="148" text-anchor="middle" font-family="Arial" font-size="18" fill="#64748b">▶ Videos</text>
  <rect x="550" y="120" width="130" height="44" rx="22" fill="#f1f5f9"/><text x="615" y="148" text-anchor="middle" font-family="Arial" font-size="18" fill="#64748b">✈ Viajes</text>
  <circle cx="80" cy="230" r="28" fill="#f59e0b"/><text x="80" y="240" text-anchor="middle" font-family="Arial" font-size="18" fill="white" font-weight="bold">D</text>
  <text x="130" y="222" font-family="Arial" font-size="22" font-weight="bold" fill="#0f172a">Diego Rodriguez</text>
  <text x="130" y="250" font-family="Arial" font-size="16" fill="#64748b">hace 2 días</text>
  <rect x="860" y="210" width="160" height="32" rx="16" fill="#f1f5f9"/><text x="940" y="232" text-anchor="middle" font-family="Arial" font-size="14" fill="#64748b">public</text>
  <text x="60" y="310" font-family="Arial" font-size="24" fill="#0f172a">Veracruzzzz 🤩</text>
  <rect x="40" y="340" width="${W-80}" height="600" rx="16" fill="linear-gradient(#60a5fa,#3b82f6)"/>
  <rect x="40" y="340" width="${W-80}" height="600" rx="16" fill="#2563eb"/>
  <text x="540" y="650" text-anchor="middle" font-size="120">🏖️</text>
  <rect x="${W-160}" y="360" width="80" height="36" rx="18" fill="rgba(0,0,0,0.5)"/><text x="${W-120}" y="384" text-anchor="middle" font-family="Arial" font-size="16" fill="white">1 / 3</text>
  <text x="60" y="1000" font-family="Arial" font-size="20" fill="#0f172a">❤️ 24    💬 8    ↗️ Compartir</text>
  <line x1="40" y1="1050" x2="${W-40}" y2="1050" stroke="#f1f5f9" stroke-width="2"/>
  <circle cx="80" cy="1130" r="28" fill="#10b981"/><text x="80" y="1140" text-anchor="middle" font-family="Arial" font-size="18" fill="white" font-weight="bold">S</text>
  <text x="130" y="1122" font-family="Arial" font-size="22" font-weight="bold" fill="#0f172a">Sofía Martínez</text>
  <text x="130" y="1150" font-family="Arial" font-size="16" fill="#64748b">hace 5 horas</text>
  <text x="60" y="1210" font-family="Arial" font-size="24" fill="#0f172a">CDMX de noche es otra cosa 🌃✨</text>
  <rect x="40" y="1240" width="${W-80}" height="400" rx="16" fill="#1e293b"/>
  <text x="540" y="1450" text-anchor="middle" font-size="100">🌃</text>
  <text x="60" y="1700" font-family="Arial" font-size="20" fill="#0f172a">❤️ 52    💬 15    ↗️ Compartir</text>
</svg>`);

// 4. PAYMENTS SCREEN
await createScreenshot('screenshot-04-payments.png', `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="white"/>
  <rect x="0" y="0" width="${W}" height="100" fill="white"/>
  <text x="60" y="65" font-family="Arial" font-size="32" fill="#0f172a">💲</text>
  <text x="120" y="65" font-family="Arial" font-size="32" font-weight="bold" fill="#0f172a">Pagos</text>
  <rect x="60" y="140" width="${W-120}" height="220" rx="24" fill="url(#pg)"/>
  <defs><linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#1e40af"/><stop offset="100%" style="stop-color:#3b82f6"/></linearGradient></defs>
  <text x="120" y="210" font-family="Arial" font-size="20" fill="rgba(255,255,255,0.7)">Tu saldo disponible</text>
  <text x="120" y="290" font-family="Arial" font-size="56" font-weight="bold" fill="white">$2,450.00</text>
  <text x="620" y="290" font-family="Arial" font-size="24" fill="rgba(255,255,255,0.7)">MXN</text>
  <circle cx="220" cy="480" r="48" fill="rgba(29,78,216,0.1)"/><text x="220" y="496" text-anchor="middle" font-size="32">📤</text><text x="220" y="556" text-anchor="middle" font-family="Arial" font-size="18" fill="#64748b">Enviar</text>
  <circle cx="540" cy="480" r="48" fill="rgba(29,78,216,0.1)"/><text x="540" y="496" text-anchor="middle" font-size="32">📥</text><text x="540" y="556" text-anchor="middle" font-family="Arial" font-size="18" fill="#64748b">Recibir</text>
  <circle cx="860" cy="480" r="48" fill="rgba(29,78,216,0.1)"/><text x="860" y="496" text-anchor="middle" font-size="32">📊</text><text x="860" y="556" text-anchor="middle" font-family="Arial" font-size="18" fill="#64748b">Historial</text>
  <text x="60" y="660" font-family="Arial" font-size="22" font-weight="bold" fill="#0f172a">Transacciones Recientes</text>
  <rect x="60" y="700" width="${W-120}" height="100" rx="16" fill="#f8fafc"/>
  <circle cx="120" cy="750" r="24" fill="#10b981"/><text x="120" y="758" text-anchor="middle" font-family="Arial" font-size="14" fill="white" font-weight="bold">A</text>
  <text x="170" y="738" font-family="Arial" font-size="20" font-weight="bold" fill="#0f172a">Ana López</text>
  <text x="170" y="768" font-family="Arial" font-size="16" fill="#64748b">Ayer, 3:45 PM</text>
  <text x="${W-120}" y="755" text-anchor="end" font-family="Arial" font-size="22" font-weight="bold" fill="#10b981">+$500.00</text>
  <rect x="60" y="820" width="${W-120}" height="100" rx="16" fill="#f8fafc"/>
  <circle cx="120" cy="870" r="24" fill="#3b82f6"/><text x="120" y="878" text-anchor="middle" font-family="Arial" font-size="14" fill="white" font-weight="bold">C</text>
  <text x="170" y="858" font-family="Arial" font-size="20" font-weight="bold" fill="#0f172a">Carlos Ruiz</text>
  <text x="170" y="888" font-family="Arial" font-size="16" fill="#64748b">Martes, 1:20 PM</text>
  <text x="${W-120}" y="875" text-anchor="end" font-family="Arial" font-size="22" font-weight="bold" fill="#0f172a">-$150.00</text>
  <rect x="60" y="940" width="${W-120}" height="100" rx="16" fill="#f8fafc"/>
  <circle cx="120" cy="990" r="24" fill="#8b5cf6"/><text x="120" y="998" text-anchor="middle" font-family="Arial" font-size="14" fill="white" font-weight="bold">M</text>
  <text x="170" y="978" font-family="Arial" font-size="20" font-weight="bold" fill="#0f172a">MexiMart</text>
  <text x="170" y="1008" font-family="Arial" font-size="16" fill="#64748b">Lunes, 10:00 AM</text>
  <text x="${W-120}" y="995" text-anchor="end" font-family="Arial" font-size="22" font-weight="bold" fill="#0f172a">-$320.00</text>
  <rect x="60" y="1060" width="${W-120}" height="100" rx="16" fill="#f8fafc"/>
  <circle cx="120" cy="1110" r="24" fill="#f59e0b"/><text x="120" y="1118" text-anchor="middle" font-family="Arial" font-size="14" fill="white" font-weight="bold">F</text>
  <text x="170" y="1098" font-family="Arial" font-size="20" font-weight="bold" fill="#0f172a">Familia CDMX</text>
  <text x="170" y="1128" font-family="Arial" font-size="16" fill="#64748b">Domingo, 2:00 PM</text>
  <text x="${W-120}" y="1115" text-anchor="end" font-family="Arial" font-size="22" font-weight="bold" fill="#10b981">+$1,200.00</text>
</svg>`);

// 5. CHAT LIST SCREEN
await createScreenshot('screenshot-05-chatlist.png', `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="60" y="75" font-family="Arial" font-size="36" font-weight="bold" fill="#0f172a">Mensajes</text>
  <text x="${W-80}" y="75" font-family="Arial" font-size="28" fill="#1d4ed8">✏️</text>
  <rect x="40" y="110" width="${W-80}" height="52" rx="14" fill="#f1f5f9"/><text x="80" y="142" font-family="Arial" font-size="20" fill="#94a3b8">🔍 Buscar conversación...</text>
  <rect x="40" y="185" width="${W-80}" height="1" fill="#f1f5f9"/>
  <circle cx="90" cy="240" r="32" fill="#10b981"/><text x="90" y="250" text-anchor="middle" font-family="Arial" font-size="20" fill="white" font-weight="bold">A</text>
  <text x="150" y="228" font-family="Arial" font-size="22" font-weight="bold" fill="#0f172a">Ana López</text>
  <text x="${W-80}" y="228" text-anchor="end" font-family="Arial" font-size="16" fill="#1d4ed8">12:45</text>
  <text x="150" y="258" font-family="Arial" font-size="18" fill="#64748b">Nos vemos mañana! 🎉</text>
  <rect x="${W-120}" y="238" width="30" height="30" rx="15" fill="#1d4ed8"/><text x="${W-105}" y="259" text-anchor="middle" font-family="Arial" font-size="14" fill="white" font-weight="bold">3</text>
  <rect x="40" y="295" width="${W-80}" height="1" fill="#f1f5f9"/>
  <circle cx="90" cy="350" r="32" fill="#3b82f6"/><text x="90" y="360" text-anchor="middle" font-family="Arial" font-size="20" fill="white" font-weight="bold">C</text>
  <text x="150" y="338" font-family="Arial" font-size="22" font-weight="bold" fill="#0f172a">Carlos Ruiz</text>
  <text x="${W-80}" y="338" text-anchor="end" font-family="Arial" font-size="16" fill="#94a3b8">11:20</text>
  <text x="150" y="368" font-family="Arial" font-size="18" fill="#64748b">Te envié el archivo 📄</text>
  <rect x="40" y="405" width="${W-80}" height="1" fill="#f1f5f9"/>
  <circle cx="90" cy="460" r="32" fill="#f59e0b"/><text x="90" y="470" text-anchor="middle" font-family="Arial" font-size="20" fill="white" font-weight="bold">F</text>
  <text x="150" y="448" font-family="Arial" font-size="22" font-weight="bold" fill="#0f172a">Familia CDMX</text>
  <text x="${W-80}" y="448" text-anchor="end" font-family="Arial" font-size="16" fill="#94a3b8">ayer</text>
  <text x="150" y="478" font-family="Arial" font-size="18" fill="#64748b">Mamá: Los espero a las 3 🏠</text>
  <rect x="${W-120}" y="458" width="36" height="30" rx="15" fill="#1d4ed8"/><text x="${W-102}" y="479" text-anchor="middle" font-family="Arial" font-size="14" fill="white" font-weight="bold">12</text>
  <rect x="40" y="515" width="${W-80}" height="1" fill="#f1f5f9"/>
  <circle cx="90" cy="570" r="32" fill="#8b5cf6"/><text x="90" y="580" text-anchor="middle" font-family="Arial" font-size="20" fill="white" font-weight="bold">D</text>
  <text x="150" y="558" font-family="Arial" font-size="22" font-weight="bold" fill="#0f172a">Diego M.</text>
  <text x="${W-80}" y="558" text-anchor="end" font-family="Arial" font-size="16" fill="#94a3b8">ayer</text>
  <text x="150" y="588" font-family="Arial" font-size="18" fill="#64748b">🎤 Nota de voz (0:24)</text>
  <rect x="40" y="625" width="${W-80}" height="1" fill="#f1f5f9"/>
  <circle cx="90" cy="680" r="32" fill="#14b8a6"/><text x="90" y="690" text-anchor="middle" font-family="Arial" font-size="20" fill="white" font-weight="bold">T</text>
  <text x="150" y="668" font-family="Arial" font-size="22" font-weight="bold" fill="#0f172a">Trabajo MKT</text>
  <text x="${W-80}" y="668" text-anchor="end" font-family="Arial" font-size="16" fill="#94a3b8">lun</text>
  <text x="150" y="698" font-family="Arial" font-size="18" fill="#64748b">Junta a las 9am sin falta 💼</text>
  <rect x="${W-120}" y="678" width="30" height="30" rx="15" fill="#1d4ed8"/><text x="${W-105}" y="699" text-anchor="middle" font-family="Arial" font-size="14" fill="white" font-weight="bold">5</text>
  <rect x="40" y="735" width="${W-80}" height="1" fill="#f1f5f9"/>
  <circle cx="90" cy="790" r="32" fill="#ec4899"/><text x="90" y="800" text-anchor="middle" font-family="Arial" font-size="20" fill="white" font-weight="bold">L</text>
  <text x="150" y="778" font-family="Arial" font-size="22" font-weight="bold" fill="#0f172a">Laura Sánchez</text>
  <text x="${W-80}" y="778" text-anchor="end" font-family="Arial" font-size="16" fill="#94a3b8">dom</text>
  <text x="150" y="808" font-family="Arial" font-size="18" fill="#64748b">Foto: 📷 Mira esto!</text>
</svg>`);

console.log('\n🎉 All 5 screenshots generated!');
})();