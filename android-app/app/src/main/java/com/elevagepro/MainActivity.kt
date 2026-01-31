package com.elevagepro

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.elevagepro.ui.ElevageProApp
import com.elevagepro.ui.theme.ElevageProTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ElevageProTheme {
                ElevageProApp()
            }
        }
    }
}
