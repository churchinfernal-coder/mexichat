package mx.mexichat.app;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // SECURITY: Prevent screenshots and screen recording
        // This blocks:
        // - Manual screenshots (power + volume)
        // - Screen recording apps
        // - App switcher preview (shows blank)
        // - Casting/mirroring the app
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }
}