package com.perpustakaan.nusantara.di

import android.content.Context
import androidx.room.Room
import com.perpustakaan.nusantara.data.local.AppDatabase
import com.perpustakaan.nusantara.data.remote.GoogleBooksApi
import com.perpustakaan.nusantara.data.remote.SheetsAuth
import com.perpustakaan.nusantara.data.remote.SheetsClient
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideMoshi(): Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .addInterceptor(
            HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }
        )
        .build()

    @Provides
    @Singleton
    fun provideSheetsAuth(
        httpClient: OkHttpClient,
        moshi: Moshi
    ): SheetsAuth = SheetsAuth(httpClient, moshi)

    @Provides
    @Singleton
    fun provideSheetsClient(
        httpClient: OkHttpClient,
        auth: SheetsAuth
    ): SheetsClient = SheetsClient(httpClient, auth)

    @Provides
    @Singleton
    fun provideGoogleBooksApi(
        httpClient: OkHttpClient
    ): GoogleBooksApi = GoogleBooksApi(httpClient)

    @Provides
    @Singleton
    fun provideDatabase(
        @ApplicationContext context: Context
    ): AppDatabase = Room.databaseBuilder(
        context,
        AppDatabase::class.java,
        "perpustakaan_cache.db"
    )
        .fallbackToDestructiveMigration()
        .build()
}
