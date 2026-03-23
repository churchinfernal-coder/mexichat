import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermsOfService: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><ArrowLeft size={18} className="text-gray-700" /></button>
        <h1 className="text-lg font-bold text-gray-900">Terminos de Servicio</h1>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8 prose prose-sm prose-gray">
        <p className="text-xs text-gray-400 mb-6">Ultima actualizacion: 20 de marzo de 2026</p>

        <h2 className="text-base font-bold">1. Aceptacion de Terminos</h2>
        <p>Al crear una cuenta o usar MexiChat, aceptas estos Terminos de Servicio, nuestra Politica de Privacidad y las Normas de la Comunidad. Si no estas de acuerdo, no uses el servicio.</p>

        <h2 className="text-base font-bold">2. Elegibilidad</h2>
        <p>Debes tener al menos 13 anos para usar MexiChat. Si eres menor de 18 anos, necesitas el consentimiento de un padre o tutor. Al registrarte, confirmas que cumples con este requisito.</p>

        <h2 className="text-base font-bold">3. Tu Cuenta</h2>
        <ul>
          <li>Eres responsable de mantener la seguridad de tu cuenta</li>
          <li>No compartas tu contrasena con nadie</li>
          <li>Notificanos inmediatamente si sospechas acceso no autorizado</li>
          <li>Una persona o entidad puede tener solo una cuenta</li>
        </ul>

        <h2 className="text-base font-bold">4. Uso Aceptable</h2>
        <p>Al usar MexiChat, te comprometes a NO:</p>
        <ul>
          <li>Enviar spam, malware o contenido malicioso</li>
          <li>Acosar, amenazar o intimidar a otros usuarios</li>
          <li>Compartir material de explotacion sexual de menores (CSAM)</li>
          <li>Promover violencia, terrorismo o actividades ilegales</li>
          <li>Suplantar la identidad de otra persona</li>
          <li>Violar derechos de propiedad intelectual</li>
          <li>Intentar acceder a cuentas o datos de otros usuarios</li>
          <li>Usar el servicio para actividades comerciales no autorizadas</li>
          <li>Interferir con el funcionamiento del servicio</li>
        </ul>

        <h2 className="text-base font-bold">5. Contenido del Usuario</h2>
        <p>Tu conservas la propiedad de tu contenido. Al publicarlo en areas publicas (Comunidad), nos otorgas una licencia limitada para mostrarlo dentro de la plataforma. Los mensajes privados son tuyos y estan cifrados.</p>

        <h2 className="text-base font-bold">6. Moderacion y Reportes</h2>
        <p>Nos reservamos el derecho de: eliminar contenido que viole estos terminos, suspender o eliminar cuentas infractoras, y cooperar con autoridades en investigaciones legales.</p>

        <h2 className="text-base font-bold">7. Llamadas de Voz y Video</h2>
        <p>Las llamadas son cifradas y peer-to-peer. MexiChat no es un servicio de telecomunicaciones y no puede usarse para llamadas de emergencia (911).</p>

        <h2 className="text-base font-bold">8. Comunidad y Marketplace (MexiMart)</h2>
        <p>MexiChat no es responsable de transacciones entre usuarios en MexiMart. Las compras se realizan bajo la responsabilidad del comprador y vendedor.</p>

        <h2 className="text-base font-bold">9. Eliminacion de Cuenta</h2>
        <p>Puedes eliminar tu cuenta en cualquier momento desde Configuracion. Al eliminar tu cuenta: se borran todos tus datos personales, se eliminan tus mensajes del servidor (los mensajes E2EE ya no son descifrables), y se remueve tu perfil de la plataforma. Esta accion es irreversible.</p>

        <h2 className="text-base font-bold">10. Limitacion de Responsabilidad</h2>
        <p>MexiChat se proporciona "tal cual". No garantizamos disponibilidad ininterrumpida. No somos responsables por perdidas derivadas del uso del servicio, incluyendo perdida de datos o interrupciones.</p>

        <h2 className="text-base font-bold">11. Legislacion Aplicable</h2>
        <p>Estos terminos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier disputa sera resuelta en los tribunales competentes de Mexico.</p>

        <h2 className="text-base font-bold">12. Contacto</h2>
        <p>Email: soporte@mexichat.app</p>
        <p>Sitio web: mexichat.app</p>
      </div>
    </div>
  );
};

export default TermsOfService;
