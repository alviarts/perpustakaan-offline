package com.perpustakaan.nusantara.ui.catalog

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
import com.perpustakaan.nusantara.data.local.ConfigStore
import com.perpustakaan.nusantara.data.model.Buku
import com.perpustakaan.nusantara.data.model.Eksemplar
import com.perpustakaan.nusantara.data.remote.GoogleBooksApi
import com.perpustakaan.nusantara.data.repository.LibraryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class BookDetailViewModel @Inject constructor(
    private val repository: LibraryRepository,
    private val configStore: ConfigStore,
    private val googleBooksApi: GoogleBooksApi
) : ViewModel() {

    private val _buku = MutableStateFlow<Buku?>(null)
    val buku = _buku.asStateFlow()

    private val _coverUrl = MutableStateFlow<String?>(null)
    val coverUrl = _coverUrl.asStateFlow()

    private val _eksemplarList = MutableStateFlow<List<Eksemplar>>(emptyList())
    val eksemplarList = _eksemplarList.asStateFlow()

    private val _tersedia = MutableStateFlow(0)
    val tersedia = _tersedia.asStateFlow()

    val currentMemberKode: StateFlow<String?> = configStore.currentMemberKode
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _reservasiResult = MutableStateFlow<String?>(null)
    val reservasiResult = _reservasiResult.asStateFlow()

    fun loadBook(kodeBuku: String) {
        viewModelScope.launch {
            val book = repository.getBukuByKode(kodeBuku)
            _buku.value = book
            _eksemplarList.value = repository.getEksemplarByBuku(kodeBuku)
            _tersedia.value = repository.countTersedia(kodeBuku)

            // Fetch cover from Google Books API
            if (book != null) {
                val cover = googleBooksApi.getCover(
                    isbn = book.isbn,
                    title = book.judul,
                    author = book.pengarang
                )
                _coverUrl.value = cover
            }
        }
    }

    fun reservasi(kodeBuku: String) {
        val kodeAnggota = currentMemberKode.value ?: return
        val judul = _buku.value?.judul ?: ""
        viewModelScope.launch {
            val result = repository.createReservasi(kodeAnggota, kodeBuku, judul)
            _reservasiResult.value = result.fold(
                onSuccess = { "Reservasi berhasil! Buku akan disiapkan untukmu." },
                onFailure = { "Gagal reservasi: ${it.message}" }
            )
        }
    }

    fun clearReservasiResult() {
        _reservasiResult.value = null
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookDetailScreen(
    kodeBuku: String,
    onBack: () -> Unit,
    onReservasi: (String) -> Unit,
    viewModel: BookDetailViewModel = hiltViewModel()
) {
    val buku by viewModel.buku.collectAsState()
    val eksemplarList by viewModel.eksemplarList.collectAsState()
    val tersedia by viewModel.tersedia.collectAsState()
    val currentMemberKode by viewModel.currentMemberKode.collectAsState()
    val reservasiResult by viewModel.reservasiResult.collectAsState()
    val coverUrl by viewModel.coverUrl.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(kodeBuku) {
        viewModel.loadBook(kodeBuku)
    }

    LaunchedEffect(reservasiResult) {
        reservasiResult?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearReservasiResult()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detail Buku") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali")
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        if (buku == null) {
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

        val book = buku!!

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // Book cover — from Google Books API or placeholder
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(240.dp),
                shape = MaterialTheme.shapes.medium,
                color = MaterialTheme.colorScheme.primaryContainer
            ) {
                if (coverUrl != null) {
                    coil.compose.AsyncImage(
                        model = coverUrl,
                        contentDescription = "Cover ${book.judul}",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = androidx.compose.ui.layout.ContentScale.Fit
                    )
                } else {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.Default.MenuBook,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Title
            Text(
                text = book.judul,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Availability badge
            val isAvailable = tersedia > 0
            Surface(
                shape = MaterialTheme.shapes.small,
                color = if (isAvailable) MaterialTheme.colorScheme.primaryContainer
                else MaterialTheme.colorScheme.errorContainer
            ) {
                Text(
                    text = if (isAvailable) "Tersedia ($tersedia eksemplar)"
                    else "Tidak Tersedia",
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelMedium,
                    color = if (isAvailable) MaterialTheme.colorScheme.onPrimaryContainer
                    else MaterialTheme.colorScheme.onErrorContainer
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Metadata
            DetailRow("Pengarang", book.pengarang)
            DetailRow("Penerbit", book.penerbit)
            DetailRow("Tahun Terbit", book.tahunTerbit?.toString() ?: "-")
            DetailRow("ISBN", book.isbn)
            DetailRow("Kategori", book.kategori)
            DetailRow("Bahasa", book.bahasa)
            DetailRow("Rak", book.rak)
            DetailRow("Kode Buku", book.kodeBuku)
            DetailRow("Kode DDC", book.kodeDdc)

            if (book.deskripsi.isNotBlank()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Deskripsi",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = book.deskripsi,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Eksemplar list
            if (eksemplarList.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Eksemplar (${eksemplarList.size})",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(8.dp))
                eksemplarList.forEach { eks ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = eks.kodeEksemplar,
                            style = MaterialTheme.typography.bodySmall
                        )
                        Surface(
                            shape = MaterialTheme.shapes.extraSmall,
                            color = when (eks.status) {
                                "tersedia" -> MaterialTheme.colorScheme.primaryContainer
                                "dipinjam" -> MaterialTheme.colorScheme.secondaryContainer
                                else -> MaterialTheme.colorScheme.errorContainer
                            }
                        ) {
                            Text(
                                text = eks.status.replaceFirstChar { it.uppercase() },
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Action buttons
            if (!isAvailable && currentMemberKode != null) {
                Button(
                    onClick = { viewModel.reservasi(kodeBuku) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.secondary
                    )
                ) {
                    Icon(Icons.Default.BookmarkAdd, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Reservasi Buku Ini")
                }
            }

            if (!isAvailable && currentMemberKode == null) {
                OutlinedCard(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Info,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "Scan KTA untuk reservasi buku ini",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    if (value.isBlank() || value == "-") return
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(120.dp)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.weight(1f)
        )
    }
}
