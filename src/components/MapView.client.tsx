import { useEffect, useRef } from "react";
import L from "leaflet";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  mine?: boolean;
}

export interface MapViewProps {
  markers: MapMarker[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  route?: [number, number][];
  center?: [number, number];
  zoom?: number;
  className?: string;
}

export default function MapViewClient({ markers, activeId, onSelect, route, center = [37.32, -121.89], zoom = 11, className }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, scrollWheelZoom: true }).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    if (route && route.length > 1) {
      const line = L.polyline(route, { color: "#14b8a6", weight: 5, opacity: 0.85 }).addTo(g);
      m.fitBounds(line.getBounds(), { padding: [40, 40] });
    }
    markers.forEach((mk) => {
      const icon = L.divIcon({
        className: "",
        html: `<span class="price-marker ${mk.id === activeId ? "active" : ""} ${mk.mine ? "mine" : ""}">${mk.label}</span>`,
        iconSize: [0, 0],
      });
      L.marker([mk.lat, mk.lng], { icon, zIndexOffset: mk.id === activeId ? 1000 : 0 })
        .on("click", () => selectRef.current?.(mk.id))
        .addTo(g);
    });
  }, [markers, activeId, route]);

  useEffect(() => {
    const a = markers.find((m) => m.id === activeId);
    if (a && map.current) map.current.panTo([a.lat, a.lng], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  return <div ref={el} className={className ?? "h-full w-full"} />;
}
