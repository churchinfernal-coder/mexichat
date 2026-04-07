package mx.mexichat.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class MexiChatMessagingService extends FirebaseMessagingService {

    private static final String TAG = "MexiChatFCM";
    private static final String CALL_CHANNEL_ID = "incoming_calls";
    private static final String MSG_CHANNEL_ID = "messages";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token: " + token.substring(0, Math.min(20, token.length())) + "...");
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Map<String, String> data = remoteMessage.getData();
        if (data.isEmpty()) {
            Log.d(TAG, "Empty data message received, ignoring");
            return;
        }

        String type = data.containsKey("type") ? data.get("type") : "message";
        Log.d(TAG, "Data message received, type=" + type);

        boolean isCall = "call".equals(type) || "incoming_call".equals(type) || "video_call".equals(type);

        if (isCall) {
            handleIncomingCall(data);
        } else {
            handleMessage(data);
        }
    }

    private void handleIncomingCall(Map<String, String> data) {
        Context ctx = getApplicationContext();

        String callerId = data.containsKey("callerId") ? data.get("callerId") :
                          data.containsKey("fromUserId") ? data.get("fromUserId") : "";
        String callerName = data.containsKey("callerName") ? data.get("callerName") :
                            data.containsKey("title") ? data.get("title") : "Llamada entrante";
        String callType = data.containsKey("callType") ? data.get("callType") : "audio";
        String conversationId = data.containsKey("conversationId") ? data.get("conversationId") : "";

        Log.d(TAG, "Incoming call from: " + callerName + " type: " + callType);

        // Wake the screen
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            PowerManager.WakeLock wl = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                "mexichat:incoming_call"
            );
            wl.acquire(30000);
        }

        // Full-screen intent -> IncomingCallActivity
        Intent fullScreenIntent = new Intent(ctx, IncomingCallActivity.class);
        fullScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreenIntent.putExtra("callerId", callerId);
        fullScreenIntent.putExtra("callerName", callerName);
        fullScreenIntent.putExtra("callType", callType);
        fullScreenIntent.putExtra("conversationId", conversationId);

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            ctx, 0, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent contentIntent = PendingIntent.getActivity(
            ctx, 1, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Reject action
        Intent rejectIntent = new Intent(ctx, IncomingCallActivity.class);
        rejectIntent.setAction("REJECT_CALL");
        rejectIntent.putExtra("callerId", callerId);
        PendingIntent rejectPendingIntent = PendingIntent.getActivity(
            ctx, 2, rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Answer action
        Intent answerIntent = new Intent(ctx, IncomingCallActivity.class);
        answerIntent.setAction("ANSWER_CALL");
        answerIntent.putExtra("callerId", callerId);
        answerIntent.putExtra("callerName", callerName);
        answerIntent.putExtra("callType", callType);
        answerIntent.putExtra("conversationId", conversationId);
        PendingIntent answerPendingIntent = PendingIntent.getActivity(
            ctx, 3, answerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String bodyText = "video".equals(callType) ? "Videollamada entrante..." : "Llamada de voz entrante...";

        createNotificationChannels();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CALL_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle(callerName)
            .setContentText(bodyText)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Rechazar", rejectPendingIntent)
            .addAction(android.R.drawable.ic_menu_call, "Contestar", answerPendingIntent)
            .setTimeoutAfter(45000);

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(9999, builder.build());
        }
    }

    private void handleMessage(Map<String, String> data) {
        Context ctx = getApplicationContext();

        String title = data.containsKey("title") ? data.get("title") : "MexiChat";
        String body = data.containsKey("body") ? data.get("body") : "Nuevo mensaje";
        String conversationId = data.containsKey("conversationId") ? data.get("conversationId") : "";
        String fromUserId = data.containsKey("fromUserId") ? data.get("fromUserId") : "";

        Intent tapIntent = new Intent(ctx, MainActivity.class);
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        tapIntent.putExtra("conversationId", conversationId);
        tapIntent.putExtra("fromUserId", fromUserId);

        PendingIntent pendingIntent = PendingIntent.getActivity(
            ctx, 100, tapIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        createNotificationChannels();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, MSG_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .setGroup("mexichat_messages")
            .setContentIntent(pendingIntent);

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            int notifId = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);
            nm.notify(notifId, builder.build());

            // Summary notification for grouping
            Notification summary = new NotificationCompat.Builder(ctx, MSG_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.sym_action_chat)
                .setContentTitle("MexiChat")
                .setContentText("Mensajes nuevos")
                .setGroup("mexichat_messages")
                .setGroupSummary(true)
                .setAutoCancel(true)
                .build();
            nm.notify(0, summary);
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        Context ctx = getApplicationContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (nm.getNotificationChannel(CALL_CHANNEL_ID) == null) {
            // Use branded ringtone from res/raw
            Uri ringtoneUri = Uri.parse("android.resource://mx.mexichat.app/raw/mexichat_ringtone");
            AudioAttributes audioAttr = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

            NotificationChannel callChannel = new NotificationChannel(
                CALL_CHANNEL_ID,
                "Llamadas entrantes",
                NotificationManager.IMPORTANCE_HIGH
            );
            callChannel.setDescription("Notificaciones de llamadas entrantes con sonido y vibracion");
            callChannel.setSound(ringtoneUri, audioAttr);
            callChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
            callChannel.enableVibration(true);
            callChannel.enableLights(true);
            callChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            callChannel.setBypassDnd(true);
            nm.createNotificationChannel(callChannel);
            Log.d(TAG, "Created call notification channel");
        }

        if (nm.getNotificationChannel(MSG_CHANNEL_ID) == null) {
            Uri msgSoundUri = Uri.parse("android.resource://mx.mexichat.app/raw/mexichat_message");
            AudioAttributes msgAudioAttr = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

            NotificationChannel msgChannel = new NotificationChannel(
                MSG_CHANNEL_ID,
                "Mensajes",
                NotificationManager.IMPORTANCE_HIGH
            );
            msgChannel.setDescription("Notificaciones de mensajes nuevos");
            msgChannel.setSound(msgSoundUri, msgAudioAttr);
            msgChannel.enableVibration(true);
            msgChannel.setVibrationPattern(new long[]{0, 300, 200, 300});
            msgChannel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            nm.createNotificationChannel(msgChannel);
            Log.d(TAG, "Created message notification channel");
        }
    }
}