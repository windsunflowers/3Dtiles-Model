import * as Cesium from 'cesium';
import { ref } from 'vue';

export default function useTdtTerrain() {
  // 记录地形开关状态
  const hasTerrain = ref(false);

  /**
   * 切换地形
   * 方案：使用天地图影像(在App.vue中) + ArcGIS地形(在这里)
   * 这是解决 "地球消失" 和 "CORS跨域报错" 的最佳组合方案
   */
  const toggleTerrain = async (viewer) => {
    if (!viewer) return;

    // --- 1. 如果当前是开启的，则关闭 ---
    if (hasTerrain.value) {
      // 恢复为纯圆球体 (Ellipsoid)
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      hasTerrain.value = false;
      console.log('❌ 地形已关闭');
      return;
    }

    // --- 2. 如果当前是关闭的，则开启 ---
    try {
      console.log('⛰️ 正在请求 3D 地形数据...');
      
      // 使用 ArcGIS 全球高程数据
      // 它的作用只是提供高度信息，不会改变地图的颜色和样式
      const terrainProvider = await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
        "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer"
      );

      viewer.terrainProvider = terrainProvider;
      
      // 开启深度检测，让山脉有遮挡效果
      viewer.scene.globe.depthTestAgainstTerrain = true;
      
      hasTerrain.value = true;
      console.log('✅ 地形加载成功');

    } catch (error) {
      console.error('地形加载失败:', error);
      alert('地形服务连接失败，地球已恢复默认状态');
      // 如果失败，恢复为圆球，防止地球消失
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
      hasTerrain.value = false;
    }
  };

  return {
    hasTerrain,
    toggleTerrain
  };
}