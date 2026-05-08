package com.perpustakaan.nusantara.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.perpustakaan.nusantara.ui.catalog.BookDetailScreen
import com.perpustakaan.nusantara.ui.home.HomeScreen
import com.perpustakaan.nusantara.ui.member.MemberScreen
import com.perpustakaan.nusantara.ui.reservasi.ReservasiScreen
import com.perpustakaan.nusantara.ui.review.ReviewScreen
import com.perpustakaan.nusantara.ui.scanner.ScannerScreen
import com.perpustakaan.nusantara.ui.setup.SetupScreen
import com.perpustakaan.nusantara.ui.setup.SetupViewModel
import com.perpustakaan.nusantara.ui.stats.StatsScreen
import com.perpustakaan.nusantara.ui.wishlist.WishlistScreen

object Routes {
    const val SETUP = "setup"
    const val HOME = "home"
    const val BOOK_DETAIL = "book/{kodeBuku}"
    const val SCANNER = "scanner"
    const val MEMBER = "member/{kodeAnggota}"
    const val RESERVASI = "reservasi/{kodeAnggota}"
    const val WISHLIST = "wishlist/{kodeAnggota}"
    const val STATS = "stats"
    const val REVIEW = "review/{kodeBuku}/{judulBuku}"

    fun bookDetail(kodeBuku: String) = "book/$kodeBuku"
    fun member(kodeAnggota: String) = "member/$kodeAnggota"
    fun reservasi(kodeAnggota: String) = "reservasi/$kodeAnggota"
    fun wishlist(kodeAnggota: String) = "wishlist/$kodeAnggota"
    fun review(kodeBuku: String, judulBuku: String) = "review/$kodeBuku/${java.net.URLEncoder.encode(judulBuku, "UTF-8")}"
}

@Composable
fun PerpustakaanNavHost() {
    val navController = rememberNavController()
    val setupViewModel: SetupViewModel = hiltViewModel()
    val isConfigured by setupViewModel.isConfigured.collectAsState(initial = null)

    // Wait for config check
    if (isConfigured == null) return

    val startDestination = if (isConfigured == true) Routes.HOME else Routes.SETUP

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Routes.SETUP) {
            SetupScreen(
                onSetupComplete = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.SETUP) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.HOME) {
            HomeScreen(
                onBookClick = { kodeBuku ->
                    navController.navigate(Routes.bookDetail(kodeBuku))
                },
                onScanKta = {
                    navController.navigate(Routes.SCANNER)
                },
                onStats = {
                    navController.navigate(Routes.STATS)
                }
            )
        }

        composable(
            route = Routes.BOOK_DETAIL,
            arguments = listOf(navArgument("kodeBuku") { type = NavType.StringType })
        ) { backStackEntry ->
            val kodeBuku = backStackEntry.arguments?.getString("kodeBuku") ?: return@composable
            BookDetailScreen(
                kodeBuku = kodeBuku,
                onBack = { navController.popBackStack() },
                onReservasi = { kodeAnggota ->
                    navController.navigate(Routes.reservasi(kodeAnggota))
                }
            )
        }

        composable(Routes.SCANNER) {
            ScannerScreen(
                onMemberFound = { kodeAnggota ->
                    navController.navigate(Routes.member(kodeAnggota)) {
                        popUpTo(Routes.SCANNER) { inclusive = true }
                    }
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.MEMBER,
            arguments = listOf(navArgument("kodeAnggota") { type = NavType.StringType })
        ) { backStackEntry ->
            val kodeAnggota = backStackEntry.arguments?.getString("kodeAnggota") ?: return@composable
            MemberScreen(
                kodeAnggota = kodeAnggota,
                onBack = {
                    navController.navigate(Routes.HOME) {
                        popUpTo(Routes.HOME) { inclusive = true }
                    }
                },
                onBookClick = { kodeBuku ->
                    navController.navigate(Routes.bookDetail(kodeBuku))
                },
                onReservasi = {
                    navController.navigate(Routes.reservasi(kodeAnggota))
                },
                onWishlist = {
                    navController.navigate(Routes.wishlist(kodeAnggota))
                }
            )
        }

        composable(
            route = Routes.RESERVASI,
            arguments = listOf(navArgument("kodeAnggota") { type = NavType.StringType })
        ) { backStackEntry ->
            val kodeAnggota = backStackEntry.arguments?.getString("kodeAnggota") ?: return@composable
            ReservasiScreen(
                kodeAnggota = kodeAnggota,
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Routes.WISHLIST,
            arguments = listOf(navArgument("kodeAnggota") { type = NavType.StringType })
        ) { backStackEntry ->
            val kodeAnggota = backStackEntry.arguments?.getString("kodeAnggota") ?: return@composable
            WishlistScreen(
                kodeAnggota = kodeAnggota,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.STATS) {
            StatsScreen(onBack = { navController.popBackStack() })
        }

        composable(
            route = Routes.REVIEW,
            arguments = listOf(
                navArgument("kodeBuku") { type = NavType.StringType },
                navArgument("judulBuku") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val kodeBuku = backStackEntry.arguments?.getString("kodeBuku") ?: return@composable
            val judulBuku = java.net.URLDecoder.decode(
                backStackEntry.arguments?.getString("judulBuku") ?: "", "UTF-8"
            )
            val setupVm: SetupViewModel = hiltViewModel()
            ReviewScreen(
                kodeBuku = kodeBuku,
                judulBuku = judulBuku,
                kodeAnggota = null, // TODO: get from config store
                namaAnggota = null,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
