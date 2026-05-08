package com.perpustakaan.nusantara.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.perpustakaan.nusantara.data.local.ConfigStore
import com.perpustakaan.nusantara.data.model.Buku
import com.perpustakaan.nusantara.data.repository.LibraryRepository
import com.perpustakaan.nusantara.data.repository.SyncResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repository: LibraryRepository,
    private val configStore: ConfigStore
) : ViewModel() {

    val libraryName: StateFlow<String> = configStore.libraryName
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "")

    val currentMemberKode: StateFlow<String?> = configStore.currentMemberKode
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val currentMemberNama: StateFlow<String?> = configStore.currentMemberNama
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _searchQuery = MutableStateFlow("")
    val searchQuery = _searchQuery.asStateFlow()

    private val _books = MutableStateFlow<List<Buku>>(emptyList())
    val books = _books.asStateFlow()

    private val _totalBooks = MutableStateFlow(0)
    val totalBooks = _totalBooks.asStateFlow()

    private val _kategoriList = MutableStateFlow<List<String>>(emptyList())
    val kategoriList = _kategoriList.asStateFlow()

    private val _selectedKategori = MutableStateFlow<String?>(null)
    val selectedKategori = _selectedKategori.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading = _isLoading.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing = _isSyncing.asStateFlow()

    private val _syncMessage = MutableStateFlow<String?>(null)
    val syncMessage = _syncMessage.asStateFlow()

    init {
        loadBooks()
        loadKategori()

        // Debounced search
        @OptIn(FlowPreview::class)
        viewModelScope.launch {
            _searchQuery
                .debounce(300)
                .collectLatest { query ->
                    searchBooks(query)
                }
        }
    }

    fun onSearchQueryChange(query: String) {
        _searchQuery.value = query
    }

    fun onKategoriSelected(kategori: String?) {
        _selectedKategori.value = kategori
        loadBooks()
    }

    fun refresh() {
        viewModelScope.launch {
            _isSyncing.value = true
            when (val result = repository.syncAll()) {
                is SyncResult.Success -> {
                    _syncMessage.value = "Data diperbarui: ${result.buku} buku"
                    loadBooks()
                    loadKategori()
                }
                is SyncResult.Error -> {
                    _syncMessage.value = "Gagal sync: ${result.message}"
                }
            }
            _isSyncing.value = false
        }
    }

    fun clearSyncMessage() {
        _syncMessage.value = null
    }

    fun logout() {
        viewModelScope.launch {
            configStore.clearCurrentMember()
        }
    }

    private fun loadBooks() {
        viewModelScope.launch {
            _isLoading.value = true
            _books.value = repository.searchBuku(_searchQuery.value)
            _totalBooks.value = repository.getBukuCount()
            _isLoading.value = false
        }
    }

    private fun loadKategori() {
        viewModelScope.launch {
            _kategoriList.value = repository.getKategoriList()
        }
    }

    private suspend fun searchBooks(query: String) {
        _isLoading.value = true
        _books.value = repository.searchBuku(query)
        _isLoading.value = false
    }
}
