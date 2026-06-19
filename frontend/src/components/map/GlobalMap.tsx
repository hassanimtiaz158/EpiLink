import { useEffect, useState, useMemo } from "react";
import type { MapMarker } from "@/lib/api/types";
import { severityColor } from "@/lib/severity";
import { MAPBOX_TOKEN, MAPBOX_STYLE } from "@/lib/api/config";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import HeatmapLayer from "./HeatMapLayer";


interface Props {
  markers: MapMarker[];
  onSelect?: (m: MapMarker) => void;
}

/**
 * Client-only Leaflet map. Defaults to OpenStreetMap tiles.
 * If VITE_MAPBOX_TOKEN is set, Mapbox tiles are used instead.
 */
export default function GlobalMap({ markers, onSelect }: Props) {
  const [mounted, setMounted] = useState(false);
  const [mod, setMod] = useState<typeof import("react-leaflet") | null>(null);
  // react-leaflet-cluster has no TS declarations published — load dynamically.
  const [Cluster, setCluster] = useState<React.ComponentType<{
    children: React.ReactNode;
    chunkedLoading?: boolean;
  }> | null>(null);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);



  useEffect(() => {
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.warn("Geolocation error:", err)
      );
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    (async () => {
      const [rl, leaflet, cluster] = await Promise.all([
        import("react-leaflet"),
        import("leaflet"),
        import("react-leaflet-cluster") as Promise<{
          default: React.ComponentType<{ children: React.ReactNode; chunkedLoading?: boolean }>;
        }>,
      ]);
      setMod(rl);
      setL(leaflet);
      setCluster(() => cluster.default);
    })();
  }, []);

  const heatPoints = useMemo(
    () =>
      markers.map((m) => ({
        lat: m.lat,
        lng: m.lng,
        intensity:
          m.severity === "critical"
            ? m.reports
            : m.severity === "high"
              ? m.reports * 0.8
              : m.severity === "moderate"
                ? m.reports * 0.5
                : m.reports * 0.2,
      })),
    [markers]
  );

  if (!mounted || !mod || !L || !Cluster) {
    return (
      <div className="h-full w-full animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, ZoomControl, CircleMarker } = mod;

  const tileUrl = MAPBOX_TOKEN
    ? `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = MAPBOX_TOKEN
    ? '&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';


  const makeIcon = (sev: MapMarker["severity"], reports: number) => {
    const color = severityColor[sev];
    return L.divIcon({
      className: "epilink-marker",
      html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">
        <span style="position:absolute;width:42px;height:42px;border-radius:9999px;background:${color};opacity:.25;animation:epi-pulse 2s ease-out infinite"></span>
        <span style="position:relative;width:22px;height:22px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.25);color:white;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center">${reports > 99 ? "99+" : reports}</span>
      </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  };

  return (
    <MapContainer
      center={[15, 10]}
      zoom={2}
      minZoom={2}
      worldCopyJump
      zoomControl={false}
      style={{ height: "100%", width: "100%", background: "#eaf2f8" }}
    >
      <TileLayer url={tileUrl} attribution={attribution} />
      <ZoomControl position="bottomright" />
      <HeatmapLayer points={heatPoints} />
      <Cluster chunkedLoading>
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={makeIcon(m.severity, m.reports)}
            eventHandlers={{ click: () => onSelect?.(m) }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{m.disease}</div>
                <div className="text-slate-500">{m.location}</div>
                <div className="mt-1 text-xs">
                  Severity: <span className="font-medium capitalize">{m.severity}</span>
                </div>
                <div className="text-xs">Reports: {m.reports}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </Cluster>
      {userPos && (
        <CircleMarker
          center={userPos}
          radius={8}
          pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.8 }}
        >
          <Popup>Your Location</Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
