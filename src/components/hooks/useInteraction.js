import { ref, onUnmounted } from 'vue';
import * as Cesium from 'cesium';

/**
 * 3D Tiles 交互 Hook (自适应建筑轮廓版)
 */
export function useInteraction(viewerRef) {
  // 选中的原始对象
  const selectedFeature = ref(null);
  // 提取出的属性列表
  const featureProperties = ref(null);
  // 点击屏幕位置
  const clickPosition = ref({ x: 0, y: 0 });
  
  // 内部状态
  let handler = null;
  let previousColor = null;
  let previousFeature = null;
  
  // 存储高亮实体
  const highlightEntity = ref(null);

  const initInteraction = () => {
    const viewer = viewerRef.value || viewerRef;
    if (!viewer) return;

    if (handler) handler.destroy();

    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement) => {
      handleLeftClick(movement, viewer);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  };

  const handleLeftClick = (movement, viewer) => {
    // 1. 获取点击位置 (笛卡尔坐标)
    const cartesian = viewer.scene.pickPosition(movement.position);
    const pickedObject = viewer.scene.pick(movement.position);
    
    // 如果点击无效
    if (!Cesium.defined(pickedObject)) {
      clearSelection(viewer);
      return;
    }

    console.log("【选中对象】:", pickedObject);

    // --- 属性挖掘 (保持不变) ---
    let properties = {};
    let targetFeature = null;

    // 策略: 优先识别 3D Tile Feature
    if (pickedObject instanceof Cesium.Cesium3DTileFeature) {
      targetFeature = pickedObject;
      const ids = pickedObject.getPropertyIds();
      if (ids) ids.forEach(key => properties[key] = pickedObject.getProperty(key));
    } 
    else if (pickedObject.id instanceof Cesium.Entity) {
       const entity = pickedObject.id;
       properties["名称"] = entity.name || "Entity";
    }
    else if (pickedObject.content) {
        if (pickedObject.content.featuresLength > 0) {
            targetFeature = pickedObject.content.getFeature(0);
        }
        if (pickedObject.content.tile && pickedObject.content.tile.extras) {
            Object.assign(properties, pickedObject.content.tile.extras);
        }
    }

 

    // --- 核心优化：高亮逻辑 (自适应大小 + 智能判断) ---
    
    // A. 清除旧高亮
    restoreFeatureColor(); 
    if (highlightEntity.value) {
      viewer.entities.remove(highlightEntity.value);
      highlightEntity.value = null;
    }

    // B. 原始模型变色 (这是唯一能精确显示"不规则轮廓"的方法)
    if (targetFeature) {
      previousFeature = targetFeature;
      try {
        previousColor = targetFeature.color ? targetFeature.color.clone() : Cesium.Color.WHITE.clone(); 
      } catch(e) {
        previousColor = Cesium.Color.WHITE.clone();
      }
      // 设置为高亮青色，让建筑本体发光
      targetFeature.color = Cesium.Color.CYAN.withAlpha(0.9); 
    }

    // C. 生成“整栋楼”的自适应包围盒
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const topHeight = cartographic.height; // 点击位置的高度 (认为是房顶)
      
      // 快速获取当前坐标下的地面高度
      const groundHeight = viewer.scene.globe.getHeight(cartographic) || 0;
      
      // 计算楼高
      const buildingHeight = Math.max(0, topHeight - groundHeight);
      
      // 写入属性
      properties["文件名称"] = pickedObject.content && pickedObject.content.url ? pickedObject.content.url.split('/').pop() : "未知";
      properties["经度"]= Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
      properties["纬度"]= Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
      properties["海拔"] = topHeight.toFixed(2) + "米";
        

    if (Object.keys(properties).length === 0) {
       properties["系统提示"] = "未检测到业务属性";
    }

      // 阈值判断：如果高度差大于 3米，认为是建筑
      const isBuilding = buildingHeight > 3.0;
      
      // === 核心优化：自适应半径计算 ===
      let dynamicRadius = 15.0; // 默认值
      
      if (pickedObject.content && pickedObject.content.tile) {
          // 获取 Tile 的包围球 (Bounding Sphere)
          // 这里的 radius 是包围整个 Tile 的球体半径
          const tileSphere = pickedObject.content.tile.boundingSphere;
          
          if (tileSphere && tileSphere.radius > 0) {
             // 限制一下最大值 (例如 80米)，防止 Batch Tile (合并的大Tile) 导致框住整个小区
             dynamicRadius = Math.min(tileSphere.radius, 80.0);
             
             // 如果计算出的半径非常大，但楼高很矮，可能点击的是地面或大面积低矮设施
             if (dynamicRadius > 40 && buildingHeight < 10) {
                 dynamicRadius = 20.0; // 强制回退到小尺寸
             }
          }
      }

      if (isBuilding) {
        // === 方案：生成自适应立方体光罩 (Adaptive Box) ===
        // 建筑多为方正，用 Box 比 Cylinder 更像“轮廓”
        
        // 估算盒子宽度：包围球半径通常覆盖对角线，取 1.4倍左右作为边长覆盖较全
        // 这里取 1.3 倍半径作为正方形边长
        const boxSide = dynamicRadius * 1;

        const centerHeight = (topHeight + groundHeight) / 2;
        const centerPosition = Cesium.Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            centerHeight
        );

        const entity = viewer.entities.add({
            position: centerPosition,
            box: {
                // 长, 宽, 高 (使用动态计算的边长)
                dimensions: new Cesium.Cartesian3(boxSide, boxSide, buildingHeight), 
                material: Cesium.Color.CYAN.withAlpha(0.1), // 内部淡淡的填充
                outline: true,
                outlineColor: Cesium.Color.CYAN.withAlpha(0.6), // 边框
                outlineWidth: 2
            },
            // 中心轴线
            polyline: {
                positions: [
                    Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, groundHeight),
                    Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, topHeight + 2)
                ],
                material: new Cesium.PolylineDashMaterialProperty({ color: Cesium.Color.YELLOW }),
                width: 2
            }
        });
        highlightEntity.value = entity;

      } else {
        // === 方案：贴地光圈 (Ground Marker) ===
        // 只有在点地板时才显示圆形
        const entity = viewer.entities.add({
            position: cartesian, 
            ellipse: {
                semiMinorAxis: 3.0,
                semiMajorAxis: 3.0,
                material: Cesium.Color.YELLOW.withAlpha(0.4),
                outline: true,
                outlineColor: Cesium.Color.YELLOW,
                height: topHeight + 0.1
            }
        });
        highlightEntity.value = entity;
      }
    }

    // 更新 UI
    featureProperties.value = properties;
    selectedFeature.value = pickedObject;
    clickPosition.value = { x: movement.position.x, y: movement.position.y };
  };

  const restoreFeatureColor = () => {
    try {
      if (previousFeature && previousFeature.tileset && !previousFeature.tileset.isDestroyed()) {
         if (previousColor) previousFeature.color = previousColor;
      }
    } catch (e) {}
    previousFeature = null;
    previousColor = null;
  };

  const clearSelection = (viewer) => {
    restoreFeatureColor();
    if (viewer && highlightEntity.value) {
      viewer.entities.remove(highlightEntity.value);
      highlightEntity.value = null;
    }
    featureProperties.value = null;
    selectedFeature.value = null;
  };

  onUnmounted(() => {
    if (handler) handler.destroy();
  });

  return {
    initInteraction,
    featureProperties,
    clickPosition,
    clearSelection
  };
}