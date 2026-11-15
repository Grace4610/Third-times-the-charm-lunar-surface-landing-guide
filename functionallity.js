//Rocket and lander profiles
const rockets = {
  robotic: {
    name: "Robotic Lander",
    maxSlope: 15,
    minSunlight: 15,
    minCommunication: 30,
    description: "Designed for robotic scientific exploration and smaller payloads."
  },
  crewed: {
    name: "Crewed Lander",
    maxSlope: 8,
    minSunlight: 35,
    minCommunication: 70,
    description: "More restrictive landing requirements for crew safety, power and communications."
  },
  cargo: {
    name: "Heavy Cargo Lander",
    maxSlope: 10,
    minSunlight: 20,
    minCommunication: 40,
    description: "Designed for larger payloads and relatively stable landing terrain."
  }
};

//html
const sliders = {
  slope: document.getElementById("slope"),
  communication: document.getElementById("communication"),
  sunlight: document.getElementById("sunlight"),
  ice: document.getElementById("ice")
};

const rocketSelect = document.getElementById("rocket");
const resultsDiv = document.getElementById("results");
const bestSiteDiv = document.getElementById("best-site");
const selectedSiteDiv = document.getElementById("selected-site");

//The moon map
const map = L.map("moon-map", {
  crs: L.CRS.EPSG4326,
  center:[0, 0],
  zoom: 1,
  minZoom: 0,
  maxZoom: 7,
  zoomSnap: 0.1,
  zoomDelta: 0.5
});

const moonBounds = [[-90, -180], [90, 180]];
L.imageOverlay("moon-map.jpg", moonBounds, {
  attribution: "NASA / GSFC / Arizona State University (LRO)"
}).addTo(map);
map.fitBounds(moonBounds);
map.setMaxBounds(moonBounds);

let markers = {};
let lunarSites = [];

//Load the lunar location data
fetch("sites.json")
  .then(response => {
    if (!response.ok) {
      throw new Error("Could not load sites.json");
    }
    return response.json();
  })
  .then(sites => {
    lunarSites = sites;

    lunarSites.forEach(site => {
      const marker = L.circleMarker([site.lat, site.lon], {
        radius: 8,
        color: "#ffffff",
        fillColor: "#55b8ff",
        fillOpacity: 0.9,
        weight: 2
      }).addTo(map);

      marker.bindPopup(`
        <b>${site.name}</b><br>
        Category: ${site.category}<br>
        Slope: ${site.slopeDeg}°<br>
        Sunlight: ${site.sunlightPct}%<br>
        Earth Communication: ${site.earthCommsPct}%<br>
        Ice Distance: ${site.iceProximityKm} km<br><br>
        <i>${site.notes}</i>
      `);

      marker.on("click", () => {
        showSelectedSite(site);
      });

      markers[site.id] = marker;
    });

    updateCalculations();
  })
  .catch(error => {
    console.error(error);
    resultsDiv.innerHTML =
      "<p>Error loading lunar data. Check sites.json and run the project using a local web server.</p>";
  });

//sliders and scoring
function getWeights() {
  const values = {
    slope: Number(sliders.slope.value),
    communication: Number(sliders.communication.value),
    sunlight: Number(sliders.sunlight.value),
    ice: Number(sliders.ice.value)
  };

  const total = Object.values(values).reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    return { slope: 0.25, communication: 0.25, sunlight: 0.25, ice: 0.25 };
  }

  return {
    slope: values.slope / total,
    communication: values.communication / total,
    sunlight: values.sunlight / total,
    ice: values.ice / total
  };
}

function calculateFactorScores(site) {
  return {
    slope: Math.max(0, Math.min(100, 100 * (1 - site.slopeDeg / 20))),
    communication: Math.max(0, Math.min(100, site.earthCommsPct)),
    sunlight: Math.max(0, Math.min(100, site.sunlightPct)),
    ice: Math.max(0, Math.min(100, 100 * (1 - site.iceProximityKm / 3000)))
  };
}

function calculateWeightedScore(site) {
  const weights = getWeights();
  const factors = calculateFactorScores(site);

  const score =
    factors.slope * weights.slope +
    factors.communication * weights.communication +
    factors.sunlight * weights.sunlight +
    factors.ice * weights.ice;

  return {
    score: Number(score.toFixed(1)),
    factors: factors
  };
}

//Rocket compatibility
function checkCompatibility(site) {
  const rocket = rockets[rocketSelect.value];
  const conditions = {
    slope: site.slopeDeg <= rocket.maxSlope,
    sunlight: site.sunlightPct >= rocket.minSunlight,
    communication: site.earthCommsPct >= rocket.minCommunication
  };

  return {
    compatible: Object.values(conditions).every(Boolean),
    conditions: conditions,
    rocket: rocket
  };
}

//Update rankings
function updateCalculations() {
  if (lunarSites.length === 0) return;

  document.getElementById("slope-value").textContent = sliders.slope.value + "%";
  document.getElementById("communication-value").textContent = sliders.communication.value + "%";
  document.getElementById("sunlight-value").textContent = sliders.sunlight.value + "%";
  document.getElementById("ice-value").textContent = sliders.ice.value + "%";

  const rocket = rockets[rocketSelect.value];
  document.getElementById("rocket-info").innerHTML = `
    <p>${rocket.description}</p>
    <p>
      Maximum slope: ${rocket.maxSlope}°<br>
      Minimum sunlight: ${rocket.minSunlight}%<br>
      Minimum Earth communication: ${rocket.minCommunication}%
    </p>
  `;

  const rankedSites = lunarSites.map(site => {
    const calculation = calculateWeightedScore(site);
    const compatibility = checkCompatibility(site);
    return {
      ...site,
      score: calculation.score,
      factors: calculation.factors,
      compatible: compatibility.compatible,
      conditions: compatibility.conditions
    };
  });

 rankedSites.sort((a, b) => {
  //Always place compatible sites above non-compatible sites
  if (a.compatible !== b.compatible) {
    return a.compatible ? -1 : 1;
  }
  //Sort from highest score to lowest score
  return b.score - a.score;
});

  displayResults(rankedSites);
  updateMarkers(rankedSites);
}

//Display results and recomended sites
function displayResults(sites) {
  resultsDiv.innerHTML = "";

  const compatibleSites = sites.filter(site => site.compatible);
  const bestSite = compatibleSites[0];

  if (bestSite) {
    bestSiteDiv.innerHTML = `
      <h3>⭐ Recommended Landing Location</h3>
      <h2>${bestSite.name}</h2>
      <div class="score">${bestSite.score}/100</div>
      <p>This is the highest-scoring location that meets the selected rocket's compatibility requirements.</p>
      <button onclick="selectSite('${bestSite.id}')">View on Moon Map</button>
    `;
  } else {
    bestSiteDiv.innerHTML = `
      <h3>No Compatible Landing Locations</h3>
      <p>None of the supplied locations meet all the selected rocket requirements. Try another rocket profile.</p>
    `;
  }

  sites.forEach((site, index) => {
    const status = site.compatible ? "Compatible" : "Not Compatible";
    const statusClass = site.compatible ? "compatible" : "incompatible";

    const card = document.createElement("div");
    card.className = "site-result";
    card.innerHTML = `
      <h3>${index + 1}. ${site.name}</h3>
      <div class="score">${site.score}/100</div>
      <div class="score-bar">
        <div class="score-fill" style="width:${site.score}%"></div>
      </div>
      <p class="${statusClass}">${status}</p>
      <div class="result-details">
        Category: ${site.category}<br>
        Slope: ${site.slopeDeg}°<br>
        Sunlight: ${site.sunlightPct}%<br>
        Earth Communication: ${site.earthCommsPct}%<br>
        Distance to Ice: ${site.iceProximityKm} km
      </div>
      <button class="view-button">View Location</button>
    `;

    card.querySelector("button").addEventListener("click", () => selectSite(site.id));
    resultsDiv.appendChild(card);
  });
}

// update color coded markers
function updateMarkers(sites) {
  sites.forEach(site => {
    const marker = markers[site.id];
    if (!marker) return;

    if (site.compatible) {
      marker.setStyle({ fillColor: "#42e68b", color: "#ffffff" });
    } else {
      marker.setStyle({ fillColor: "#ff6262", color: "#ffffff" });
    }

    marker.setPopupContent(`
      <b>${site.name}</b><br>
      Score: ${site.score}/100<br>
      Rocket Compatible: ${site.compatible ? "Yes" : "No"}<br>
      Slope: ${site.slopeDeg}°<br>
      Sunlight: ${site.sunlightPct}%<br>
      Earth Communication: ${site.earthCommsPct}%<br>
      Ice Distance: ${site.iceProximityKm} km<br><br>
      <i>${site.notes}</i>
    `);
  });
}

//select and veiw site
function selectSite(id) {
  const site = lunarSites.find(location => location.id === id);
  if (!site) return;

  document.getElementById("moon-map").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  //apply normal green/red colors first, then highlight the selected pin in gold
  updateCalculations();
  const marker = markers[id];
  if (marker) {
    marker.setStyle({
      fillColor: "#ffd166",
      color: "#ffffff",
      radius: 12,
      weight: 3
    });
    marker.bringToFront();

    // Zoom into the landing site and open its popup card
    map.setView([site.lat, site.lon], 3);
    marker.openPopup();
  }
  showSelectedSite(site);
}

function showSelectedSite(site) {
  const calculation = calculateWeightedScore(site);
  const compatibility = checkCompatibility(site);

  selectedSiteDiv.innerHTML = `
    <h3>${site.name}</h3>
    <p><strong>Category:</strong> ${site.category}</p>
    <p><strong>Coordinates:</strong> ${site.lat}°, ${site.lon}°</p>
    <p><strong>Weighted Score:</strong> ${calculation.score}/100</p>
    <p><strong>Rocket Compatibility:</strong>
      <span class="${compatibility.compatible ? "compatible" : "incompatible"}">
        ${compatibility.compatible ? "Compatible" : "Not Compatible"}
      </span>
    </p>
    <hr>
    <h3>Environmental Conditions</h3>
    Slope: ${site.slopeDeg}°<br>
    Sunlight: ${site.sunlightPct}%<br>
    Earth Communication: ${site.earthCommsPct}%<br>
    Water Ice Distance: ${site.iceProximityKm} km
    <hr>
    <h3>Factor Scores</h3>
    Slope suitability: ${calculation.factors.slope.toFixed(1)}/100<br>
    Communication: ${calculation.factors.communication.toFixed(1)}/100<br>
    Sunlight: ${calculation.factors.sunlight.toFixed(1)}/100<br>
    Ice proximity: ${calculation.factors.ice.toFixed(1)}/100
    <hr>
    <h3>Rocket Requirements</h3>
    Slope: ${compatibility.conditions.slope ? "Pass" : "Fail"}<br>
    Sunlight: ${compatibility.conditions.sunlight ? "Pass" : "Fail"}<br>
    Communication: ${compatibility.conditions.communication ? "Pass" : "Fail"}
    <hr>
    <p>${site.notes}</p>
  `;
}

//Event listeners
Object.values(sliders).forEach(slider => {
  slider.addEventListener("input", updateCalculations);
});

rocketSelect.addEventListener("change", updateCalculations);