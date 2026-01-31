package com.elevagepro.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.elevagepro.data.Card
import com.elevagepro.data.CardType
import com.elevagepro.data.Practice
import com.elevagepro.data.PracticeCategory
import com.elevagepro.data.PracticeRepository
import com.elevagepro.data.PracticeSelection

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ElevageProApp() {
    val context = LocalContext.current
    var categories by remember { mutableStateOf<List<PracticeCategory>>(emptyList()) }
    var selections by remember { mutableStateOf<Map<String, PracticeSelection>>(emptyMap()) }
    var tabIndex by remember { mutableStateOf(0) }

    LaunchedEffect(Unit) {
        val loaded = PracticeRepository.load(context)
        categories = loaded
        val initial = loaded.flatMap { it.practices }
            .associate { it.id to PracticeSelection(enabled = false, cardType = CardType.PINK) }
        selections = initial
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("ElevagePro") }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = tabIndex) {
                Tab(
                    selected = tabIndex == 0,
                    onClick = { tabIndex = 0 },
                    text = { Text("Checklist") }
                )
                Tab(
                    selected = tabIndex == 1,
                    onClick = { tabIndex = 1 },
                    text = { Text("Deck") }
                )
                Tab(
                    selected = tabIndex == 2,
                    onClick = { tabIndex = 2 },
                    text = { Text("Règles") }
                )
            }

            when (tabIndex) {
                0 -> ChecklistScreen(
                    categories = categories,
                    selections = selections,
                    onSelectionChange = { id, selection ->
                        selections = selections.toMutableMap().apply { put(id, selection) }
                    }
                )
                1 -> DeckScreen(categories = categories, selections = selections)
                else -> RulesScreen()
            }
        }
    }
}

@Composable
private fun ChecklistScreen(
    categories: List<PracticeCategory>,
    selections: Map<String, PracticeSelection>,
    onSelectionChange: (String, PracticeSelection) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        categories.forEach { category ->
            item {
                Text(
                    text = category.category,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
            items(category.practices) { practice ->
                val selection = selections[practice.id] ?: PracticeSelection(false, CardType.PINK)
                PracticeRow(
                    practice = practice,
                    selection = selection,
                    onSelectionChange = { onSelectionChange(practice.id, it) }
                )
            }
        }
    }
}

@Composable
private fun PracticeRow(
    practice: Practice,
    selection: PracticeSelection,
    onSelectionChange: (PracticeSelection) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(
                checked = selection.enabled,
                onCheckedChange = { checked ->
                    onSelectionChange(selection.copy(enabled = checked))
                }
            )
            Text(
                text = practice.name,
                style = MaterialTheme.typography.bodyLarge
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CardTypeChip(
                label = "Rose",
                selected = selection.cardType == CardType.PINK,
                onClick = { onSelectionChange(selection.copy(cardType = CardType.PINK)) }
            )
            CardTypeChip(
                label = "Bleue",
                selected = selection.cardType == CardType.BLUE,
                onClick = { onSelectionChange(selection.copy(cardType = CardType.BLUE)) }
            )
            CardTypeChip(
                label = "Les deux",
                selected = selection.cardType == CardType.BOTH,
                onClick = { onSelectionChange(selection.copy(cardType = CardType.BOTH)) }
            )
        }
    }
}

@Composable
private fun CardTypeChip(label: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) }
    )
}

@Composable
private fun DeckScreen(
    categories: List<PracticeCategory>,
    selections: Map<String, PracticeSelection>
) {
    val cards = remember(categories, selections) {
        generateCards(categories, selections)
    }
    val pinkCount = cards.count { it.type == CardType.PINK }
    val blueCount = cards.count { it.type == CardType.BLUE }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "Cartes sélectionnées",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(text = "Roses: $pinkCount • Bleues: $blueCount")
        }
        items(cards) { card ->
            CardRow(card)
        }
    }
}

@Composable
private fun CardRow(card: Card) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = "${card.title} (${card.type.name.lowercase()})",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = card.description,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
private fun RulesScreen() {
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Règles essentielles",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            text = "1. Consentement explicite et safe word obligatoires."
        )
        Text(
            text = "2. La domina choisit ses cartes roses. Le/la soumis·e propose ses cartes bleues; si refusées, elles sont tirées aléatoirement."
        )
        Text(
            text = "3. Toujours respecter les limites et prévoir un aftercare."
        )
    }
}

private fun generateCards(
    categories: List<PracticeCategory>,
    selections: Map<String, PracticeSelection>
): List<Card> {
    val cards = mutableListOf<Card>()
    categories.flatMap { it.practices }.forEach { practice ->
        val selection = selections[practice.id] ?: return@forEach
        if (!selection.enabled) return@forEach
        when (selection.cardType) {
            CardType.PINK -> cards.add(practice.toCard(CardType.PINK))
            CardType.BLUE -> cards.add(practice.toCard(CardType.BLUE))
            CardType.BOTH -> {
                cards.add(practice.toCard(CardType.PINK))
                cards.add(practice.toCard(CardType.BLUE))
            }
        }
    }
    return cards
}

private fun Practice.toCard(type: CardType): Card {
    val prefix = if (type == CardType.PINK) "Rose" else "Bleue"
    return Card(
        id = "${id}-${type.name.lowercase()}",
        type = type,
        title = "$prefix • $name",
        description = "Carte ${type.name.lowercase()} basée sur la pratique : $name."
    )
}
