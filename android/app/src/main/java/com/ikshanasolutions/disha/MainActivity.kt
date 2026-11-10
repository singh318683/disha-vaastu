package com.ikshanasolutions.disha

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import com.ikshanasolutions.disha.ui.DishaRoot
import com.ikshanasolutions.disha.ui.DishaTheme

class MainActivity : ComponentActivity() {
    private val model: DishaViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = false
        setContent {
            DishaTheme {
                DishaRoot(model)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        model.attach(this)
        model.onHostResume()
        val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        if (granted) model.refreshLocationIfAllowed()
    }
}
