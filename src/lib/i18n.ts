// Multi-language support (English/Spanish)
export type Language = 'en' | 'es';

export const translations = {
  en: {
    nav: {
      home: 'Home',
      packages: 'Packages',
      destinations: 'Destinations',
      dashboard: 'Dashboard',
      admin: 'Admin',
      login: 'Login',
      logout: 'Logout',
    },
    home: {
      hero: {
        title: 'Discover Mexico',
        subtitle: 'Your adventure starts here',
        cta: 'Explore Packages',
      },
      featured: 'Featured Packages',
    },
    packages: {
      title: 'Travel Packages',
      filters: {
        destination: 'Destination',
        type: 'Type',
        price: 'Price Range',
        dates: 'Dates',
        luxury: 'Luxury',
        adventure: 'Adventure',
        cultural: 'Cultural',
      },
      bookNow: 'Book Now',
      from: 'From',
      perPerson: 'per person',
      days: 'days',
    },
    booking: {
      title: 'Book Your Trip',
      travelers: 'Number of Travelers',
      dates: 'Travel Dates',
      extras: 'Optional Extras',
      total: 'Total',
      confirm: 'Confirm Booking',
      payment: 'Proceed to Payment',
    },
    dashboard: {
      title: 'My Dashboard',
      profile: 'Profile',
      bookings: 'My Bookings',
      documents: 'Documents',
      noBookings: 'No bookings yet',
    },
    admin: {
      title: 'Admin Panel',
      packages: 'Manage Packages',
      destinations: 'Manage Destinations',
      extras: 'Manage Extras',
      bookings: 'All Bookings',
      pages: 'Manage Pages',
      addNew: 'Add New',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
    },
  },
  es: {
    nav: {
      home: 'Inicio',
      packages: 'Paquetes',
      destinations: 'Destinos',
      dashboard: 'Panel',
      admin: 'Admin',
      login: 'Iniciar Sesión',
      logout: 'Cerrar Sesión',
    },
    home: {
      hero: {
        title: 'Descubre México',
        subtitle: 'Tu aventura comienza aquí',
        cta: 'Explorar Paquetes',
      },
      featured: 'Paquetes Destacados',
    },
    packages: {
      title: 'Paquetes de Viaje',
      filters: {
        destination: 'Destino',
        type: 'Tipo',
        price: 'Rango de Precio',
        dates: 'Fechas',
        luxury: 'Lujo',
        adventure: 'Aventura',
        cultural: 'Cultural',
      },
      bookNow: 'Reservar Ahora',
      from: 'Desde',
      perPerson: 'por persona',
      days: 'días',
    },
    booking: {
      title: 'Reserva tu Viaje',
      travelers: 'Número de Viajeros',
      dates: 'Fechas de Viaje',
      extras: 'Extras Opcionales',
      total: 'Total',
      confirm: 'Confirmar Reserva',
      payment: 'Proceder al Pago',
    },
    dashboard: {
      title: 'Mi Panel',
      profile: 'Perfil',
      bookings: 'Mis Reservas',
      documents: 'Documentos',
      noBookings: 'Aún no hay reservas',
    },
    admin: {
      title: 'Panel de Administración',
      packages: 'Gestionar Paquetes',
      destinations: 'Gestionar Destinos',
      extras: 'Gestionar Extras',
      bookings: 'Todas las Reservas',
      pages: 'Gestionar Páginas',
      addNew: 'Añadir Nuevo',
      edit: 'Editar',
      delete: 'Eliminar',
      save: 'Guardar',
      cancel: 'Cancelar',
    },
  },
};

export const useTranslation = (lang: Language = 'en') => {
  return {
    t: translations[lang],
    lang,
  };
};
