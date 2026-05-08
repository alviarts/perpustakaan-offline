package com.perpustakaan.nusantara.ui.member

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.perpustakaan.nusantara.data.model.Anggota
import com.perpustakaan.nusantara.data.model.Peminjaman
import com.perpustakaan.nusantara.data.repository.LibraryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MemberViewModel @Inject constructor(
    private val repository: LibraryRepository
) : ViewModel() {

    private val _anggota = MutableStateFlow<Anggota?>(null)
    val anggota = _anggota.asStateFlow()

    private val _peminjamanAktif = MutableStateFlow<List<Peminjaman>>(emptyList())
    val peminjamanAktif = _peminjamanAktif.asStateFlow()

    private val _peminjamanHistory = MutableStateFlow<List<Peminjaman>>(emptyList())
    val peminjamanHistory = _peminjamanHistory.asStateFlow()

    private val _totalDenda = MutableStateFlow(0)
    val totalDenda = _totalDenda.asStateFlow()

    fun loadMember(kodeAnggota: String) {
        viewModelScope.launch {
            _anggota.value = repository.getAnggotaByKode(kodeAnggota)
            _peminjamanAktif.value = repository.getPeminjamanAktif(kodeAnggota)
            _peminjamanHistory.value = repository.getPeminjamanHistory(kodeAnggota)
            _totalDenda.value = repository.getTotalDenda(kodeAnggota)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemberScreen(
    kodeAnggota: String,
    onBack: () -> Unit,
    onBookClick: (String) -> Unit,
    onReservasi: () -> Unit,
    onWishlist: () -> Unit,
    viewModel: MemberViewModel = hiltViewModel()
) {
    val anggota by viewModel.anggota.collectAsState()
    val peminjamanAktif by viewModel.peminjamanAktif.collectAsState()
    val peminjamanHistory by viewModel.peminjamanHistory.collectAsState()
    val totalDenda by viewModel.totalDenda.collectAsState()

    LaunchedEffect(kodeAnggota) {
        viewModel.loadMember(kodeAnggota)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Profil Anggota") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali")
                    }
                }
            )
        }
    ) { padding ->
        if (anggota == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        val member = anggota!!

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // Profile header
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Avatar
                    Surface(
                        modifier = Modifier.size(72.dp),
                        shape = MaterialTheme.shapes.extraLarge,
                        color = MaterialTheme.colorScheme.primary
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                text = member.nama.take(1).uppercase(),
                                style = MaterialTheme.typography.headlineMedium,
                                color = MaterialTheme.colorScheme.onPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = member.nama,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${member.kodeAnggota} • ${member.kelas}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Stats row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StatCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Default.MenuBook,
                    label = "Dipinjam",
                    value = "${peminjamanAktif.size}",
                    color = MaterialTheme.colorScheme.primary
                )
                StatCard(
                    modifier = Modifier.weight(1f),
                    icon = Icons.Default.Warning,
                    label = "Denda",
                    value = if (totalDenda > 0) "Rp ${formatRupiah(totalDenda)}" else "Rp 0",
                    color = if (totalDenda > 0) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onReservasi,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.BookmarkAdd, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Reservasi", style = MaterialTheme.typography.labelMedium)
                }
                OutlinedButton(
                    onClick = onWishlist,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Favorite, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Wishlist", style = MaterialTheme.typography.labelMedium)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Active loans
            Text(
                text = "Peminjaman Aktif",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(8.dp))

            if (peminjamanAktif.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Text(
                        text = "Tidak ada peminjaman aktif",
                        modifier = Modifier.padding(16.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                peminjamanAktif.forEach { loan ->
                    LoanCard(loan = loan)
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Loan history
            if (peminjamanHistory.isNotEmpty()) {
                Text(
                    text = "Riwayat Peminjaman",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(8.dp))

                peminjamanHistory.take(10).forEach { loan ->
                    LoanCard(loan = loan, isHistory = true)
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun StatCard(
    modifier: Modifier = Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
    color: androidx.compose.ui.graphics.Color
) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = color
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun LoanCard(loan: Peminjaman, isHistory: Boolean = false) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (!isHistory && loan.sisaHari < 0)
                MaterialTheme.colorScheme.errorContainer
            else MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = loan.nomorPinjam,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Surface(
                    shape = MaterialTheme.shapes.extraSmall,
                    color = when {
                        loan.status == "dikembalikan" -> MaterialTheme.colorScheme.primaryContainer
                        loan.sisaHari < 0 -> MaterialTheme.colorScheme.errorContainer
                        loan.sisaHari <= 2 -> MaterialTheme.colorScheme.secondaryContainer
                        else -> MaterialTheme.colorScheme.surfaceVariant
                    }
                ) {
                    Text(
                        text = loan.statusLabel,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row {
                Text(
                    text = "Pinjam: ",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = loan.tanggalPinjam,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            if (!isHistory) {
                Row {
                    Text(
                        text = "Jatuh tempo: ",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = loan.tanggalJatuhTempo,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = if (loan.sisaHari <= 2) FontWeight.Bold else FontWeight.Normal,
                        color = if (loan.sisaHari < 0) MaterialTheme.colorScheme.error
                        else MaterialTheme.colorScheme.onSurface
                    )
                }

                val sisaText = when {
                    loan.sisaHari < 0 -> "Terlambat ${-loan.sisaHari} hari"
                    loan.sisaHari == 0L -> "Jatuh tempo hari ini!"
                    loan.sisaHari == 1L -> "Sisa 1 hari"
                    else -> "Sisa ${loan.sisaHari} hari"
                }
                Text(
                    text = sisaText,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = when {
                        loan.sisaHari < 0 -> MaterialTheme.colorScheme.error
                        loan.sisaHari <= 2 -> MaterialTheme.colorScheme.secondary
                        else -> MaterialTheme.colorScheme.primary
                    }
                )
            } else {
                if (loan.tanggalKembali.isNotBlank()) {
                    Row {
                        Text(
                            text = "Dikembalikan: ",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = loan.tanggalKembali,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            if (loan.dendaBelumBayar > 0) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Denda: Rp ${formatRupiah(loan.dendaBelumBayar)}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.error,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

private fun formatRupiah(amount: Int): String {
    return String.format("%,d", amount).replace(',', '.')
}
