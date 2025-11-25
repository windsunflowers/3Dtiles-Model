<template>
  <div id="app">
    <!-- Cesium 地图容器 -->
    <div id="cesiumContainer" ref="cesiumContainer"></div>

    <!-- 
      顶部工具栏 
      (请确保 ToolBar.vue 中有触发 'shader' 的按钮) 
    -->
    <ToolBar 
      :activePanel="currentPanel" 
      :hasTerrain="hasTerrain"
      @toggle="handleToggle" 
      @toggleTerrain="handleTerrainToggle"
    />

    <!-- 
      模型加载面板 
      (当 ModelPanel 加载完模型后，触发 tilesetLoaded 事件传出模型实例)
    -->
    <ModelPanel 
      ref="modelRef" 
      v-show="currentPanel === 'model'"
      @close="currentPanel = null"
      @tilesetLoaded="handleTilesetLoaded"
    />

    <!-- 
      Shader 特效控制面板 
      (接收 viewer 和 currentTileset)
    -->
    <ShaderPanel 
      v-if="viewerInstance"
      v-show="currentPanel === 'shader'"
      :viewer="viewerInstance"
      :tileset="currentTileset"
    />

    <!-- 飞行控制窗口 -->
    <ControlWindow
      v-show="currentPanel === 'control'"
      :flyMsg="flyMsg"
      :isCityView="isCityView"
      :flyTo="flyTo"
      @close="currentPanel = null"
    />

    <!-- 相机参数面板 -->
    <CameraControl 
      v-if="viewerInstance"
      v-show="currentPanel === 'camera'"
      :viewer="viewerInstance"
      @close="currentPanel = null"
    />

    <!-- 底部状态栏 -->
    <LocationBar v-if="viewerInstance" :viewer="viewerInstance" />
    
  </div>
</template>

<script setup>
// ★★★ 修复点：这里必须包含 shallowRef ★★★
import { ref, shallowRef, onMounted } from 'vue'; 
import * as Cesium from 'cesium';

// --- 组件引入 ---
import ToolBar from './components/ToolBar.vue';
import ModelPanel from './components/Model.vue';
import ControlWindow from './components/ControlWindow.vue';
import CameraControl from './components/CameraControl.vue';
import LocationBar from './components/LocationBar.vue'; 
import ShaderPanel from './components/ShaderPanel.vue'; // 引入 Shader 面板

// --- Hooks 引入 ---
import useFly from './components/hooks/fly.js';
import useTdtTerrain from './components/hooks/tdtTerrain.js';

// --- 状态定义 ---
const currentPanel = ref(null);
const cesiumContainer = ref(null);
const modelRef = ref(null);

// 使用 shallowRef 优化性能 (Cesium 对象很庞大，不要用 ref)
const viewerInstance = shallowRef(null); 
const currentTileset = shallowRef(null); // 用于存储当前加载的 3D 模型

// 初始化 Hooks
const { flyMsg, flyTo, isCityView, setViewer: setFlyViewer } = useFly();
const { hasTerrain, toggleTerrain } = useTdtTerrain();

// --- 事件处理 ---

// 1. 切换面板
const handleToggle = (panelName) => {
  if (currentPanel.value === panelName) {
    currentPanel.value = null;
  } else {
    currentPanel.value = panelName;
  }
};

// 2. 切换地形
const handleTerrainToggle = () => {
  if(viewerInstance.value){
    toggleTerrain(viewerInstance.value);
  }
};

// 3. 处理模型加载完成 (来自 ModelPanel 的事件)
const handleTilesetLoaded = (tileset) => {
  console.log("App.vue: 接收到模型实例", tileset);
  currentTileset.value = tileset;
  // 可选：加载完成后自动打开特效面板
  // currentPanel.value = 'shader'; 
};

// --- 生命周期 ---
onMounted(() => {
  // 初始化 Cesium
  const viewer = new Cesium.Viewer(cesiumContainer.value, {
    infoBox: false,
    selectionIndicator: true,
    timeline: false,
    animation: false,
    baseLayerPicker: true,
    geocoder: false,
    homeButton: true,
    sceneModePicker: false,
    navigationHelpButton: false
  });

  // 隐藏版权 Logo (开发用)
  viewer.cesiumWidget.creditContainer.style.display = "none";
  
  // 开启深度检测 (防止模型与地形穿插)
  viewer.scene.globe.depthTestAgainstTerrain = true;

  // 保存 viewer 实例
  viewerInstance.value = viewer;

  // 初始化依赖 viewer 的子组件/Hooks
  if (modelRef.value) modelRef.value.setViewer(viewer);
  setFlyViewer(viewer);
});
</script>

<style>
/* 全局样式 */
html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  display: block;
  position: absolute;
  top: 0;
  left: 0;
}
</style>