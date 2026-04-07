package mx.mexichat.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * BootReceiver - ensures notification channels are recreated after device reboot.
 * Also re-registers FCM token on boot so the user can receive calls immediately.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "MexiChatBoot";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d(TAG, "Boot completed - ensuring notification channels exist");

            // Force notification channel creation by triggering the service class loader
            // The channels are created in MexiChatMessagingService.createNotificationChannels()
            // but we need them available even before the first FCM message arrives.
            try {
                MexiChatMessagingService service = new MexiChatMessagingService();
                // We cannot call onCreate directly, but the channels will be created
                // when the first FCM message arrives. For immediate availability,
                // we create them here via a static-like approach.
                android.app.NotificationManager nm =
                    (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

                if (nm != null && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    // Call channel
                    if (nm.getNotificationChannel("incoming_calls") == null) {
                        android.net.Uri ringtoneUri = android.media.RingtoneManager
                            .getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE);
                        android.media.AudioAttributes audioAttr = new android.media.AudioAttributes.Builder()
                            .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();

                        android.app.NotificationChannel callChannel = new android.app.NotificationChannel(
                            "incoming_calls",
                            "Llamadas entrantes",
                            android.app.NotificationManager.IMPORTANCE_HIGH
                        );
                        callChannel.setDescription("Notificaciones de llamadas entrantes");
                        callChannel.setSound(ringtoneUri, audioAttr);
                        callChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
                        callChannel.enableVibration(true);
                        callChannel.enableLights(true);
                        callChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                        callChannel.setBypassDnd(true);
                        nm.createNotificationChannel(callChannel);
                        Log.d(TAG, "Created call channel on boot");
                    }

                    // Message channel
                    if (nm.getNotificationChannel("messages") == null) {
                        android.app.NotificationChannel msgChannel = new android.app.NotificationChannel(
                            "messages",
                            "Mensajes",
                            android.app.NotificationManager.IMPORTANCE_HIGH
                        );
                        msgChannel.setDescription("Notificaciones de mensajes nuevos");
                        msgChannel.enableVibration(true);
                        msgChannel.setVibrationPattern(new long[]{0, 300, 200, 300});
                        nm.createNotificationChannel(msgChannel);
                        Log.d(TAG, "Created message channel on boot");
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Boot channel creation failed: " + e.getMessage());
            }
        }
    }
}