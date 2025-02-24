import { GOOGLE_MAPS_API_KEY } from './config';

let map: google.maps.Map;
let infoWindow: google.maps.InfoWindow;

async function loadGoogleMaps() {
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
  document.head.appendChild(script);
  
  return new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
  });
}

// Function to get color based on familiarity score (0-10)
function getFamiliarityColor(score: number): string {
  if (score === 0) return '#FFFFFF'; // No fill for unexplored areas
  
  // For scores 1-10, use increasingly darker orange
  const baseColor = '#F04A00';
  const opacity = (score / 10) * 0.9; // Max opacity of 0.9 for visibility
  return baseColor + Math.round(opacity * 255).toString(16).padStart(2, '0');
}

// Function to convert string coordinates to LatLng array
function parsePolygonCoordinates(coordinates: string): google.maps.LatLng[] {
  // Handle both MULTIPOLYGON and regular coordinate formats
  const coordString = coordinates.includes("MULTIPOLYGON") 
    ? coordinates.match(/\(\(\((.*?)\)\)\)/)?.[1] // Extract from MULTIPOLYGON
    : coordinates.match(/\(\((.*?)\)\)/)?.[1]; // Extract from regular POLYGON

  if (!coordString) return [];

  // Split into coordinate pairs
  const pairs = coordString.split(',').map(pair => pair.trim());
  
  // Convert to LatLng objects
  return pairs.map(pair => {
    const [lng, lat] = pair.split(' ').map(Number);
    if (!isNaN(lat) && !isNaN(lng)) {
      return new google.maps.LatLng({ lat, lng });
    }
    // Add debug logging
    console.log(`Invalid coordinate pair: ${pair}`);
    return null;
  }).filter((coord): coord is google.maps.LatLng => coord !== null);
}

function initMap(): void {
  map = new google.maps.Map(document.getElementById("map") as HTMLElement, {
    center: { lat: 37.7749, lng: -122.4194 },
    zoom: 12,
  });

  infoWindow = new google.maps.InfoWindow();

  fetch('/Neighborhoods.csv')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(csvText => {
      console.log("Full CSV text:", csvText.substring(0, 200));
      const lines = csvText.split('\n').slice(1);
      console.log("Number of lines:", lines.length);
      
      lines.forEach((line, index) => {
        if (!line.trim()) {
          console.log(`Empty line at index ${index}`);
          return;
        }

        const match = line.match(/(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g);
        if (!match) {
          console.log(`No match found for line ${index}`);
          return;
        }

        const fields = match.map(field => 
          field.replace(/^,?"?|"?,?$/g, '').replace(/""/g, '"')
        );

        const [link, coordinates, name, familiarity] = fields;
        const familiarityScore = parseInt(familiarity) || 0;

        const polygon = new google.maps.Polygon({
          paths: parsePolygonCoordinates(coordinates),
          strokeColor: "#000000",
          strokeOpacity: 0.8,
          strokeWeight: 1,
          fillColor: getFamiliarityColor(familiarityScore),
          fillOpacity: 0.5,
        });

        polygon.addListener("mouseover", (e: google.maps.PolyMouseEvent) => {
          polygon.setOptions({
            fillOpacity: 0.8,
            strokeWeight: 2
          });
        
          if (e.latLng) {
            infoWindow.setContent(`
              <div class="info-window">
                <div class="neighborhood-name">${name}</div>
                <div>Familiarity: ${familiarityScore}/10</div>
                <a href="${link}" 
                   class="neighborhood-link" 
                   target="_blank" 
                   rel="noopener noreferrer">
                  View Details →
                </a>
              </div>
            `);
            infoWindow.setPosition(e.latLng);
            infoWindow.open(map);
          }
        });

        polygon.addListener("mouseout", () => {
          polygon.setOptions({
            fillOpacity: 0.5,
            strokeWeight: 1
          });
          
          infoWindow.close();
        });

        polygon.setMap(map);
      });
    })
    .catch(error => {
      console.error('Error loading or parsing CSV:', error);
    });
}

async function initialize() {
  try {
    await loadGoogleMaps();
    initMap();
  } catch (error) {
    console.error('Failed to load Google Maps:', error);
  }
}

window.onload = initialize;

declare global {
  interface Window {
    initMap: () => void;
  }
}
window.initMap = initMap;