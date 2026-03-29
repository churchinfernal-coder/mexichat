/**
 * MexiChat - Copyright (c) 2024-2026 MexiVanza. All Rights Reserved.
 * Proprietary and confidential. Unauthorized copying, modification,
 * distribution, or use of this software is strictly prohibited.
 * See LICENSE file for details.
 */
/**
 * MexiChat Master Translation File
 * Languages: es (Spanish), en (English), ru (Russian), zh (Chinese)
 */
export type Language = 'es' | 'en' | 'ru' | 'zh';

export interface Translations {
  common: { appName: string; loading: string; save: string; cancel: string; close: string; delete: string; confirm: string; back: string; next: string; search: string; retry: string; error: string; success: string; optional: string; select: string };
  home: { chats: string; groups: string; payments: string; community: string; settings: string };
  landing: {
    nav: { features: string; app: string; privacy: string; download: string; openApp: string };
    hero: { badge: string; line1: string; line2: string; subtitle: string; downloadFree: string; openBrowser: string; e2eEncryption: string; free: string; noAds: string; platforms: string };
    screens: { 
      title: string; 
      subtitle: string;
      chats?: string;
      chatsDesc?: string;
      community?: string;
      communityDesc?: string;
      payments?: string;
      paymentsDesc?: string;
    };
    features: { title: string; subtitle: string; e2e: { title: string; desc: string }; calls: { title: string; desc: string }; community: { title: string; desc: string }; payments: { title: string; desc: string }; multiplatform: { title: string; desc: string }; biometric: { title: string; desc: string }; oxxo: { title: string; desc: string }; mercadoPago: { title: string; desc: string } };
    privacy: { title: string; desc: string; e2e: string; noTracking: string; noAds: string; noDataSale: string };
    download: { title: string; subtitle: string; android: string; androidReq: string; ios: string; iosReq: string; webApp: string; anyBrowser: string; openWebApp: string; downloadApk: string };
    footer: { tagline: string; app: string; features: string; screenshots: string; download: string; legal: string; privacyPolicy: string; terms: string; community: string; support: string; allRights: string; productOf: string };
    mockChat: { today: string; message: string; online: string; locationShared: string };
  };
  mensajes: { directMessages: string; groups: string; searchChats: string; newChat: string; noMessages: string; searchByUser: string; archived: string; hideArchived: string; typeMessage: string; encryptedNotice: string; deleteConversation: string; deleteConversationDesc: string; leaveGroup: string; leaveGroupDesc: string; deleteGroup: string; deleteGroupDesc: string; kickMember: string; kickMemberDesc: string };
  settings: { title: string; profile: string; privacy: string; security: string; appearance: string; language: string; fullName: string; username: string; phone: string; bio: string; bioPlaceholder: string; nationality: string; gender: string; changeAvatar: string; saving: string; saveChanges: string; signOut: string; lastSeen: string; onlineStatus: string; profilePhoto: string; readReceipts: string; readReceiptsDesc: string; everyone: string; contactsOnly: string; nobody: string; pinLock: string; pinConfigured: string; pinNotConfigured: string; lockNow: string; removePin: string; setupPin: string; e2eEncryption: string; e2eDesc: string; activeSession: string; browser: string; mobile: string; desktop: string; lastActivity: string; twoFactorAuth: string; twoFactorDesc: string; configure2FA: string };
  pagos: { title: string; send: string; history: string; account: string; recipient: string; recipientPlaceholder: string; amount: string; concept: string; conceptPlaceholder: string; paymentMethod: string; mercadoPago: string; oxxo: string; sendAmount: string; processing: string; searchContact: string; minAmount: string; maxAmount: string; maxOxxo: string; selectRecipient: string; loginFirst: string; pending: string; approved: string; rejected: string; linkAccount: string; linkAccountDesc: string; paymentSuccess: string; sendAnother: string; biometricCancelled: string; noTransactions: string };
  seo: { title: string; description: string; keywords: string; ogTitle: string; ogDescription: string };
}

// ---- SPANISH ----------
const es: Translations = {
  common: { appName: 'MexiChat', loading: 'Cargando...', save: 'Guardar', cancel: 'Cancelar', close: 'Cerrar', delete: 'Eliminar', confirm: 'Confirmar', back: 'Volver', next: 'Siguiente', search: 'Buscar', retry: 'Reintentar', error: 'Error', success: 'Éxito', optional: 'opcional', select: 'Seleccionar...' },
  home: { chats: 'Chats', groups: 'Grupos', payments: 'Pagos', community: 'Comunidad', settings: 'Ajustes' },
  landing: {
    nav: { features: 'Funciones', app: 'App', privacy: 'Privacidad', download: 'Descargar', openApp: 'Abrir App' },
    hero: { badge: 'Hecho en México para el mundo', line1: 'Tu Mundo,', line2: 'Tu Chat.', subtitle: 'Mensajería privada con cifrado de extremo a extremo. Llamadas HD, grupos, pagos con Mercado Pago y OXXO, autenticación biométrica y comunidad — todo en una app.', downloadFree: 'Descargar Gratis', openBrowser: 'Abrir en Navegador', e2eEncryption: 'Cifrado E2E', free: 'Gratis', noAds: 'Sin publicidad', platforms: 'Plataformas' },
    screens: {
      title: 'Conoce MexiChat',
      subtitle: 'Todo lo que necesitas, en una sola app',
      chats: 'Tus Conversaciones',
      chatsDesc: 'Mensajes privados y grupos organizados con búsqueda instantánea',
      community: 'Comunidad MexiVanza',
      communityDesc: 'Red social integrada: comparte contenido, descubre MexiMart, videos y conecta con mexicanos en todo el mundo.',
      payments: 'Pagos Instantáneos',
      paymentsDesc: 'Envía y recibe dinero con Mercado Pago y OXXO directamente desde el chat. Rápido, seguro y sin comisiones ocultas.'
    },
    features: {
      title: 'Todo lo que necesitas', subtitle: 'Funciones de clase mundial, gratis para todos',
      e2e: { title: 'Cifrado de Extremo a Extremo', desc: 'Todos tus mensajes protegidos con AES-256-GCM y claves ECDH P-256. Nadie más puede leerlos, ni siquiera nosotros.' },
      calls: { title: 'Llamadas HD', desc: 'Llamadas de voz y video en alta definición, completamente gratis. Conecta sin importar la distancia.' },
      community: { title: 'Comunidad MexiVanza', desc: 'Red social integrada: comparte contenido, descubre MexiMart, videos y conecta con mexicanos en todo el mundo.' },
      payments: { title: 'Pagos Instantáneos', desc: 'Envía y recibe dinero con Mercado Pago y OXXO directamente desde el chat. Rápido, seguro y sin comisiones ocultas.' },
      multiplatform: { title: 'Multiplataforma', desc: 'Android, iOS y Web. Tus mensajes sincronizados en todos tus dispositivos automáticamente.' },
      biometric: { title: 'Autenticación Biométrica', desc: 'Protege tu cuenta con Face ID, Touch ID o huella digital. Verificación biométrica para pagos y acceso a la app.' },
      oxxo: { title: 'Pagos OXXO', desc: 'Paga en cualquier tienda OXXO de México. Genera tu referencia de pago y deposita en efectivo de forma segura.' },
      mercadoPago: { title: 'Mercado Pago', desc: 'Vincula tu cuenta de Mercado Pago para enviar y recibir dinero al instante con la mayor plataforma de pagos de Latinoamérica.' },
    },
    privacy: { title: 'Tu Privacidad, Nuestra Promesa', desc: 'MexiChat fue diseñado desde cero con la privacidad como prioridad. Usamos cifrado de extremo a extremo en todos los mensajes y llamadas. No leemos tus chats, no vendemos tus datos, no mostramos publicidad.', e2e: 'Cifrado E2E', noTracking: 'Sin rastreo', noAds: 'Sin publicidad', noDataSale: 'Sin venta de datos' },
    download: { title: 'Descarga MexiChat Gratis', subtitle: 'Disponible para todos tus dispositivos', android: 'Android', androidReq: 'Android 8.0+', ios: 'iOS', iosReq: 'iPhone con iOS 15+', webApp: 'Web App', anyBrowser: 'Cualquier navegador', openWebApp: 'Abrir Web App', downloadApk: 'Descargar APK directamente' },
    footer: { tagline: 'La mensajería de México para el mundo. Privada, segura, y siempre gratuita.', app: 'App', features: 'Funciones', screenshots: 'Capturas', download: 'Descargar', legal: 'Legal', privacyPolicy: 'Política de Privacidad', terms: 'Términos de Servicio', community: 'Comunidad', support: 'Soporte', allRights: 'Todos los derechos reservados.', productOf: 'Un producto de' },
    mockChat: { today: 'Hoy', message: 'Mensaje...', online: 'en línea', locationShared: 'Ubicación compartida' },
  },
  mensajes: { directMessages: 'MENSAJES DIRECTOS', groups: 'Grupos', searchChats: 'Buscar chats...', newChat: 'Nuevo Chat', noMessages: 'Sin mensajes', searchByUser: 'Buscar por @usuario, nombre o teléfono...', archived: 'Archivados', hideArchived: 'Ocultar archivados', typeMessage: 'Escribe un mensaje...', encryptedNotice: 'Tus mensajes privados están cifrados. Solo tú y el destinatario pueden leerlos.', deleteConversation: 'Eliminar conversación', deleteConversationDesc: 'Se eliminarán todos los mensajes de esta conversación. Esta acción no se puede deshacer.', leaveGroup: 'Salir del grupo', leaveGroupDesc: 'Dejarás de recibir mensajes de este grupo.', deleteGroup: 'Eliminar grupo', deleteGroupDesc: 'Se eliminará el grupo y todos sus mensajes permanentemente.', kickMember: 'Expulsar miembro', kickMemberDesc: 'Este usuario será removido del grupo.' },
  settings: { title: 'Configuración', profile: 'Perfil', privacy: 'Privacidad', security: 'Seguridad', appearance: 'Apariencia', language: 'Idioma', fullName: 'Nombre completo', username: 'Nombre de usuario', phone: 'Teléfono', bio: 'Bio', bioPlaceholder: 'Escribe algo sobre ti...', nationality: 'Nacionalidad', gender: 'Género', changeAvatar: 'Toca el icono para cambiar tu foto', saving: 'Guardando...', saveChanges: 'Guardar Cambios', signOut: 'Cerrar sesión', lastSeen: 'Última vez visto', onlineStatus: 'Estado en línea', profilePhoto: 'Foto de perfil', readReceipts: 'Confirmaciones de lectura', readReceiptsDesc: 'Mostrar palomitas azules cuando leas mensajes', everyone: 'Todos', contactsOnly: 'Solo contactos', nobody: 'Nadie', pinLock: 'Bloqueo con PIN', pinConfigured: 'PIN configurado. Tus chats están protegidos.', pinNotConfigured: 'Protege tus chats con un PIN de acceso.', lockNow: 'Bloquear ahora', removePin: 'Eliminar PIN', setupPin: 'Configurar PIN', e2eEncryption: 'Cifrado de extremo a extremo', e2eDesc: 'Tus mensajes privados están cifrados. Solo tú y el destinatario pueden leerlos.', activeSession: 'Sesión activa', browser: 'Navegador', mobile: 'Móvil', desktop: 'Escritorio', lastActivity: 'Última actividad', twoFactorAuth: 'Autenticación de dos factores', twoFactorDesc: 'Protege tu cuenta con una app de autenticación', configure2FA: 'Configurar 2FA' },
  pagos: { title: 'Pagos', send: 'Enviar', history: 'Historial', account: 'Cuenta', recipient: 'Destinatario', recipientPlaceholder: 'UUID del destinatario', amount: 'Monto (MXN)', concept: 'Concepto (opcional)', conceptPlaceholder: 'Ej: Pago de comida', paymentMethod: 'Método de pago', mercadoPago: 'Mercado Pago', oxxo: 'OXXO', sendAmount: 'Enviar', processing: 'Procesando...', searchContact: 'Buscar por nombre, @usuario o teléfono...', minAmount: 'Monto mínimo: $10 MXN', maxAmount: 'Monto máximo: $500,000 MXN', maxOxxo: 'Monto máximo para OXXO: $10,000 MXN', selectRecipient: 'Selecciona un destinatario', loginFirst: 'Inicia sesión primero', pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado', linkAccount: 'Vincula tu cuenta', linkAccountDesc: 'Vincula tu cuenta para enviar y recibir pagos', paymentSuccess: 'Pago exitoso', sendAnother: 'Enviar otro pago', biometricCancelled: 'Verificación biométrica cancelada', noTransactions: 'No hay transacciones aún' },
  seo: { title: 'MexiChat - Mensajería Segura con Pagos, Biometría y Comunidad', description: 'Mensajería privada con cifrado E2E, llamadas HD, pagos con Mercado Pago y OXXO, autenticación biométrica (Face ID, huella digital), grupos y comunidad MexiVanza. Gratis.', keywords: 'mexichat, mensajería segura, chat privado, pagos mercado pago, pagos oxxo, autenticación biométrica, face id, huella digital, cifrado extremo a extremo, mexivanza, comunidad mexicana, alternativa whatsapp', ogTitle: 'MexiChat - Mensajería Privada con Pagos y Biometría', ogDescription: 'Chat cifrado E2E, llamadas HD, pagos Mercado Pago/OXXO, Face ID/huella digital, comunidad MexiVanza. Gratis.' },
};

// ---- ENGLISH ----------
const en: Translations = {
  common: { appName: 'MexiChat', loading: 'Loading...', save: 'Save', cancel: 'Cancel', close: 'Close', delete: 'Delete', confirm: 'Confirm', back: 'Back', next: 'Next', search: 'Search', retry: 'Retry', error: 'Error', success: 'Success', optional: 'optional', select: 'Select...' },
  home: { chats: 'Chats', groups: 'Groups', payments: 'Payments', community: 'Community', settings: 'Settings' },
  landing: {
    nav: { features: 'Features', app: 'App', privacy: 'Privacy', download: 'Download', openApp: 'Open App' },
    hero: { badge: 'Made in Mexico for the world', line1: 'Your World,', line2: 'Your Chat.', subtitle: 'Private messaging with end-to-end encryption. HD calls, groups, payments via Mercado Pago & OXXO, biometric authentication, and community — all in one app.', downloadFree: 'Download Free', openBrowser: 'Open in Browser', e2eEncryption: 'E2E Encryption', free: 'Free', noAds: 'No ads', platforms: 'Platforms' },
    screens: {
      title: 'Discover MexiChat',
      subtitle: 'Everything you need, in one app',
      chats: 'Chats',
      chatsDesc: 'Private messages and groups with instant search',
      community: 'MexiVanza Community',
      communityDesc: 'Integrated social network: share content, discover MexiMart, videos and connect with Mexicans worldwide.',
      payments: 'Instant Payments',
      paymentsDesc: 'Send and receive money with Mercado Pago and OXXO directly from chat. Fast, secure, and no hidden fees.'
    },
    features: {
      title: 'Everything you need', subtitle: 'World-class features, free for everyone',
      e2e: { title: 'End-to-End Encryption', desc: 'All your messages protected with AES-256-GCM and ECDH P-256 keys. No one else can read them, not even us.' },
      calls: { title: 'HD Calls', desc: 'High-definition voice and video calls, completely free. Connect regardless of distance.' },
      community: { title: 'MexiVanza Community', desc: 'Integrated social network: share content, discover MexiMart, videos and connect with Mexicans worldwide.' },
      payments: { title: 'Instant Payments', desc: 'Send and receive money with Mercado Pago and OXXO directly from chat. Fast, secure, and no hidden fees.' },
      multiplatform: { title: 'Multi-platform', desc: 'Android, iOS and Web. Your messages synced across all your devices automatically.' },
      biometric: { title: 'Biometric Authentication', desc: 'Protect your account with Face ID, Touch ID or fingerprint. Biometric verification for payments and app access.' },
      oxxo: { title: 'OXXO Payments', desc: 'Pay at any OXXO store in Mexico. Generate your payment reference and deposit cash securely.' },
      mercadoPago: { title: 'Mercado Pago', desc: 'Link your Mercado Pago account to send and receive money instantly with Latin America\'s largest payment platform.' },
    },
    privacy: { title: 'Your Privacy, Our Promise', desc: 'MexiChat was designed from the ground up with privacy as a priority. We use end-to-end encryption for all messages and calls. We do not read your chats, sell your data, or show ads.', e2e: 'E2E Encryption', noTracking: 'No tracking', noAds: 'No ads', noDataSale: 'No data sales' },
    download: { title: 'Download MexiChat Free', subtitle: 'Available for all your devices', android: 'Android', androidReq: 'Android 8.0+', ios: 'iOS', iosReq: 'iPhone with iOS 15+', webApp: 'Web App', anyBrowser: 'Any browser', openWebApp: 'Open Web App', downloadApk: 'Download APK directly' },
    footer: { tagline: 'Mexico\'s messaging for the world. Private, secure, and always free.', app: 'App', features: 'Features', screenshots: 'Screenshots', download: 'Download', legal: 'Legal', privacyPolicy: 'Privacy Policy', terms: 'Terms of Service', community: 'Community', support: 'Support', allRights: 'All rights reserved.', productOf: 'A product of' },
    mockChat: { today: 'Today', message: 'Message...', online: 'online', locationShared: 'Location shared' },
  },
  mensajes: { directMessages: 'DIRECT MESSAGES', groups: 'Groups', searchChats: 'Search chats...', newChat: 'New Chat', noMessages: 'No messages', searchByUser: 'Search by @username, name or phone...', archived: 'Archived', hideArchived: 'Hide archived', typeMessage: 'Type a message...', encryptedNotice: 'Your private messages are encrypted. Only you and the recipient can read them.', deleteConversation: 'Delete conversation', deleteConversationDesc: 'All messages will be deleted. This cannot be undone.', leaveGroup: 'Leave group', leaveGroupDesc: 'You will stop receiving messages from this group.', deleteGroup: 'Delete group', deleteGroupDesc: 'The group and all messages will be permanently deleted.', kickMember: 'Kick member', kickMemberDesc: 'This user will be removed from the group.' },
  settings: { title: 'Settings', profile: 'Profile', privacy: 'Privacy', security: 'Security', appearance: 'Appearance', language: 'Language', fullName: 'Full name', username: 'Username', phone: 'Phone', bio: 'Bio', bioPlaceholder: 'Write something about yourself...', nationality: 'Nationality', gender: 'Gender', changeAvatar: 'Tap the icon to change your photo', saving: 'Saving...', saveChanges: 'Save Changes', signOut: 'Sign Out', lastSeen: 'Last seen', onlineStatus: 'Online status', profilePhoto: 'Profile photo', readReceipts: 'Read receipts', readReceiptsDesc: 'Show blue checkmarks when you read messages', everyone: 'Everyone', contactsOnly: 'Contacts only', nobody: 'Nobody', pinLock: 'PIN Lock', pinConfigured: 'PIN set. Your chats are protected.', pinNotConfigured: 'Protect your chats with an access PIN.', lockNow: 'Lock now', removePin: 'Remove PIN', setupPin: 'Set up PIN', e2eEncryption: 'End-to-end encryption', e2eDesc: 'Your private messages are encrypted. Only you and the recipient can read them.', activeSession: 'Active session', browser: 'Browser', mobile: 'Mobile', desktop: 'Desktop', lastActivity: 'Last activity', twoFactorAuth: 'Two-factor authentication', twoFactorDesc: 'Protect your account with an authenticator app', configure2FA: 'Set up 2FA' },
  pagos: { title: 'Payments', send: 'Send', history: 'History', account: 'Account', recipient: 'Recipient', recipientPlaceholder: 'Recipient UUID', amount: 'Amount (MXN)', concept: 'Concept (optional)', conceptPlaceholder: 'e.g. Lunch payment', paymentMethod: 'Payment method', mercadoPago: 'Mercado Pago', oxxo: 'OXXO', sendAmount: 'Send', processing: 'Processing...', searchContact: 'Search by name, @username or phone...', minAmount: 'Minimum: $10 MXN', maxAmount: 'Maximum: $500,000 MXN', maxOxxo: 'Max for OXXO: $10,000 MXN', selectRecipient: 'Select a recipient', loginFirst: 'Please sign in first', pending: 'Pending', approved: 'Approved', rejected: 'Rejected', linkAccount: 'Link your account', linkAccountDesc: 'Link your account to send and receive payments', paymentSuccess: 'Payment successful', sendAnother: 'Send another payment', biometricCancelled: 'Biometric verification cancelled', noTransactions: 'No transactions yet' },
  seo: { title: 'MexiChat - Secure Messaging with Payments, Biometrics & Community', description: 'Private messaging with E2E encryption, HD calls, Mercado Pago & OXXO payments, biometric auth (Face ID, fingerprint), groups and MexiVanza community. Free.', keywords: 'mexichat, secure messaging, private chat, mercado pago, oxxo payments, biometric authentication, face id, fingerprint, end-to-end encryption, mexivanza, whatsapp alternative', ogTitle: 'MexiChat - Private Messaging with Payments & Biometrics', ogDescription: 'E2E encrypted chat, HD calls, Mercado Pago/OXXO payments, Face ID/fingerprint, MexiVanza community. Free.' },
};

// ---- RUSSIAN ----------
const ru: Translations = {
  common: { appName: 'MexiChat', loading: 'Загрузка...', save: 'Сохранить', cancel: 'Отмена', close: 'Закрыть', delete: 'Удалить', confirm: 'Подтвердить', back: 'Назад', next: 'Далее', search: 'Поиск', retry: 'Повторить', error: 'Ошибка', success: 'Успешно', optional: 'необязательно', select: 'Выбрать...' },
  home: { chats: 'Чаты', groups: 'Группы', payments: 'Платежи', community: 'Сообщество', settings: 'Настройки' },
  landing: {
    nav: { features: 'Функции', app: 'Приложение', privacy: 'Конфиденциальность', download: 'Скачать', openApp: 'Открыть' },
    hero: { badge: 'Сделано в Мексике для мира', line1: 'Твой Мир,', line2: 'Твой Чат.', subtitle: 'Приватная переписка со сквозным шифрованием. HD-звонки, группы, платежи Mercado Pago и OXXO, биометрия и сообщество — всё в одном.', downloadFree: 'Скачать бесплатно', openBrowser: 'Открыть в браузере', e2eEncryption: 'Сквозное шифрование', free: 'Бесплатно', noAds: 'Без рекламы', platforms: 'Платформы' },
    screens: {
      title: 'Знакомьтесь с MexiChat',
      subtitle: 'Всё что нужно, в одном приложении',
      chats: 'Ваши чаты',
      chatsDesc: 'Приватные сообщения и группы с мгновенным поиском.',
      community: 'Сообщество MexiVanza',
      communityDesc: 'Встроенная соцсеть: контент, MexiMart, видео и общение с мексиканцами по всему миру.',
      payments: 'Мгновенные платежи',
      paymentsDesc: 'Отправляйте деньги через Mercado Pago и OXXO прямо из чата. Быстро и безопасно.'
    },
    features: {
      title: 'Всё что вам нужно', subtitle: 'Функции мирового класса, бесплатно для всех',
      e2e: { title: 'Сквозное шифрование', desc: 'Все сообщения защищены AES-256-GCM и ключами ECDH P-256. Никто не может их прочитать, даже мы.' },
      calls: { title: 'HD Звонки', desc: 'Голосовые и видеозвонки высокого качества, совершенно бесплатно.' },
      community: { title: 'Сообщество MexiVanza', desc: 'Встроенная соцсеть: контент, MexiMart, видео и общение с мексиканцами по всему миру.' },
      payments: { title: 'Мгновенные платежи', desc: 'Отправляйте деньги через Mercado Pago и OXXO прямо из чата. Быстро и безопасно.' },
      multiplatform: { title: 'Мультиплатформа', desc: 'Android, iOS и Web. Сообщения синхронизируются на всех устройствах.' },
      biometric: { title: 'Биометрическая аутентификация', desc: 'Защитите аккаунт с Face ID, Touch ID или отпечатком пальца.' },
      oxxo: { title: 'Платежи OXXO', desc: 'Оплата в любом магазине OXXO в Мексике наличными.' },
      mercadoPago: { title: 'Mercado Pago', desc: 'Привяжите Mercado Pago для мгновенных переводов через крупнейшую платформу Латинской Америки.' },
    },
    privacy: { title: 'Ваша конфиденциальность — наше обещание', desc: 'MexiChat создан с приоритетом конфиденциальности. Сквозное шифрование для всех сообщений и звонков. Мы не читаем чаты, не продаём данные, не показываем рекламу.', e2e: 'Сквозное шифрование', noTracking: 'Без слежки', noAds: 'Без рекламы', noDataSale: 'Без продажи данных' },
    download: { title: 'Скачайте MexiChat бесплатно', subtitle: 'Для всех устройств', android: 'Android', androidReq: 'Android 8.0+', ios: 'iOS', iosReq: 'iPhone с iOS 15+', webApp: 'Веб-приложение', anyBrowser: 'Любой браузер', openWebApp: 'Открыть веб-приложение', downloadApk: 'Скачать APK' },
    footer: { tagline: 'Мексиканский мессенджер для мира. Приватный, безопасный, бесплатный.', app: 'Приложение', features: 'Функции', screenshots: 'Скриншоты', download: 'Скачать', legal: 'Правовая информация', privacyPolicy: 'Политика конфиденциальности', terms: 'Условия использования', community: 'Сообщество', support: 'Поддержка', allRights: 'Все права защищены.', productOf: 'Продукт' },
    mockChat: { today: 'Сегодня', message: 'Сообщение...', online: 'в сети', locationShared: 'Геолокация отправлена' },
  },
  mensajes: { directMessages: 'ЛИЧНЫЕ СООБЩЕНИЯ', groups: 'Группы', searchChats: 'Поиск чатов...', newChat: 'Новый чат', noMessages: 'Нет сообщений', searchByUser: 'Поиск по @имени или телефону...', archived: 'Архив', hideArchived: 'Скрыть архив', typeMessage: 'Введите сообщение...', encryptedNotice: 'Ваши сообщения зашифрованы. Только вы и получатель можете их прочитать.', deleteConversation: 'Удалить разговор', deleteConversationDesc: 'Все сообщения будут удалены. Отменить нельзя.', leaveGroup: 'Покинуть группу', leaveGroupDesc: 'Вы перестанете получать сообщения.', deleteGroup: 'Удалить группу', deleteGroupDesc: 'Группа и сообщения будут удалены навсегда.', kickMember: 'Исключить участника', kickMemberDesc: 'Пользователь будет удалён из группы.' },
  settings: { title: 'Настройки', profile: 'Профиль', privacy: 'Конфиденциальность', security: 'Безопасность', appearance: 'Внешний вид', language: 'Язык', fullName: 'Полное имя', username: 'Имя пользователя', phone: 'Телефон', bio: 'О себе', bioPlaceholder: 'Напишите о себе...', nationality: 'Национальность', gender: 'Пол', changeAvatar: 'Нажмите для смены фото', saving: 'Сохранение...', saveChanges: 'Сохранить', signOut: 'Выйти', lastSeen: 'Последний визит', onlineStatus: 'Статус онлайн', profilePhoto: 'Фото профиля', readReceipts: 'Подтверждения прочтения', readReceiptsDesc: 'Синие галочки при прочтении', everyone: 'Все', contactsOnly: 'Только контакты', nobody: 'Никто', pinLock: 'Блокировка PIN', pinConfigured: 'PIN установлен. Чаты защищены.', pinNotConfigured: 'Защитите чаты PIN-кодом.', lockNow: 'Заблокировать', removePin: 'Удалить PIN', setupPin: 'Установить PIN', e2eEncryption: 'Сквозное шифрование', e2eDesc: 'Сообщения зашифрованы. Только вы и получатель можете их читать.', activeSession: 'Активная сессия', browser: 'Браузер', mobile: 'Мобильный', desktop: 'Компьютер', lastActivity: 'Последняя активность', twoFactorAuth: 'Двухфакторная аутентификация', twoFactorDesc: 'Защитите аккаунт приложением аутентификации', configure2FA: 'Настроить 2FA' },
  pagos: { title: 'Платежи', send: 'Отправить', history: 'История', account: 'Аккаунт', recipient: 'Получатель', recipientPlaceholder: 'UUID получателя', amount: 'Сумма (MXN)', concept: 'Описание (необязательно)', conceptPlaceholder: 'Напр: Оплата обеда', paymentMethod: 'Способ оплаты', mercadoPago: 'Mercado Pago', oxxo: 'OXXO', sendAmount: 'Отправить', processing: 'Обработка...', searchContact: 'Поиск по имени или телефону...', minAmount: 'Минимум: $10 MXN', maxAmount: 'Максимум: $500,000 MXN', maxOxxo: 'Максимум OXXO: $10,000 MXN', selectRecipient: 'Выберите получателя', loginFirst: 'Сначала войдите', pending: 'В ожидании', approved: 'Одобрено', rejected: 'Отклонено', linkAccount: 'Привяжите аккаунт', linkAccountDesc: 'Привяжите аккаунт для платежей', paymentSuccess: 'Платёж успешен', sendAnother: 'Отправить ещё', biometricCancelled: 'Биометрическая проверка отменена', noTransactions: 'Транзакций пока нет' },
  seo: { title: 'MexiChat - Безопасный мессенджер с платежами и биометрией', description: 'Приватная переписка с E2E шифрованием, HD-звонки, Mercado Pago, OXXO, биометрия, MexiVanza. Бесплатно.', keywords: 'mexichat, мессенджер, приватный чат, mercado pago, oxxo, биометрия, face id, сквозное шифрование, mexivanza', ogTitle: 'MexiChat - Приватный мессенджер с платежами', ogDescription: 'E2E чат, HD-звонки, Mercado Pago/OXXO, Face ID, MexiVanza. Бесплатно.' },
};

// ---- CHINESE ----------
const zh: Translations = {
  common: { appName: 'MexiChat', loading: '加载中...', save: '保存', cancel: '取消', close: '关闭', delete: '删除', confirm: '确认', back: '返回', next: '下一步', search: '搜索', retry: '重试', error: '错误', success: '成功', optional: '可选', select: '选择...' },
  home: { chats: '聊天', groups: '群组', payments: '支付', community: '社区', settings: '设置' },
  landing: {
    nav: { features: '功能', app: '应用', privacy: '隐私', download: '下载', openApp: '打开应用' },
    hero: { badge: '墨西哥制造，面向世界', line1: '你的世界，', line2: '你的聊天。', subtitle: '端到端加密私密通讯。高清通话、群组、Mercado Pago和OXXO支付、生物识别认证和社区——一个应用全搞定。', downloadFree: '免费下载', openBrowser: '在浏览器中打开', e2eEncryption: '端到端加密', free: '免费', noAds: '无广告', platforms: '平台' },
    screens: {
      title: '了解MexiChat',
      subtitle: '您所需的一切，尽在一个应用',
      chats: '您的会话',
      chatsDesc: '私聊和群组，支持即时搜索',
      community: 'MexiVanza社区',
      communityDesc: '集成社交网络，分享内容，发现MexiMart，视频，与全球墨西哥人建立联系。',
      payments: '即时支付',
      paymentsDesc: '通过Mercado Pago和OXXO直接在聊天中收发款项。快速、安全。'
    },
    features: {
      title: '您所需的一切', subtitle: '世界级功能，对所有人免费',
      e2e: { title: '端到端加密', desc: '所有消息均受AES-256-GCM和ECDH P-256密钥保护。任何人都无法读取。' },
      calls: { title: '高清通话', desc: '高清语音和视频通话，完全免费。无论距离多远都能连接。' },
      community: { title: 'MexiVanza社区', desc: '集成社交网络：分享内容，发现MexiMart，与全球墨西哥人建立联系。' },
      payments: { title: '即时支付', desc: '通过Mercado Pago和OXXO直接在聊天中收发款项。快速、安全。' },
      multiplatform: { title: '多平台', desc: 'Android、iOS和Web。消息在所有设备上自动同步。' },
      biometric: { title: '生物识别认证', desc: '使用Face ID、Touch ID或指纹保护账户。支付和应用访问的生物识别验证。' },
      oxxo: { title: 'OXXO支付', desc: '在墨西哥任何OXXO便利店付款。安全地存入现金。' },
      mercadoPago: { title: 'Mercado Pago', desc: '链接Mercado Pago账户，通过拉丁美洲最大支付平台即时收发款项。' },
    },
    privacy: { title: '您的隐私，我们的承诺', desc: 'MexiChat以隐私为优先设计。端到端加密所有消息和通话。我们不读取聊天，不出售数据，不展示广告。', e2e: '端到端加密', noTracking: '无追踪', noAds: '无广告', noDataSale: '不出售数据' },
    download: { title: '免费下载MexiChat', subtitle: '适用于所有设备', android: 'Android', androidReq: 'Android 8.0+', ios: 'iOS', iosReq: 'iPhone iOS 15+', webApp: '网页应用', anyBrowser: '任何浏览器', openWebApp: '打开网页应用', downloadApk: '直接下载APK' },
    footer: { tagline: '墨西哥的通讯工具，面向世界。私密、安全、永远免费。', app: '应用', features: '功能', screenshots: '截图', download: '下载', legal: '法律', privacyPolicy: '隐私政策', terms: '服务条款', community: '社区', support: '支持', allRights: '版权所有。', productOf: '产品来自' },
    mockChat: { today: '今天', message: '消息...', online: '在线', locationShared: '位置已共享' },
  },
  mensajes: { directMessages: '私信', groups: '群组', searchChats: '搜索聊天...', newChat: '新聊天', noMessages: '暂无消息', searchByUser: '按@用户名、姓名或电话搜索...', archived: '已归档', hideArchived: '隐藏归档', typeMessage: '输入消息...', encryptedNotice: '您的私人消息已加密。只有您和接收者可以阅读。', deleteConversation: '删除对话', deleteConversationDesc: '所有消息将被删除。无法撤销。', leaveGroup: '退出群组', leaveGroupDesc: '您将不再收到此群组消息。', deleteGroup: '删除群组', deleteGroupDesc: '群组及消息将被永久删除。', kickMember: '移除成员', kickMemberDesc: '此用户将从群组中移除。' },
  settings: { title: '设置', profile: '个人资料', privacy: '隐私', security: '安全', appearance: '外观', language: '语言', fullName: '全名', username: '用户名', phone: '电话', bio: '简介', bioPlaceholder: '写一些关于自己的信息...', nationality: '国籍', gender: '性别', changeAvatar: '点击图标更换照片', saving: '保存中...', saveChanges: '保存更改', signOut: '退出登录', lastSeen: '最后上线', onlineStatus: '在线状态', profilePhoto: '头像', readReceipts: '已读回执', readReceiptsDesc: '阅读消息时显示蓝色对勾', everyone: '所有人', contactsOnly: '仅联系人', nobody: '无人', pinLock: 'PIN锁', pinConfigured: 'PIN已设置，聊天已保护。', pinNotConfigured: '使用PIN码保护聊天。', lockNow: '立即锁定', removePin: '移除PIN', setupPin: '设置PIN', e2eEncryption: '端到端加密', e2eDesc: '私人消息已加密。只有您和接收者可以阅读。', activeSession: '活跃会话', browser: '浏览器', mobile: '移动端', desktop: '桌面端', lastActivity: '最后活动', twoFactorAuth: '双因素认证', twoFactorDesc: '使用认证应用保护账户', configure2FA: '设置2FA' },
  pagos: { title: '支付', send: '发送', history: '历史', account: '账户', recipient: '收款人', recipientPlaceholder: '收款人UUID', amount: '金额 (MXN)', concept: '备注（可选）', conceptPlaceholder: '例：午餐费用', paymentMethod: '支付方式', mercadoPago: 'Mercado Pago', oxxo: 'OXXO', sendAmount: '发送', processing: '处理中...', searchContact: '按姓名或电话搜索...', minAmount: '最低：$10 MXN', maxAmount: '最高：$500,000 MXN', maxOxxo: 'OXXO最高：$10,000 MXN', selectRecipient: '请选择收款人', loginFirst: '请先登录', pending: '待处理', approved: '已批准', rejected: '已拒绝', linkAccount: '关联账户', linkAccountDesc: '关联账户以收发付款', paymentSuccess: '支付成功', sendAnother: '再次发送', biometricCancelled: '生物识别验证已取消', noTransactions: '暂无交易记录' },
  seo: { title: 'MexiChat - 安全通讯，支持支付和生物识别', description: '端到端加密私密通讯，高清通话，Mercado Pago和OXXO支付，生物识别认证，MexiVanza社区。免费。', keywords: 'mexichat, 安全通讯, 私密聊天, mercado pago, oxxo, 生物识别, face id, 端到端加密, mexivanza', ogTitle: 'MexiChat - 支持支付和生物识别的私密通讯', ogDescription: 'E2E加密聊天，Mercado Pago/OXXO支付，Face ID/指纹，MexiVanza社区。免费。' },
};

const translations: Record<Language, Translations> = { es, en, ru, zh };
export default translations;

export function getTranslations(lang: Language): Translations {
  return translations[lang] || translations.es;
}