package com.perpustakaan.nusantara.ui.setup

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.perpustakaan.nusantara.data.local.ConfigStore
import com.perpustakaan.nusantara.data.model.LibraryConfig
import com.perpustakaan.nusantara.data.repository.LibraryRepository
import com.squareup.moshi.Moshi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SetupViewModel @Inject constructor(
    private val configStore: ConfigStore,
    private val repository: LibraryRepository,
    private val moshi: Moshi
) : ViewModel() {

    val isConfigured: Flow<Boolean> = configStore.isConfigured

    private val _uiState = MutableStateFlow<SetupUiState>(SetupUiState.Idle)
    val uiState = _uiState.asStateFlow()

    /**
     * Process QR code content scanned by the camera.
     * Expected format: JSON with { v, lib, sid, sa }
     */
    fun processQrCode(rawValue: String) {
        viewModelScope.launch {
            _uiState.value = SetupUiState.Loading("Memproses QR code...")

            try {
                val config = moshi.adapter(LibraryConfig::class.java).fromJson(rawValue)
                    ?: throw Exception("Format QR tidak valid")

                if (!config.isValid()) {
                    throw Exception("Data QR tidak lengkap")
                }

                _uiState.value = SetupUiState.Loading("Menguji koneksi ke ${config.lib}...")

                // Save config first
                configStore.saveConfig(config)

                // Test connection
                val result = repository.testConnection()
                result.fold(
                    onSuccess = { spreadsheetTitle ->
                        _uiState.value = SetupUiState.Loading("Mengunduh data perpustakaan...")

                        // Initial sync
                        repository.syncAll()

                        _uiState.value = SetupUiState.Success(
                            libraryName = config.lib,
                            spreadsheetTitle = spreadsheetTitle
                        )
                    },
                    onFailure = { error ->
                        // Clear config on failure
                        configStore.clearAll()
                        _uiState.value = SetupUiState.Error(
                            "Gagal terhubung: ${error.message}"
                        )
                    }
                )
            } catch (e: Exception) {
                _uiState.value = SetupUiState.Error(
                    "QR tidak valid: ${e.message}"
                )
            }
        }
    }

    fun resetState() {
        _uiState.value = SetupUiState.Idle
    }
}

sealed class SetupUiState {
    data object Idle : SetupUiState()
    data class Loading(val message: String) : SetupUiState()
    data class Success(val libraryName: String, val spreadsheetTitle: String) : SetupUiState()
    data class Error(val message: String) : SetupUiState()
}
