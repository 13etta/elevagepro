package com.elevagepro.data

import kotlinx.serialization.Serializable

@Serializable
data class PracticeCategory(
    val category: String,
    val practices: List<Practice>
)

@Serializable
data class Practice(
    val id: String,
    val name: String
)

enum class CardType {
    PINK,
    BLUE,
    BOTH
}

data class PracticeSelection(
    val enabled: Boolean,
    val cardType: CardType
)

data class Card(
    val id: String,
    val type: CardType,
    val title: String,
    val description: String
)
