import React, { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { wgs84ToGcj02 } from '../utils/coord';
import { Locate, LocateFixed } from 'lucide-react'; // 引入图标

const MapTab = ({ locations, users, currentUser }) => {
  const mapContainer = useRef(null);
  const mapInstance = useRef(null);
  const userMarkersRef = useRef([]);
  
  // [新增] 状态：是否开启“自动跟随”模式
  const [isTracking, setIsTracking] = useState(true);

  // 初始化地图
  useEffect(() => {
    // 设置安全密钥
    window._AMapSecurityConfig = {
      securityJsCode: 'bac05b6f16257ded762692ecd35d1ca7', 
    };

    AMapLoader.load({
      key: '5c0cd5ee37c90dc2f454c504973b429b',
      version: '2.0',
      plugins: ['AMap.Scale', 'AMap.ToolBar'],
    })
      .then((AMap) => {
        // 1. 初始化地图
        const center = [118.8300, 32.0550]; 
        const path = [];

        mapInstance.current = new AMap.Map(mapContainer.current, {
          viewMode: '2D', 
          zoom: 14,
          center: center,
          mapStyle: 'amap://styles/normal', 
        });

        // [新增] 监听用户交互，打断自动跟随
        mapInstance.current.on('dragstart', () => {
             // 用户开始拖拽地图，停止自动居中
             setIsTracking(false);
        });
        mapInstance.current.on('zoomstart', () => {
             // 用户开始缩放，停止自动居中（防止缩放看全图时被拉回）
             setIsTracking(false);
        });

        // 2. 绘制任务点 (Locations)
        locations.forEach(loc => {
            const { lat, lng } = wgs84ToGcj02(loc.lat, loc.lng);
            path.push([lng, lat]);

            // 圆形区域
            const circle = new AMap.Circle({
                center: [lng, lat],
                radius: 30,
                borderWeight: 1,
                strokeColor: "#EAB308",
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

        // 绘制连接线
        if (path.length > 1) {
            const polyline = new AMap.Polyline({
                path: path,
                strokeColor: "#3B82F6",
                strokeOpacity: 0.8,
                strokeWeight: 6,
                strokeStyle: "solid",
                lineJoin: 'round',
                lineCap: 'round',
                zIndex: 40,
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

    // 清理旧 Markers
    if (userMarkersRef.current.length > 0) {
        userMarkersRef.current.forEach(marker => marker.setMap(null));
        userMarkersRef.current = [];
    }

    users.forEach(u => {
        if (!u.lat || !u.lng) return;

        // 转换坐标
        const { lat, lng } = wgs84ToGcj02(Number(u.lat), Number(u.lng));
        if (isNaN(lat) || isNaN(lng)) return;
        
        // 区分自己、队友、敌人
        let markerColor = '#94A3B8'; // gray (敌人)
        if (u.teamId === currentUser.teamId) markerColor = '#3B82F6'; // blue (队友)
        if (u.id === currentUser.id) markerColor = '#EAB308'; // yellow (自己)

        // 自定义 Marker 内容
        const markerContent = `
            <div style="
                width: 14px; height: 14px; 
                background: ${markerColor}; 
                border: 2px solid white; 
                border-radius: 50%;
                box-shadow: 0 0 5px ${markerColor};
            "></div>
            <div style="color:white; font-size:10px; text-align:center; margin-top:2px; text-shadow:1px 1px 1px black; white-space:nowrap;">
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
        userMarkersRef.current.push(marker);

        // [修改] 只有在“开启跟随”且“是当前用户”时，才移动地图中心
        if (u.id === currentUser.id && isTracking) {
            mapInstance.current.setCenter([lng, lat]);
        }
    });
  }, [users, currentUser, isTracking]); // [关键] 添加 isTracking 依赖

  // [新增] 手动定位按钮点击处理
  const handleLocateClick = () => {
      setIsTracking(true); // 1. 开启跟随模式
      
      // 2. 立即找到自己的位置并居中 (不用等下一次轮询)
      if (mapInstance.current && users) {
          const myself = users.find(u => u.id === currentUser.id);
          if (myself && myself.lat && myself.lng) {
             const { lat, lng } = wgs84ToGcj02(Number(myself.lat), Number(myself.lng));
             mapInstance.current.setCenter([lng, lat]);
             mapInstance.current.setZoom(16); // 可选：定位时拉近视角
          }
      }
  };

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-inner">
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        
        {/* [新增] 悬浮定位按钮 */}
        <button 
            onClick={handleLocateClick}
            className={`
                absolute bottom-6 right-6 p-3 rounded-full shadow-lg transition-all
                flex items-center justify-center
                ${isTracking 
                    ? 'bg-blue-600 text-white ring-2 ring-blue-300' // 跟随中：高亮
                    : 'bg-white text-slate-600 hover:bg-slate-50'}   // 未跟随：普通
            `}
        >
            {/* 根据状态切换图标 */}
            {isTracking ? <LocateFixed size={24} /> : <Locate size={24} />}
        </button>
    </div>
  );
};

export default MapTab;