package com.elevagepro.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json

object PracticeRepository {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun load(context: Context): List<PracticeCategory> = withContext(Dispatchers.IO) {
        val raw = context.assets.open("practices.json").bufferedReader().use { it.readText() }
        json.decodeFromString(raw)
    }
}
