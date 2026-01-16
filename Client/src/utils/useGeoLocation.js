import { useState, useEffect } from 'react';

export const useGeoLocation = () => {
  const [coords, setCoords] = useState({ lat: 0, lng: 0 });
  const [error, setError] = useState(null);

  useEffect(() => {
    // 微信/移动端获取位置配置
    const options = {
      enableHighAccuracy: true, // 开启高精度
      timeout: 10000,
      maximumAge: 0
    };

    let lastLat = 0;
    let lastLng = 0;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        // 1. 精度过滤：如果精度误差超过100米，丢弃该点
        if (accuracy > 100) return;

        // 2. 距离过滤（防抖）：只有移动距离超过 5 米才更新 UI
        // 这里需要引入你的 getDistance 函数计算
        const dist = calcDistance(lastLat, lastLng, latitude, longitude);
        if (dist > 5) {
          setCoords({ lat: latitude, lng: longitude });
          lastLat = latitude;
          lastLng = longitude;
        }
      },
      (err) => setError(err),
      options
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { coords, error };
};

// 简单的距离计算，用于内部防抖逻辑
function calcDistance(lat1, lng1, lat2, lng2) {
  if(!lat1 || !lat2) return 9999;
  const R = 6371e3;
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dp/2)*Math.sin(dp/2) + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)*Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}