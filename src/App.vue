<template>
  <div id="app">
    <!-- Cesium 地图容器 -->
    <div id="cesiumContainer" ref="cesiumContainer"></div>
    <Header />
    <!-- 顶部工具栏 -->
    <ToolBar 
      :activePanel="currentPanel" 
      :hasTerrain="hasTerrain"
      @toggle="handleToggle" 
      @toggleTerrain="handleTerrainToggle"
    />

    <!-- 模型加载面板 -->
    <ModelPanel 
      ref="modelRef" 
      v-show="currentPanel === 'model'"
      @close="currentPanel = null"
      @tilesetLoaded="handleTilesetLoaded"
    />

    <!-- Shader 特效控制面板 -->
    <ShaderPanel 
      v-if="viewerInstance"
      v-show="currentPanel === 'shader'"
      :viewer="viewerInstance"
      :tileset="currentTileset"
    />

    <!-- ★★★ 属性弹窗 ★★★ -->
    <!-- 只有当 featureProperties 有值时才显示 -->
    <PropertyPanel 
      v-if="featureProperties"
      :properties="featureProperties"
      :position="clickPosition"
      @close="clearSelection"
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
import { ref, shallowRef, onMounted } from 'vue'; 
import * as Cesium from 'cesium';

// --- 组件引入 ---
import ToolBar from './components/ToolBar.vue';
import ModelPanel from './components/Model.vue';
import ControlWindow from './components/ControlWindow.vue';
import CameraControl from './components/CameraControl.vue';
import LocationBar from './components/LocationBar.vue'; 
import ShaderPanel from './components/ShaderPanel.vue';

// ★★★ 1. 引入新组件和 Hook ★★★
import PropertyPanel from './components/PropertyPanel.vue';
// 确保这里使用花括号 {} 进行命名导入，因为 useInteraction.js 使用的是 export function
import { useInteraction } from './components/hooks/useInteraction.js';

// --- Hooks 引入 ---
import useFly from './components/hooks/fly.js';
import useTdtTerrain from './components/hooks/arcgisTerrain.js';
import Header from './components/Header.vue';

// --- 状态定义 ---
const currentPanel = ref(null);
const cesiumContainer = ref(null);
const modelRef = ref(null);

// 使用 shallowRef 优化性能
const viewerInstance = shallowRef(null); 
const currentTileset = shallowRef(null); 

// 初始化 Hooks
const { flyMsg, flyTo, isCityView, setViewer: setFlyViewer } = useFly();
const { hasTerrain, toggleTerrain } = useTdtTerrain();

// ★★★ 2. 初始化交互 Hook ★★★
// 传入 viewerInstance，解构出需要的数据和方法
const { 
  initInteraction, 
  featureProperties, 
  clickPosition, 
  clearSelection 
} = useInteraction(viewerInstance);

// --- 事件处理 ---

const handleToggle = (panelName) => {
  if (currentPanel.value === panelName) {
    currentPanel.value = null;
  } else {
    currentPanel.value = panelName;
  }
};

const handleTerrainToggle = () => {
  if(viewerInstance.value){
    toggleTerrain(viewerInstance.value);
  }
};

const handleTilesetLoaded = (tileset) => {
  console.log("App.vue: 接收到模型实例", tileset);
  currentTileset.value = tileset;
};

// --- 生命周期 ---
onMounted(() => {
  // 初始化 Cesium
  const viewer = new Cesium.Viewer(cesiumContainer.value, {
    baseLayerPicker: true, // 必须关闭以使用自定义底图
    infoBox: false,
    selectionIndicator: true,
    timeline: false,
    animation: false,
    geocoder: false,
    homeButton: true,
    sceneModePicker: false,
    navigationHelpButton: false
  });

  // 隐藏版权 Logo
  viewer.cesiumWidget.creditContainer.style.display = "none";
  
  // 开启深度检测
  viewer.scene.globe.depthTestAgainstTerrain = true;

  // 保存 viewer 实例
  viewerInstance.value = viewer;

  // 初始化依赖 viewer 的子组件/Hooks
  if (modelRef.value) modelRef.value.setViewer(viewer);
  setFlyViewer(viewer);

  // ★★★ 3. 启动交互监听 ★★★
  initInteraction();
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