//code actual math and logic behind app

//zoomable moon map 
const map = L.map('moon-map', {
crs: L.CRS.EPSG4326,
center: [0, 0],
zoom: 1,
minZoom: 0,
maxZoom: 7,
zoomSnap: 0.1,
zoomDelta: 0.5
});

// NASA moon trek global surface titles
const moonBounds = [[-90, -180], [90, 180]];
L.imageOverlay('moon-map.jpg', 
  moonBounds,  
  { attribution: 'NASA / GSFC / Arizona State University (LRO)' }
).addTo(map);
map.fitBounds(moonBounds);
//Store loaded sites and layer for map pins
let allSites = [];
const markersLayer = L.layerGroup().addTo(map);

//Create pins for whichever sites are safe for landing
function renderMapPins(sitesToDisplay) {
  markersLayer.clearLayers(); // Clear old pins before redrawing

  sitesToDisplay.forEach((site, index) => {
    L.marker([site.lat, site.lon])
      .addTo(markersLayer)
      .bindPopup(`
        <b>#${index + 1}: ${site.name}</b><br>
        <b>Suitability Score: ${site.score ?? 'N/A'} / 100</b><br>
        Category: ${site.category}<br>
        Slope: ${site.slopeDeg}° | Sunlight: ${site.sunlightPct}%<br>
        Earth Comms: ${site.earthCommsPct}% | Ice Dist: ${site.iceProximityKm} km<br>
        <i>${site.notes}</i>
      `);
  });
}

//Load sites.json and save it
fetch('sites.json')
  .then(response => response.json())
  .then(sites => {
    allSites = sites;
    // Initial default ranking on page load
    const defaultWeights = { flatness: 25, sunlight: 25, comms: 25, ice: 25 };
    const initialRanked = rankSites(allSites, defaultWeights, 20);
    renderMapPins(initialRanked);
  });


//Math calculations for finding optimal landing site
//Create a 0-100 score to normalize all factors 
function calculateScore(site, weights) {
  //Slope score: 0 = 100pts, 20+ = 0 pts
  const flatnessScore = Math.max(0, Math.min(100, 100 - (site.slopeDeg * 5)));

  //Sunlight & Earth Comms are already percentages (0-100)
  const sunlightScore = site.sunlightPct;
  const commsScore = site.earthCommsPct;


  //Ice Proximity: 0 km = 100 pts, 500+ km = 0 pts
  const iceScore = Math.max(0, Math.min(100, 100 - (site.iceProximityKm / 5)));


  //Calculate total weight 
  const totalWeight = weights.flatness + weights.sunlight + weights.comms + weights.ice;


  //Don't calculate if all sliders are set to zero
  if (totalWeight === 0) {
    return 0;
  }


  // Weighted average formula
  const weightedSum =
    (flatnessScore * weights.flatness) +
    (sunlightScore * weights.sunlight) +
    (commsScore * weights.comms) +
    (iceScore * weights.ice);


  //Round to 1 decimal place
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}


//Create score for every site, filter out unsafe locations, and sort from best to worst
function rankSites(sites, weights, maxAllowedSlope = 20) {
  return sites
    .filter(site => site.slopeDeg <= maxAllowedSlope)
    .map(site => {
      return {
        ...site,
        score: calculateScore(site, weights)
      };
    })
    .sort((a, b) => b.score - a.score);
}


//Compare any two sites across every catagory and return winners
function compareTwoSites(siteA, siteB) {
  if (!siteA || !siteB) return null;

  return {
    siteA,
    siteB,
    winners: {
      overall: siteA.score > siteB.score ? siteA.name : (siteB.score > siteA.score ? siteB.name : 'Tie'),
      slope: siteA.slopeDeg < siteB.slopeDeg ? siteA.name : (siteB.slopeDeg < siteA.slopeDeg ? siteB.name : 'Tie'),
      sunlight: siteA.sunlightPct > siteB.sunlightPct ? siteA.name : (siteB.sunlightPct > siteA.sunlightPct ? siteB.name : 'Tie'),
      comms: siteA.earthCommsPct > siteB.earthCommsPct ? siteA.name : (siteB.earthCommsPct > siteA.earthCommsPct ? siteB.name : 'Tie'),
      ice: siteA.iceProximityKm < siteB.iceProximityKm ? siteA.name : (siteB.iceProximityKm < siteA.iceProximityKm ? siteB.name : 'Tie')
    }
  };
}