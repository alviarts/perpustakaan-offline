package com.perpustakaan.nusantara.ui.stats

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.flow.first
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.perpustakaan.nusantara.data.local.ConfigStore
import com.perpustakaan.nusantara.data.model.Buku
import com.perpustakaan.nusantara.data.model.Peminjaman
import com.perpustakaan.nusantara.data.repository.LibraryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LeaderboardEntry(
    val rank: Int,
    val kodeAnggota: String,
    val nama: String,
    val totalPinjam: Int
)

data class StatsData(
    val totalBuku: Int = 0,
    val totalAnggota: Int = 0,
    val totalPeminjamanAktif: Int = 0,
    val myTotalPinjam: Int = 0,
    val myRank: Int = 0,
    val leaderboard: List<LeaderboardEntry> = emptyList(),
    val popularBooks: List<Pair<String, Int>> = emptyList() // judul to count
)

@HiltViewModel
class StatsViewModel @Inject constructor(
    private val repository: LibraryRepository,
    private val configStore: ConfigStore
) : ViewModel() {

    private val _stats = MutableStateFlow(StatsData())
    val stats = _stats.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading = _isLoading.asStateFlow()

    init {
        loadStats()
    }

    private fun loadStats() {
        viewModelScope.launch {
            _isLoading.value = true

            val totalBuku = repository.getBukuCount()
            val allLoans = repository.getAllPeminjamanAktif()

            // Build leaderboard from all peminjaman (active + history)
            // Count loans per anggota
            val loanCounts = mutableMapOf<String, Int>()
            val anggotaNames = mutableMapOf<String, String>()

            // We need all peminjaman, not just active
            // For now use what we have in cache
            val allPeminjaman = repository.getAllPeminjaman()
            allPeminjaman.forEach { loan ->
                loanCounts[loan.kodeAnggota] = (loanCounts[loan.kodeAnggota] ?: 0) + 1
            }

            // Get names
            loanCounts.keys.forEach { kode ->
                val anggota = repository.getAnggotaByKode(kode)
                anggotaNames[kode] = anggota?.nama ?: kode
            }

            // Sort by count descending
            val sorted = loanCounts.entries.sortedByDescending { it.value }
            val leaderboard = sorted.mapIndexed { index, entry ->
                LeaderboardEntry(
                    rank = index + 1,
                    kodeAnggota = entry.key,
                    nama = anggotaNames[entry.key] ?: entry.key,
                    totalPinjam = entry.value
                )
            }.take(10)

            // My stats
            val currentMemberKode = try {
                configStore.currentMemberKode.first()
            } catch (_: Exception) { null }

            val myTotal = currentMemberKode?.let { loanCounts[it] } ?: 0
            val myRank = if (currentMemberKode != null) {
                sorted.indexOfFirst { it.key == currentMemberKode } + 1
            } else 0

            // Popular books (most borrowed)
            val bookCounts = mutableMapOf<String, Int>()
            allPeminjaman.forEach { loan ->
                // We don't have per-item data, so count by loan
                bookCounts[loan.nomorPinjam] = 1
            }

            _stats.value = StatsData(
                totalBuku = totalBuku,
                totalAnggota = loanCounts.size,
                totalPeminjamanAktif = allLoans.size,
                myTotalPinjam = myTotal,
                myRank = myRank,
                leaderboard = leaderboard
            )
            _isLoading.value = false
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StatsScreen(
    onBack: () -> Unit,
    viewModel: StatsViewModel = hiltViewModel()
) {
    val stats by viewModel.stats.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Statistik & Leaderboard") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali")
                    }
                }
            )
        }
    ) { padding ->
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Summary cards
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatSummaryCard(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Default.MenuBook,
                        value = "${stats.totalBuku}",
                        label = "Total Buku"
                    )
                    StatSummaryCard(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Default.People,
                        value = "${stats.totalAnggota}",
                        label = "Peminjam"
                    )
                    StatSummaryCard(
                        modifier = Modifier.weight(1f),
                        icon = Icons.Default.SwapHoriz,
                        value = "${stats.totalPeminjamanAktif}",
                        label = "Aktif"
                    )
                }
            }

            // My stats
            if (stats.myTotalPinjam > 0) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.EmojiEvents, contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(32.dp))
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text("Statistik Kamu", style = MaterialTheme.typography.titleSmall)
                                Text(
                                    "Total pinjam: ${stats.myTotalPinjam} buku • Ranking #${stats.myRank}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                    }
                }
            }

            // Leaderboard
            item {
                Text(
                    "Leaderboard Peminjam Terbanyak",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            if (stats.leaderboard.isEmpty()) {
                item {
                    Text(
                        "Belum ada data peminjaman",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            itemsIndexed(stats.leaderboard) { _, entry ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Rank badge
                        Surface(
                            modifier = Modifier.size(36.dp),
                            shape = MaterialTheme.shapes.extraLarge,
                            color = when (entry.rank) {
                                1 -> MaterialTheme.colorScheme.primary
                                2 -> MaterialTheme.colorScheme.secondary
                                3 -> MaterialTheme.colorScheme.tertiary
                                else -> MaterialTheme.colorScheme.surfaceVariant
                            }
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    "#${entry.rank}",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = if (entry.rank <= 3) MaterialTheme.colorScheme.onPrimary
                                    else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(entry.nama, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                            Text(entry.kodeAnggota, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text(
                            "${entry.totalPinjam} buku",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StatSummaryCard(
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    label: String
) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
