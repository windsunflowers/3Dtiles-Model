<template>
  <div class="location-bar">
    <div class="info-item">
      <span class="label">经度:</span>
      <span class="value">{{ longitude }}°</span>
    </div>
    <div class="info-item">
      <span class="label">纬度:</span>
      <span class="value">{{ latitude }}°</span>
    </div>
    <div class="info-item">
      <span class="label">视角高度:</span>
      <span class="value">{{ height }} 米</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as Cesium from 'cesium';

const props = defineProps({
  viewer: {
    type: Object,
    default: null
  }
});

const longitude = ref('0.000000');
const latitude = ref('0.000000');
const height = ref('0.00');
let handler = null;

// 核心逻辑：监听鼠标移动
const initHandler = (viewer) => {
  if (!viewer) return;

  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction((movement) => {
    // 1. 获取地球表面的笛卡尔坐标
    const cartesian = viewer.camera.pickEllipsoid(
      movement.endPosition,
      viewer.scene.globe.ellipsoid
    );

    if (cartesian) {
      // 2. 转换为地理坐标（弧度）
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      
      // 3. 转换为经纬度（度数）
      const lng = Cesium.Math.toDegrees(cartographic.longitude);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      
      // 4. 获取相机高度
      const cameraHeight = viewer.camera.positionCartographic.height;

      longitude.value = lng.toFixed(6);
      latitude.value = lat.toFixed(6);
      height.value = cameraHeight.toFixed(2);
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
};

// 监听 viewer 实例传入
watch(() => props.viewer, (newVal) => {
  if (newVal) {
    initHandler(newVal);
  }
});

onMounted(() => {
  if (props.viewer) {
    initHandler(props.viewer);
  }
});

onUnmounted(() => {
  if (handler) {
    handler.destroy();
    handler = null;
  }
});
</script>

<style scoped>
.location-bar {
  position: absolute;
  bottom: 0;
  right: 0; /* 放在右下角，不遮挡左侧的归位按钮 */
  z-index: 999; /* 确保在最上层 */
  
  /* 风格与你的其他组件保持一致 (深色半透明) */
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  padding: 5px 15px;
  font-size: 12px;
  font-family: Consolas, Monaco, monospace; /* 等宽字体防止数字跳动 */
  border-top-left-radius: 4px;
  display: flex;
  gap: 15px;
  pointer-events: none; /* 让鼠标事件穿透，不影响地图拖拽 */
  user-select: none;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.label {
  opacity: 0.8;
}

.value {
  font-weight: bold;
  color: #0155e6; /* 科技蓝高亮 */
  min-width: 60px; /* 占位防止抖动 */
}
</style>