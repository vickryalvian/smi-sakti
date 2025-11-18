(function(){

  // =========================
  // CONFIG
  // =========================
  const SHEET_BASE_PUBLISHED =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTmmXuXJ-Cjk8-w6TKQgGPF6uuKqNrDlS4eti5t__24-YhH2XNRZRZ2d-qtIB2tUKPyUCtI3Sygy9cO/pub?output=csv&single=true";

  const GEOJSON_RAW =
    "https://raw.githubusercontent.com/vickryalvian/db_heatmap/main/32.02_kecamatan.geojson";

  const CATEGORIES = ["longsor","banjir","ak","gb","pt","kk","khl","lga","abr","tsu","ll"];
  const CACHE_KEY = "geo_kec_cache_v1";
  const CACHE_DAYS = 7;

  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  let map, geoLayer;
  let currentData = [];
  let idMap = {};

  // =========================
  // COLOR FUNCTION
  // =========================
  function getColorByCount(count){
    if (count >= 30) return "#800026";
    if (count >= 15) return "#BD0026";
    if (count >= 5) return "#E31A1C";
    if (count >= 3) return "#FC4E2A";
    if (count >= 1) return "#FD8D3C";
    return "#eeeeee";
  }

  // =========================
  // HELPERS
  // =========================
  async function fetchTextWithCheck(url){
    const res = await fetch(url, {cache:"no-store"});
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    if (/<html/i.test(text)) throw new Error("Returned HTML");
    return text;
  }

  async function loadGeoJSON(){
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached){
        const obj = JSON.parse(cached);
        const ageDays = (Date.now() - obj.time) / (1000*60*60*24);
        if (ageDays < CACHE_DAYS) return obj.data;
      }
    } catch(e){}

    const res = await fetch(GEOJSON_RAW, {cache:"no-store"});
    if (!res.ok) throw new Error("GeoJSON HTTP " + res.status);
    const geo = await res.json();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({time:Date.now(), data:geo})); } catch(e){}
    return geo;
  }

  function sheetUrlsForMonth(month){
    return {
      urlByName: SHEET_BASE_PUBLISHED + "&sheet=" + encodeURIComponent(month),
      fallback:  SHEET_BASE_PUBLISHED + "&gid=0"
    };
  }

  async function loadSheetForMonth(month){
    const urls = sheetUrlsForMonth(month);
    try { return await fetchTextWithCheck(urls.urlByName); }
    catch(e){ return await fetchTextWithCheck(urls.fallback); }
  }

  function parseCSV(csvText){
    const parsed = Papa.parse(csvText.trim(), { header:true, skipEmptyLines:true });
    return parsed.data.map(row => {
      const out = {};
      Object.keys(row).forEach(k => out[k.trim()] = (row[k] || "").toString().trim());
      return out;
    });
  }

  // =========================
  // INIT MAP
  // =========================
  function initMap(){
    map = L.map("map", { zoomControl:true, preferCanvas:true })
      .setView([-6.925,106.928], 9);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom:18
    }).addTo(map);
  }

  // =========================
  // RENDER GEOJSON
  // =========================
  function renderGeoJSON(geo, sheetRows){

    // --- build ID map
    idMap = {};
    geo.features.forEach((f,idx)=>{
      const kode = (f.properties.kd_kecamatan || f.properties.KD_KECAMATAN || "").trim();
      idMap[(idx+1).toString()] = kode;
    });

    // --- build data map
    const dataMap = {};
    sheetRows.forEach(r=>{
      const short = (r.kd_kecamatan || "").trim();
      const mapped = idMap[short];
      if (!mapped) return;
      dataMap[mapped] = {
        total_bencana: Number(r.total_bencana || 0),
        manusia: Number(r.manusia || 0),
        rumah: Number(r.rumah || 0),
        _raw: r
      };
    });

    if (geoLayer) map.removeLayer(geoLayer);

    geoLayer = L.geoJSON(geo, {
      style: f => {
        const kode = (f.properties.kd_kecamatan || "").trim();
        const d = dataMap[kode];
        return {
          color: "white",
          weight: 0.8,
          fillColor: getColorByCount(d ? d.total_bencana : 0),
          fillOpacity: 0.9
        };
      },
      onEachFeature: (feature, layer)=>{
        const kode = (feature.properties.kd_kecamatan || "").trim();
        const name = feature.properties.nm_kecamatan || "Tidak diketahui";
        const d = dataMap[kode] || { total_bencana:0, manusia:0, rumah:0, _raw:{} };

        layer.on({
          mouseover: ()=>{ layer.setStyle({weight:2.2, color:"#444", fillOpacity:1}); updateInfoPanel(name,d); },
          mouseout: ()=>{ geoLayer.resetStyle(layer); resetInfoPanel(); },
          click: ()=>updateInfoPanel(name,d)
        });

        try {
          const center = layer.getBounds().getCenter();
          L.marker(center, { 
            icon:L.divIcon({ className:"kecamatan-label", html:name }), 
            interactive:false 
          }).addTo(map);
        }catch(e){}
      }
    }).addTo(map);

    // Set bounds
    const bounds = geoLayer.getBounds();
    map.fitBounds(bounds);
    map.setMaxBounds(bounds.pad(0.3));
    map.panBy([180, 0]);
  }

  // =========================
  // INFO PANEL
  // =========================
  function updateInfoPanel(name, dataObj){
    const panel = document.getElementById("info-panel");
    panel.querySelector("h3").innerText = name;

    let html = `
      <p><strong>Total Bencana:</strong> ${dataObj.total_bencana}</p>
      <p><strong>Korban Manusia:</strong> ${dataObj.manusia}</p>
      <p><strong>Rumah Rusak:</strong> ${dataObj.rumah}</p>
      <hr/>
    `;

    CATEGORIES.forEach(cat=>{
      const v = Number(dataObj._raw["data_"+cat] || 0);
      if (v>0) html += `<p><strong>${cat.toUpperCase()}:</strong> ${v}</p>`;
    });

    html += `<small>Data diperbarui otomatis dari Google Sheet</small>`;
    document.getElementById("info-content").innerHTML = html;
  }

  function resetInfoPanel(){
    document.getElementById("info-panel").querySelector("h3").innerText = "Pilih Kecamatan";
    document.getElementById("info-content").innerText = "Arahkan kursor ke kecamatan untuk melihat detail bencana.";
  }

  // =========================
  // SLIDER
  // =========================
  function setupMonthSlider(onChange){
    const slider = document.getElementById("monthSlider");
    const label = document.getElementById("monthLabel");

    slider.addEventListener("input", ()=>{
      const idx = Number(slider.value)-1;
      const m = MONTHS[idx];
      label.innerText = m;
      onChange(m);
    });

    label.innerText = MONTHS[Number(slider.value)-1];
  }

  // =========================
  // START
  // =========================
  async function start(monthName){
    try { initMap(); } catch(e){ return; }

    try {
      const [geo, csvText] = await Promise.all([
        loadGeoJSON(),
        loadSheetForMonth(monthName)
      ]);

      currentData = parseCSV(csvText||"");
      renderGeoJSON(geo, currentData);
      resetInfoPanel();

    } catch(err){
      console.error("Load error:", err);
      alert("Gagal memuat data. Lihat Console.");
    }
  }

  function boot(){
    const initialMonth = MONTHS[0];
    setupMonthSlider((m)=>start(m));
    start(initialMonth);
  }

  if (window.elementorFrontend && elementorFrontend.hooks){
    elementorFrontend.hooks.addAction("frontend/element_ready/widget", boot);
  } else {
    window.addEventListener("load", boot);
  }

})();
