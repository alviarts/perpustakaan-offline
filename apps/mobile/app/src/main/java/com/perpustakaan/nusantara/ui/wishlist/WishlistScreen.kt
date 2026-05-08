package com.perpustakaan.nusantara.ui.wishlist

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.perpustakaan.nusantara.data.model.Wishlist
import com.perpustakaan.nusantara.data.repository.LibraryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class WishlistViewModel @Inject constructor(
    private val repository: LibraryRepository
) : ViewModel() {

    private val _wishlistItems = MutableStateFlow<List<Wishlist>>(emptyList())
    val wishlistItems = _wishlistItems.asStateFlow()

    private val _submitResult = MutableStateFlow<String?>(null)
    val submitResult = _submitResult.asStateFlow()

    private var currentKodeAnggota: String = ""

    fun loadWishlist(kodeAnggota: String) {
        currentKodeAnggota = kodeAnggota
        viewModelScope.launch {
            repository.getWishlistByAnggota(kodeAnggota).collect {
                _wishlistItems.value = it
            }
        }
    }

    fun submitWishlist(judul: String, pengarang: String, alasan: String) {
        viewModelScope.launch {
            val result = repository.createWishlist(
                kodeAnggota = currentKodeAnggota,
                judul = judul,
                pengarang = pengarang,
                alasan = alasan
            )
            _submitResult.value = result.fold(
                onSuccess = { "Wishlist berhasil dikirim!" },
                onFailure = { "Gagal: ${it.message}" }
            )
        }
    }

    fun clearSubmitResult() {
        _submitResult.value = null
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WishlistScreen(
    kodeAnggota: String,
    onBack: () -> Unit,
    viewModel: WishlistViewModel = hiltViewModel()
) {
    val wishlistItems by viewModel.wishlistItems.collectAsState()
    val submitResult by viewModel.submitResult.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(kodeAnggota) {
        viewModel.loadWishlist(kodeAnggota)
    }

    LaunchedEffect(submitResult) {
        submitResult?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSubmitResult()
        }
    }

    if (showAddDialog) {
        AddWishlistDialog(
            onDismiss = { showAddDialog = false },
            onSubmit = { judul, pengarang, alasan ->
                viewModel.submitWishlist(judul, pengarang, alasan)
                showAddDialog = false
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Wishlist Buku") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true }
            ) {
                Icon(Icons.Default.Add, contentDescription = "Tambah Wishlist")
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        if (wishlistItems.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.Favorite,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Belum ada wishlist",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Ketuk + untuk request buku baru",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(wishlistItems) { item ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = item.judul,
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.weight(1f)
                                )
                                Surface(
                                    shape = MaterialTheme.shapes.extraSmall,
                                    color = when (item.status) {
                                        "pending" -> MaterialTheme.colorScheme.secondaryContainer
                                        "disetujui" -> MaterialTheme.colorScheme.primaryContainer
                                        "sudah_diadakan" -> MaterialTheme.colorScheme.tertiaryContainer
                                        else -> MaterialTheme.colorScheme.errorContainer
                                    }
                                ) {
                                    Text(
                                        text = item.statusLabel,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                }
                            }
                            if (item.pengarang.isNotBlank()) {
                                Text(
                                    text = item.pengarang,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            if (item.alasan.isNotBlank()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "\"${item.alasan}\"",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AddWishlistDialog(
    onDismiss: () -> Unit,
    onSubmit: (judul: String, pengarang: String, alasan: String) -> Unit
) {
    var judul by remember { mutableStateOf("") }
    var pengarang by remember { mutableStateOf("") }
    var alasan by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Request Buku Baru") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = judul,
                    onValueChange = { judul = it },
                    label = { Text("Judul Buku *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = pengarang,
                    onValueChange = { pengarang = it },
                    label = { Text("Pengarang (opsional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = alasan,
                    onValueChange = { alasan = it },
                    label = { Text("Alasan (opsional)") },
                    maxLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onSubmit(judul, pengarang, alasan) },
                enabled = judul.isNotBlank()
            ) {
                Text("Kirim")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Batal")
            }
        }
    )
}
