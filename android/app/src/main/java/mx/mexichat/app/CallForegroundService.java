package mx.mexichat.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

public class CallForegroundService extends Service {

    private static final String TAG = "MexiChatCallFG";
    private static final String CHANNEL_ID = "ongoing_call";
    private static final int NOTIFICATION_ID = 8888;

    public static final String ACTION_START = "mx.mexichat.app.CALL_START";
    public static final String ACTION_STOP = "mx.mexichat.app.CALL_STOP";

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            Log.d(TAG, "Stopping foreground service");
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String callerName = "Llamada en curso";
        String callType = "audio";
        if (intent != null) {
            callerName = intent.getStringExtra("callerName");
            if (callerName == null) callerName = "Llamada en curso";
            callType = intent.getStringExtra("callType");
            if (callType == null) callType = "audio";
        }

        String bodyText = "video".equals(callType) ? "Videollamada en curso" : "Llamada de voz en curso";

        Intent tapIntent = new Intent(getApplicationContext(), MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingTap = PendingIntent.getActivity(
            getApplicationContext(), 200, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent endIntent = new Intent(getApplicationContext(), CallForegroundService.class);
        endIntent.setAction(ACTION_STOP);
        PendingIntent pendingEnd = PendingIntent.getService(
            getApplicationContext(), 201, endIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(getApplicationContext(), CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_outgoing)
            .setContentTitle(callerName)
            .setContentText(bodyText)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setContentIntent(pendingTap)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Colgar", pendingEnd)
            .build();

        Log.d(TAG, "Starting foreground service for: " + callerName);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
                | ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
            if ("video".equals(callType)) {
                serviceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
            }
            startForeground(NOTIFICATION_ID, notification, serviceType);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Foreground service destroyed");
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) getApplicationContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Llamada en curso",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Muestra cuando hay una llamada activa");
        channel.setShowBadge(false);
        nm.createNotificationChannel(channel);
    }
}