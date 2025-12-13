import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import { useMap } from "react-leaflet";

// 修正 icon 路徑問題
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const RoutingMachine = ({ routePoints, color }) => {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const control = L.Routing.control({
      waypoints: [],
      lineOptions: {
        // 🌟 使用傳入的顏色，若無則預設藍色
        styles: [{ color: color || "#6FA1EC", weight: 4 }]
      },
      show: false,
      addWaypoints: false,
      routeWhileDragging: false,
      fitSelectedRoutes: false, // 建議關閉自動縮放，避免多條線時畫面亂跳
      showAlternatives: false,
      createMarker: function() { return null; }
    });

    control.addTo(map);
    routingControlRef.current = control;

    return () => {
      try {
        if (map && control) {
            control.getPlan().setWaypoints([]); 
            map.removeControl(control);
        }
      } catch (e) {
        console.warn("Routing control cleanup error", e);
      }
    };
  }, [map, color]);

  // 3. 當路徑資料 (routePoints) 改變時，只更新座標點
  useEffect(() => {
    if (!routingControlRef.current) return;

    if (routePoints && routePoints.length >= 2) {
      const waypoints = routePoints.map(p => L.latLng(p.lat, p.lng));
      routingControlRef.current.setWaypoints(waypoints);
    } else {
      routingControlRef.current.setWaypoints([]);
    }
  }, [routePoints]);

  return null;
};

export default RoutingMachine;