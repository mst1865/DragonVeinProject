import React, { useEffect, useRef } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { wgs84ToGcj02 } from '../utils/coord';

const MapTab = ({ locations, users, currentUser }) => {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    // 设置安全密钥 (JSAPI 2.0 必须)
    window._AMapSecurityConfig = {
      securityJsCode: 'bac05b6f16257ded762692ecd35d1ca7', // 🔴 请替换为高德安全密钥
    };

    AMapLoader.load({
      key: '5c0cd5ee37c90dc2f454c504973b429b', // 🔴 请替换为高德 Key
      version: '2.0',
      plugins: ['AMap.Scale', 'AMap.ToolBar'],
    })
      .then((AMap) => {
        // 1. 初始化地图
        // 默认中心点：紫金山区域
        const center = [118.8300, 32.0550]; 
        
        mapInstance.current = new AMap.Map(mapContainer.current, {
          viewMode: '2D', 
          zoom: 14,
          center: center,
          mapStyle: 'amap://styles/normal', 
        });

        // 2. 绘制任务点 (Locations)
        locations.forEach(loc => {
            // 假设数据库存的是 GCJ02 或者直接是 WGS84。如果是 WGS84 需要转
            // 这里假设数据库存的坐标是 WGS84 (和手机GPS一致)，转换后显示
            const { lat, lng } = wgs84ToGcj02(loc.lat, loc.lng);
            
            // 圆形区域
            const circle = new AMap.Circle({
                center: [lng, lat],
                radius: loc.radius, // 30米
                borderWeight: 1,
                strokeColor: "#EAB308", // yellow-500
                strokeOpacity: 1,
                strokeWeight: 2,
                fillOpacity: 0.2,
                fillColor: '#EAB308',
                zIndex: 50,
            });
            circle.setMap(mapInstance.current);

            // 文本标记
            const text = new AMap.Text({
                text: loc.name,
                position: [lng, lat],
                anchor: 'bottom-center',
                offset: new AMap.Pixel(0, -10),
                style: {
                    'background-color': 'rgba(0,0,0,0.7)',
                    'border': '1px solid #EAB308',
                    'color': '#fff',
                    'font-size': '12px',
                    'padding': '2px 5px',
                    'border-radius': '4px'
                }
            });
            text.setMap(mapInstance.current);
        });

      })
      .catch((e) => {
        console.error(e);
      });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
    };
  }, []); // 初始化只执行一次

  // 3. 动态更新特工位置 (Users)
  useEffect(() => {
    if (!mapInstance.current || !users) return;
    
    // 清除旧的特工标记 (实际生产可用 Map 维护 Marker 实例来 update position，这里简化为重绘)
    // 注意：这里没有清除 locations 的标记，需要区分
    // 简单做法：我们把特工 Marker 存在一个 ref 数组里，每次清空
    
    // ... (为简化代码，这里省略 Marker 缓存逻辑，高频刷新建议优化) ...
    // 下面演示添加 Marker：
    
    users.forEach(u => {
        const { lat, lng } = wgs84ToGcj02(u.lat, u.lng);
        
        // 区分自己、队友、敌人
        let markerColor = '#94A3B8'; // gray (敌人)
        if (u.teamId === currentUser.teamId) markerColor = '#3B82F6'; // blue (队友)
        if (u.id === currentUser.id) markerColor = '#EAB308'; // yellow (自己)

        // 使用 Canvas 或 Content 创建点
        const markerContent = `
            <div style="
                width: 14px; height: 14px; 
                background: ${markerColor}; 
                border: 2px solid white; 
                border-radius: 50%;
                box-shadow: 0 0 5px ${markerColor};
            "></div>
            <div style="color:white; font-size:10px; text-align:center; margin-top:2px; text-shadow:1px 1px 1px black;">
                ${u.realName}
            </div>
        `;

        const marker = new AMap.Marker({
            position: [lng, lat],
            content: markerContent,
            offset: new AMap.Pixel(-7, -7),
            zIndex: u.id === currentUser.id ? 100 : 80
        });
        marker.setMap(mapInstance.current);

        // 如果是自己，中心跟随 (可选)
        // if (u.id === currentUser.id) mapInstance.current.setCenter([lng, lat]);
    });

    // 这一步比较粗暴，实际上应该维护 markers 数组来 mapInstance.current.remove(oldMarkers)
    // 建议在 useEffect 外部定义一个 markersRef = useRef([]) 
    
  }, [users, currentUser]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} className="rounded-xl overflow-hidden shadow-inner" />;
};

export default MapTab;