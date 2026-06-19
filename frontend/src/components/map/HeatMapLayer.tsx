import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

interface HeatPoint {
    lat: number;
    lng: number;
    intensity: number;
}

interface Props {
    points: HeatPoint[];
}

export default function HeatmapLayer({ points }: Props) {
    const map = useMap();

    useEffect(() => {
        const heatLayer = (L as any).heatLayer(
            points.map((p) => [p.lat, p.lng, p.intensity]),
            {
                radius: 40,
                blur: 30,
                maxZoom: 10,
                minOpacity: 0.3,
                gradient: {
                    0.2: "#22c55e",
                    0.4: "#eab308",
                    0.7: "#f97316",
                    1.0: "#ef4444",
                }
            }
        );

        heatLayer.addTo(map);

        return () => {
            map.removeLayer(heatLayer);
        };
    }, [map, points]);

    return null;
}