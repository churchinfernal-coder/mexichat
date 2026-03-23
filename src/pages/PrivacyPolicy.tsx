import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><ArrowLeft size={18} className="text-gray-700" /></button>
        <h1 className="text-lg font-bold text-gray-900">Politica de Privacidad</h1>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8 prose prose-sm prose-gray">
        <p className="text-xs text-gray-400 mb-6">Ultima actualizacion: 20 de marzo de 2026</p>

        <h2 className="text-base font-bold">1. Informacion que Recopilamos</h2>
        <p>MexiChat recopila la siguiente informacion para proporcionarte nuestros servicios de mensajeria:</p>
        <ul>
          <li><strong>Datos de registro:</strong> nombre completo, correo electronico, numero telefonico, contrasena (cifrada)</li>
          <li><strong>Datos de perfil:</strong> foto de avatar, nombre de usuario, biografia, ubicacion, nacionalidad, intereses (proporcionados voluntariamente)</li>
          <li><strong>Mensajes:</strong> el contenido de tus mensajes esta cifrado de extremo a extremo (E2EE). No podemos leer tus mensajes privados</li>
          <li><strong>Datos de uso:</strong> fecha de registro, ultima conexion, estado en linea</li>
          <li><strong>Datos tecnicos:</strong> tipo de dispositivo, sistema operativo, direccion IP (para seguridad)</li>
        </ul>

        <h2 className="text-base font-bold">2. Como Usamos tu Informacion</h2>
        <ul>
          <li>Proporcionar y mantener el servicio de mensajeria</li>
          <li>Facilitar llamadas de voz y video</li>
          <li>Enviar notificaciones sobre mensajes y llamadas</li>
          <li>Prevenir fraude, abuso y actividades ilegales</li>
          <li>Mejorar la experiencia del usuario</li>
        </ul>

        <h2 className="text-base font-bold">3. Cifrado de Extremo a Extremo</h2>
        <p>Todos los mensajes privados estan protegidos con cifrado de extremo a extremo usando AES-256-GCM con intercambio de claves ECDH P-256. Ni MexiChat ni terceros pueden leer tus mensajes.</p>

        <h2 className="text-base font-bold">4. Comparticion de Datos</h2>
        <p>NO vendemos, alquilamos ni compartimos tu informacion personal con terceros, excepto:</p>
        <ul>
          <li>Cuando sea requerido por ley o autoridades competentes</li>
          <li>Para proteger la seguridad de nuestros usuarios</li>
          <li>Con proveedores de infraestructura (Supabase) que procesan datos bajo acuerdos de confidencialidad</li>
        </ul>

        <h2 className="text-base font-bold">5. Retencion de Datos</h2>
        <p>Conservamos tus datos mientras mantengas una cuenta activa. Los mensajes con temporizador de desaparicion se eliminan automaticamente segun la configuracion del usuario.</p>

        <h2 className="text-base font-bold">6. Tus Derechos (ARCO / GDPR / LFPDPPP)</h2>
        <p>Tienes derecho a:</p>
        <ul>
          <li><strong>Acceso:</strong> solicitar una copia de tus datos personales</li>
          <li><strong>Rectificacion:</strong> corregir datos inexactos</li>
          <li><strong>Cancelacion:</strong> eliminar tu cuenta y todos los datos asociados</li>
          <li><strong>Oposicion:</strong> oponerte al procesamiento de tus datos</li>
          <li><strong>Portabilidad:</strong> exportar tus datos en formato legible</li>
        </ul>
        <p>Para ejercer estos derechos, contacta a: <strong>privacidad@mexichat.app</strong></p>

        <h2 className="text-base font-bold">7. Proteccion de Menores</h2>
        <p>MexiChat no esta disenado para menores de 13 anos. Si descubrimos que un menor de 13 anos ha creado una cuenta, la eliminaremos inmediatamente junto con todos los datos asociados.</p>

        <h2 className="text-base font-bold">8. Seguridad</h2>
        <p>Implementamos medidas de seguridad incluyendo: cifrado E2EE, HTTPS/TLS, Content Security Policy, proteccion contra XSS/CSRF, y monitoreo de accesos no autorizados.</p>

        <h2 className="text-base font-bold">9. Cambios a esta Politica</h2>
        <p>Notificaremos cualquier cambio material a traves de la aplicacion. El uso continuado despues de los cambios constituye aceptacion.</p>

        <h2 className="text-base font-bold">10. Aviso de Privacidad (LFPDPPP Mexico)</h2>
        <p>En cumplimiento con la Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares (LFPDPPP), MexiChat es responsable del tratamiento de tus datos personales. El responsable es MexiChat con domicilio en Mexico. Para consultas: <strong>privacidad@mexichat.app</strong></p>

        <h2 className="text-base font-bold">11. Contacto</h2>
        <p>Email: privacidad@mexichat.app</p>
        <p>Sitio web: mexichat.app</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
