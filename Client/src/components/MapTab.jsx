import React, { useEffect, useRef } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { wgs84ToGcj02 } from '../utils/coord';

const MapTab = ({ locations, users, currentUser }) => {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  // 用于存储所有用户 Marker 的引用，以便后续清除
  const userMarkersRef = useRef([]);

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
        //准备一个数组存储路径坐标  
        const path = [];

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

            path.push([lng, lat]);

            // 圆形区域
            const circle = new AMap.Circle({
                center: [lng, lat],
                radius: 30, // 30米
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
        // 绘制连接所有打卡点的折线
        if (path.length > 1) {
            const polyline = new AMap.Polyline({
                path: path,              // 设置线路径
                strokeColor: "#3B82F6",  // 线颜色 (比如蓝色)
                strokeOpacity: 0.8,      // 线透明度
                strokeWeight: 6,         // 线宽
                strokeStyle: "solid",    // 线样式
                lineJoin: 'round',       // 折线拐点连接处样式
                lineCap: 'round',        // 线帽样式
                zIndex: 40,              // 层级 (比 marker 低，比底图高)
                showDir: true,           // 显示方向箭头 (可选)
            });
            polyline.setMap(mapInstance.current);
        }
                

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
  // 先清理旧的 Markers
  if (userMarkersRef.current.length > 0) {
      userMarkersRef.current.forEach(marker => {
          marker.setMap(null); // 从地图上移除
      });
      userMarkersRef.current = []; // 清空数组
  }
  users.forEach(u => {
      // 防御性检查，如果原始数据缺失，直接跳过
      if (u.lat === undefined || u.lng === undefined || u.lat === null || u.lng === null) {
          console.warn('跳过无效坐标用户:', u.realName);
          return;
      }

      // 尝试转换坐标
      const { lat, lng } = wgs84ToGcj02(Number(u.lat), Number(u.lng));
      
      // 检查转换结果是否包含 NaN
      if (isNaN(lat) || isNaN(lng)) {
          console.warn('坐标转换失败 (NaN):', u.realName, u.lat, u.lng);
          return;
      }
      
      // 区分自己、队友、敌人
      let markerColor = '#94A3B8'; // gray (敌人)
      if (u.teamId === currentUser.teamId) markerColor = '#3B82F6'; // blue (队友)
      if (u.id === currentUser.id) markerColor = '#EAB308'; // yellow (自己)

      // ... 后续创建 Marker 的代码保持不变
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
          position: [lng, lat], // 这里现在是安全的
          content: markerContent,
          offset: new AMap.Pixel(-7, -7),
          zIndex: u.id === currentUser.id ? 100 : 80
      });
      marker.setMap(mapInstance.current);
      // 将新创建的 marker 存入 ref
      userMarkersRef.current.push(marker);
      if (u.id === currentUser.id) mapInstance.current.setCenter([lng, lat]);
  });

}, [users, currentUser]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} className="rounded-xl overflow-hidden shadow-inner" />;
};

export default MapTab;