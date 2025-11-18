(function(){

  // =========================
  // CONFIG
  // =========================
  const CATEGORIES = ["longsor","banjir","ak","gb","pt","kk","khl","lga","abr","tsu","ll"];
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
  // FETCH DATA FROM SERVER
  // =========================
  async function fetchData(month){
    try {
      const res = await fetch(`/private/data.php?month=${encodeURIComponent(month)}`);
      const obj = await res.json();
      return [obj.geojson, obj.sheet];
    } catch(err){
      console.error("Fetch error:", err);
      alert("Gagal memuat data. Lihat console.");
      return [null, []];
    }
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

    html += `<small>Data diperbarui otomatis dari server</small>`;
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

    const [geo, sheetRows] = await fetchData(monthName);

    if(!geo || !sheetRows) return;

    currentData = sheetRows;
    renderGeoJSON(geo, currentData);
    resetInfoPanel();
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
