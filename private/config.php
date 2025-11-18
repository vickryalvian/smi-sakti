<?php
/**
 * config.php
 * 
 * File konfigurasi untuk proyek Peta Bencana.
 * Menyimpan URL Google Sheet, GeoJSON, dan pengaturan cache.
 */

// =========================
// DATA SOURCES
// =========================

// URL Google Sheet publik
define('SHEET_BASE_PUBLISHED', 
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTmmXuXJ-Cjk8-w6TKQgGPF6uuKqNrDlS4eti5t__24-YhH2XNRZRZ2d-qtIB2tUKPyUCtI3Sygy9cO/pub?output=csv&single=true'
);

// URL GeoJSON raw
define('GEOJSON_RAW', 
    'https://raw.githubusercontent.com/vickryalvian/db_heatmap/main/32.02_kecamatan.geojson'
);

// =========================
// CACHE SETTINGS
// =========================
define('CACHE_KEY', 'geo_kec_cache_v1');
define('CACHE_DAYS', 7);

// =========================
// CATEGORIES
// =========================
$CATEGORIES = ["longsor","banjir","ak","gb","pt","kk","khl","lga","abr","tsu","ll"];

// =========================
// MONTHS
// =========================
$MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
];
