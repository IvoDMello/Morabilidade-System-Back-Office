"use client";

import { MapContainer, TileLayer, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lng: number;
  raioMetros?: number;
}

export default function MapaRegiao({ lat, lng, raioMetros = 300 }: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle
        center={[lat, lng]}
        radius={raioMetros}
        pathOptions={{
          color: "#585a4f",
          fillColor: "#d8cb6a",
          fillOpacity: 0.35,
          weight: 2,
        }}
      />
    </MapContainer>
  );
}