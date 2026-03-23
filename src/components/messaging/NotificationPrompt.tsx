import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { setupMessageListener } from '@/lib/notification-service';
import { toast } from 'sonner';

export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    const permission = Notification.permission;
    const dismissed = sessionStorage.getItem('notification-prompt-dismissed');
    if (permission === 'default' && !dismissed) {
      setTimeout(() => setShow(true), 3000);
    }
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setupMessageListener();
        setShow(false);
        toast.success('✅ Notificaciones activadas');
      } else {
        toast.error('❌ Permiso denegado');
      }
    } catch {
      toast.error('Error al activar');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem('notification-prompt-dismissed', 'true');
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-2">
      <Card className="border-primary/20 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1">Activa las notificaciones</h3>
              <p className="text-xs text-muted-foreground mb-3">Recibe mensajes y llamadas al instante</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEnable} disabled={loading} className="flex-1">
                  {loading ? 'Activando...' : 'Activar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss} disabled={loading}>Después</Button>
              </div>
            </div>
            <button onClick={handleDismiss} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}