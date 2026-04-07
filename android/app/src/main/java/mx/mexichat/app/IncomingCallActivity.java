package mx.mexichat.app;

import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class IncomingCallActivity extends AppCompatActivity {

    private Vibrator vibrator;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Show over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) {
                km.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            );
        }

        // Handle reject/answer actions from notification buttons
        String action = getIntent().getAction();
        if ("REJECT_CALL".equals(action)) {
            cancelNotification();
            finish();
            return;
        }
        if ("ANSWER_CALL".equals(action)) {
            cancelNotification();
            launchMainWithCall(getIntent());
            finish();
            return;
        }

        // Extract call data
        String callerName = getIntent().getStringExtra("callerName");
        if (callerName == null) callerName = "Llamada entrante";
        String callType = getIntent().getStringExtra("callType");
        if (callType == null) callType = "audio";

        // Start vibration
        startVibration();

        // Build UI programmatically (no XML layout needed)
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(android.view.Gravity.CENTER);
        root.setBackgroundColor(0xFF030712);
        root.setPadding(48, 120, 48, 120);

        TextView callLabel = new TextView(this);
        callLabel.setText("video".equals(callType) ? "Videollamada entrante" : "Llamada de voz entrante");
        callLabel.setTextColor(0xFF9CA3AF);
        callLabel.setTextSize(16);
        callLabel.setGravity(android.view.Gravity.CENTER);
        root.addView(callLabel);

        TextView nameLabel = new TextView(this);
        nameLabel.setText(callerName);
        nameLabel.setTextColor(0xFFFFFFFF);
        nameLabel.setTextSize(28);
        nameLabel.setGravity(android.view.Gravity.CENTER);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        nameParams.topMargin = 24;
        nameLabel.setLayoutParams(nameParams);
        root.addView(nameLabel);

        // Spacer
        View spacer = new View(this);
        LinearLayout.LayoutParams spacerParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1.0f);
        spacer.setLayoutParams(spacerParams);
        root.addView(spacer);

        // Buttons row
        LinearLayout btnRow = new LinearLayout(this);
        btnRow.setOrientation(LinearLayout.HORIZONTAL);
        btnRow.setGravity(android.view.Gravity.CENTER);

        Button rejectBtn = new Button(this);
        rejectBtn.setText("Rechazar");
        rejectBtn.setTextColor(0xFFFFFFFF);
        rejectBtn.setBackgroundColor(0xFFEF4444);
        rejectBtn.setPadding(64, 32, 64, 32);
        rejectBtn.setOnClickListener(v -> {
            stopVibration();
            cancelNotification();
            finish();
        });

        Button answerBtn = new Button(this);
        answerBtn.setText("Contestar");
        answerBtn.setTextColor(0xFFFFFFFF);
        answerBtn.setBackgroundColor(0xFF22C55E);
        answerBtn.setPadding(64, 32, 64, 32);
        answerBtn.setOnClickListener(v -> {
            stopVibration();
            cancelNotification();
            launchMainWithCall(getIntent());
            finish();
        });

        LinearLayout.LayoutParams btnParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        btnParams.setMargins(24, 0, 24, 0);

        btnRow.addView(rejectBtn, btnParams);
        btnRow.addView(answerBtn, btnParams);
        root.addView(btnRow);

        setContentView(root);
    }

    private void launchMainWithCall(Intent source) {
        Intent main = new Intent(this, MainActivity.class);
        main.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        main.putExtra("callerId", source.getStringExtra("callerId"));
        main.putExtra("callerName", source.getStringExtra("callerName"));
        main.putExtra("callType", source.getStringExtra("callType"));
        main.putExtra("conversationId", source.getStringExtra("conversationId"));
        main.putExtra("autoAcceptCall", true);
        startActivity(main);
    }

    private void startVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) vibrator = vm.getDefaultVibrator();
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 1000, 500, 1000, 500, 1000};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            // Never crash on vibration failure
        }
    }

    private void stopVibration() {
        try {
            if (vibrator != null) vibrator.cancel();
        } catch (Exception e) {
            // silent
        }
    }

    private void cancelNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(9999);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopVibration();
    }
}