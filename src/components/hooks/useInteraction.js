import { ref, onUnmounted } from 'vue';
import * as Cesium from 'cesium';

/**
 * 3D Tiles 交互 Hook
 * 
 * 兼容两种 3DTiles 格式：
 *  - b3dm 批量格式：pick 返回 Cesium3DTileFeature，用 Style 条件着色
 *  - glTF/glb 格式：pick 返回 { content: Model3DTileContent, primitive: Cesium3DTileset }
 *                   用 tile 的 boundingSphere 精确定位整栋楼轮廓
 */
export function useInteraction(viewerRef) {
  const featureProperties = ref(null);
  const clickPosition    = ref({ x: 0, y: 0 });
  const selectedFeature  = ref(null);

  let handler         = null;
  let styledTileset   = null;  // 当前被改了 style 的 tileset
  let highlightEntity = null;  // 辅助轮廓线实体（glTF 模式用）

  // ─────────────────────────────────────────
  // 清除 tileset 高亮样式
  // ─────────────────────────────────────────
  const clearTilesetStyle = () => {
    if (styledTileset && !styledTileset.isDestroyed()) {
      styledTileset.style = new Cesium.Cesium3DTileStyle({
        color: "color('white', 1.0)"
      });
    }
    styledTileset = null;
  };

  // ─────────────────────────────────────────
  // 清除辅助轮廓线实体
  // ─────────────────────────────────────────
  const clearHighlightEntity = (viewer) => {
    if (highlightEntity && viewer && !viewer.isDestroyed()) {
      viewer.entities.remove(highlightEntity);
    }
    highlightEntity = null;
  };

  // ─────────────────────────────────────────
  // 清除所有选中状态（供外部调用）
  // ─────────────────────────────────────────
  const clearSelection = (viewer) => {
    const v = viewer || viewerRef?.value || viewerRef;
    clearTilesetStyle();
    clearHighlightEntity(v);
    featureProperties.value = null;
    selectedFeature.value   = null;
  };

  // ─────────────────────────────────────────
  // 方案A：b3dm 批量格式高亮
  // 通过 buildingId 字段用 Style 高亮整栋楼
  // ─────────────────────────────────────────
  const BUILDING_ID_KEYS = [
    'buildingId', 'building_id', 'BUILDING_ID',
    'gml_id', 'gmlid', 'GML_ID',
    'Building_ID', 'BuildingID',
    'id', 'ID', 'fid', 'FID',
    'name', 'Name', 'NAME',
  ];

  const highlightByFeature = (feature) => {
    const tileset = feature.tileset;
    if (!tileset || tileset.isDestroyed()) return;

    clearTilesetStyle();

    let buildingId = null;
    try {
      const ids = feature.getPropertyIds() || [];
      for (const key of BUILDING_ID_KEYS) {
        if (ids.includes(key)) {
          const val = feature.getProperty(key);
          if (val !== undefined && val !== null && val !== '') {
            buildingId = { key, value: val };
            break;
          }
        }
      }
      if (!buildingId && ids.length > 0) {
        const val = feature.getProperty(ids[0]);
        if (val !== undefined && val !== null) {
          buildingId = { key: ids[0], value: val };
        }
      }
    } catch (e) {}

    if (buildingId) {
      const { key, value } = buildingId;
      const condition = typeof value === 'string'
        ? `\${${key}} === '${String(value).replace(/'/g, "\\'")}'`
        : `\${${key}} === ${value}`;

      tileset.style = new Cesium.Cesium3DTileStyle({
        color: {
          conditions: [
            [condition, "color('#00FFFF', 0.95)"],
            ['true',    "color('white',   1.0)"]
          ]
        }
      });
      console.log(`【高亮整栋楼 - b3dm】${key} = ${value}`);
    } else {
      feature.color = new Cesium.Color(0.0, 1.0, 1.0, 0.95);
      console.warn('【警告】未找到楼栋ID字段，仅高亮单个面片');
    }
    styledTileset = tileset;
  };

  // ─────────────────────────────────────────
  // 方案B：glTF/glb 格式高亮
  // 每个 tile = 一栋楼，直接整体着色 + 轮廓球
  // ─────────────────────────────────────────
  const highlightByTileContent = (pickedObject, viewer) => {
    const tileset = pickedObject.primitive;
    if (!tileset || tileset.isDestroyed()) return;

    clearTilesetStyle();
    clearHighlightEntity(viewer);

    // 尝试获取被点中的 tile 对象
    const tile = pickedObject.content?._tile
              || pickedObject.content?.tile
              || null;

    if (tile) {
      // ✅ 核心：直接对这个 tile 的模型着色（只有这一栋楼变色）
      // Cesium 1.100+ 支持 tile.style，旧版用 tileset.style 加 url 条件
      const tileUrl = pickedObject.content?._url
                   || pickedObject.content?.url
                   || '';

      if (tileUrl) {
        // 通过 content.uri 条件精确只高亮这一个 tile
        const tileKey = tileUrl.split('/').pop().split('?')[0]; // 取文件名部分
        console.log(`【高亮整栋楼 - glTF】tile文件: ${tileKey}`);

        tileset.style = new Cesium.Cesium3DTileStyle({
          color: {
            conditions: [
              // ${content.uri} 是 Cesium 内置的 tile 路径属性
              [`\${feature['tileName']} === '${tileKey}'`, "color('#00FFFF', 0.95)"],
              ['true', "color('white', 1.0)"]
            ]
          }
        });
        styledTileset = tileset;
      }

      // 同时画包围球轮廓，视觉上更明显
      if (tile.boundingSphere) {
        const sphere = tile.boundingSphere;
        const carto  = Cesium.Cartographic.fromCartesian(sphere.center);
        const radius = Math.min(sphere.radius, 100); // 防止超大 tile

        highlightEntity = viewer.entities.add({
          position: Cesium.Cartesian3.fromRadians(
            carto.longitude,
            carto.latitude,
            carto.height
          ),
          ellipse: {
            semiMinorAxis: radius,
            semiMajorAxis: radius,
            material: Cesium.Color.CYAN.withAlpha(0.15),
            outline: true,
            outlineColor: Cesium.Color.CYAN,
            outlineWidth: 3,
            height: carto.height - sphere.radius * 0.8,
            extrudedHeight: carto.height + sphere.radius,
          }
        });
      }
    } else {
      // 拿不到具体 tile，整个 tileset 着色（降级方案）
      tileset.style = new Cesium.Cesium3DTileStyle({
        color: "color('#00FFFF', 0.8)"
      });
      styledTileset = tileset;
      console.log('【高亮 - glTF fallback】整体着色');
    }
  };

  // ─────────────────────────────────────────
  // 提取属性信息
  // ─────────────────────────────────────────
  const extractProperties = (pickedObject, cartographic) => {
    const props = {};

    // b3dm feature 属性
    if (pickedObject instanceof Cesium.Cesium3DTileFeature) {
      try {
        const ids = pickedObject.getPropertyIds() || [];
        ids.forEach(key => { props[key] = pickedObject.getProperty(key); });
      } catch (e) {}
    }

    // glTF tile extras 属性
    if (pickedObject.content) {
      const tile = pickedObject.content?._tile || pickedObject.content?.tile;
      if (tile?.extras) Object.assign(props, tile.extras);

      const url = pickedObject.content?._url || pickedObject.content?.url || '';
      if (url) props['文件名'] = url.split('/').pop().split('?')[0];
    }

    // 坐标信息
    if (cartographic) {
      props['经度'] = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
      props['纬度'] = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
      props['海拔'] = cartographic.height.toFixed(2) + ' 米';
    }

    return Object.keys(props).length > 0 ? props : { '系统提示': '未检测到业务属性' };
  };

  // ─────────────────────────────────────────
  // 点击事件主处理
  // ─────────────────────────────────────────
  const handleLeftClick = (movement, viewer) => {
    const pickedObject = viewer.scene.pick(movement.position);

    if (!Cesium.defined(pickedObject)) {
      clearSelection(viewer);
      return;
    }

    console.log('【点击对象】', pickedObject);

    // 获取点击点的地理坐标
    let cartographic = null;
    try {
      const cartesian = viewer.scene.pickPosition(movement.position);
      if (Cesium.defined(cartesian)) {
        cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      }
    } catch (e) {}

    // ── 判断格式，选择高亮方案 ──
    if (pickedObject instanceof Cesium.Cesium3DTileFeature) {
      // b3dm 批量格式
      highlightByFeature(pickedObject);

    } else if (pickedObject.primitive instanceof Cesium.Cesium3DTileset) {
      // glTF/glb 格式（每栋楼是单独 tile）
      highlightByTileContent(pickedObject, viewer);

    } else if (pickedObject.id instanceof Cesium.Entity) {
      // 普通 Entity，不处理
      return;

    } else {
      console.log('【未知类型】', pickedObject?.constructor?.name);
      return;
    }

    // 更新属性面板
    featureProperties.value = extractProperties(pickedObject, cartographic);
    selectedFeature.value   = pickedObject;
    clickPosition.value     = { x: movement.position.x, y: movement.position.y };
  };

  // ─────────────────────────────────────────
  // 初始化事件监听
  // ─────────────────────────────────────────
  const initInteraction = () => {
    const viewer = viewerRef.value || viewerRef;
    if (!viewer) return;

    if (handler) handler.destroy();

    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (movement) => handleLeftClick(movement, viewer),
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );
  };

  onUnmounted(() => {
    const viewer = viewerRef?.value || viewerRef;
    if (handler) handler.destroy();
    clearSelection(viewer);
  });

  return {
    initInteraction,
    featureProperties,
    clickPosition,
    clearSelection,
    selectedFeature,
  };
}