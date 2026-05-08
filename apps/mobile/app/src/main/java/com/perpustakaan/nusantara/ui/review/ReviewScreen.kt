package com.perpustakaan.nusantara.ui.review

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.perpustakaan.nusantara.data.model.Review
import com.perpustakaan.nusantara.data.repository.LibraryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ReviewViewModel @Inject constructor(
    private val repository: LibraryRepository
) : ViewModel() {

    private val _reviews = MutableStateFlow<List<Review>>(emptyList())
    val reviews = _reviews.asStateFlow()

    private val _avgRating = MutableStateFlow(0f)
    val avgRating = _avgRating.asStateFlow()

    private val _submitResult = MutableStateFlow<String?>(null)
    val submitResult = _submitResult.asStateFlow()

    fun loadReviews(kodeBuku: String) {
        viewModelScope.launch {
            repository.getReviewsByBuku(kodeBuku).collect {
                _reviews.value = it
            }
        }
        viewModelScope.launch {
            _avgRating.value = repository.getAverageRating(kodeBuku)
        }
    }

    fun submitReview(kodeAnggota: String, kodeBuku: String, namaAnggota: String, judulBuku: String, rating: Int, komentar: String) {
        viewModelScope.launch {
            val result = repository.createReview(kodeAnggota, kodeBuku, namaAnggota, judulBuku, rating, komentar)
            _submitResult.value = result.fold(
                onSuccess = { "Review berhasil dikirim!" },
                onFailure = { "Gagal: ${it.message}" }
            )
        }
    }

    fun clearResult() { _submitResult.value = null }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewScreen(
    kodeBuku: String,
    judulBuku: String,
    kodeAnggota: String?,
    namaAnggota: String?,
    onBack: () -> Unit,
    viewModel: ReviewViewModel = hiltViewModel()
) {
    val reviews by viewModel.reviews.collectAsState()
    val avgRating by viewModel.avgRating.collectAsState()
    val submitResult by viewModel.submitResult.collectAsState()
    var showAddDialog by remember { mutableStateOf(false) }

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(kodeBuku) { viewModel.loadReviews(kodeBuku) }
    LaunchedEffect(submitResult) {
        submitResult?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearResult()
        }
    }

    if (showAddDialog && kodeAnggota != null) {
        AddReviewDialog(
            judulBuku = judulBuku,
            onDismiss = { showAddDialog = false },
            onSubmit = { rating, komentar ->
                viewModel.submitReview(kodeAnggota, kodeBuku, namaAnggota ?: "", judulBuku, rating, komentar)
                showAddDialog = false
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Review: $judulBuku", maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali")
                    }
                }
            )
        },
        floatingActionButton = {
            if (kodeAnggota != null) {
                FloatingActionButton(onClick = { showAddDialog = true }) {
                    Icon(Icons.Default.Star, contentDescription = "Tulis Review")
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Average rating header
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Rating Rata-rata", style = MaterialTheme.typography.labelMedium)
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                if (avgRating > 0) String.format("%.1f", avgRating) else "-",
                                style = MaterialTheme.typography.headlineMedium,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            StarRating(rating = avgRating.toInt(), size = 24)
                        }
                        Text("${reviews.size} review", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            if (reviews.isEmpty()) {
                item {
                    Text(
                        "Belum ada review untuk buku ini",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = 16.dp)
                    )
                }
            }

            items(reviews) { review ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(review.namaAnggota.ifEmpty { review.kodeAnggota },
                                style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                            StarRating(rating = review.rating, size = 16)
                        }
                        if (review.komentar.isNotBlank()) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(review.komentar, style = MaterialTheme.typography.bodySmall)
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(review.createdAt, style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
fun StarRating(rating: Int, size: Int = 20, interactive: Boolean = false, onRatingChange: (Int) -> Unit = {}) {
    Row {
        (1..5).forEach { star ->
            Icon(
                imageVector = if (star <= rating) Icons.Default.Star else Icons.Default.StarBorder,
                contentDescription = "Star $star",
                tint = if (star <= rating) Color(0xFFFFC107) else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .size(size.dp)
                    .then(if (interactive) Modifier.clickable { onRatingChange(star) } else Modifier)
            )
        }
    }
}

@Composable
private fun AddReviewDialog(
    judulBuku: String,
    onDismiss: () -> Unit,
    onSubmit: (rating: Int, komentar: String) -> Unit
) {
    var rating by remember { mutableIntStateOf(5) }
    var komentar by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Review Buku") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(judulBuku, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Text("Rating:", style = MaterialTheme.typography.labelMedium)
                StarRating(rating = rating, size = 32, interactive = true, onRatingChange = { rating = it })
                OutlinedTextField(
                    value = komentar,
                    onValueChange = { komentar = it },
                    label = { Text("Komentar (opsional)") },
                    maxLines = 4,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(onClick = { onSubmit(rating, komentar) }) { Text("Kirim") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Batal") }
        }
    )
}
