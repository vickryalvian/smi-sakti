<?php
/**
 * data.php
 * 
 * Endpoint untuk frontend JS.
 * Mengambil data Google Sheet dan GeoJSON dari server,
 * lalu mengembalikannya dalam format JSON.
 */

header('Content-Type: application/json');

require 'config.php';

// Ambil bulan dari query string (default: January)
$month = isset($_GET['month']) ? $_GET['month'] : 'January';

// =========================
// Helper: fetch URL aman
// =========================
function fetchUrl($url){
    $opts = [
        "http" => [
            "method" => "GET",
            "header" => "User-Agent: PHP\r\n"
        ]
    ];
    $context = stream_context_create($opts);
    $response = @file_get_contents($url, false, $context);
    if($response === FALSE){
        http_response_code(500);
        echo json_encode(['error'=>"Gagal fetch URL: $url"]);
        exit;
    }
    return $response;
}

// =========================
// Ambil CSV Google Sheet
// =========================
$sheet_url = SHEET_BASE_PUBLISHED . "&sheet=" . urlencode($month);
$csv_text = fetchUrl($sheet_url);

// Fallback jika sheet tidak ada
if(empty($csv_text)){
    $sheet_url = SHEET_BASE_PUBLISHED . "&gid=0";
    $csv_text = fetchUrl($sheet_url);
}

// Parse CSV
function parseCSV($csvText){
    $rows = str_getcsv($csvText, "\n"); // split baris
    $headers = str_getcsv(array_shift($rows));
    $data = [];
    foreach($rows as $row){
        $cols = str_getcsv($row);
        $item = [];
        foreach($headers as $i => $h){
            $item[trim($h)] = isset($cols[$i]) ? trim($cols[$i]) : "";
        }
        $data[] = $item;
    }
    return $data;
}

$sheetData = parseCSV($csv_text);

// =========================
// Ambil GeoJSON
// =========================
$geojsonText = fetchUrl(GEOJSON_RAW);
$geoData = json_decode($geojsonText, true);

// =========================
// Kembalikan JSON ke frontend
// =========================
echo json_encode([
    'geojson' => $geoData,
    'sheet'   => $sheetData
]);
