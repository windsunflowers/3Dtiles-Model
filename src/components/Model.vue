<template>
  <div class="model-panel" ref="panelRef" :style="panelStyle">
    <div class="panel-header" @mousedown="startDrag" title="按住拖动窗口">
      <h3>🏗️ 模型管理</h3>
      <div class="header-controls">
        <button class="icon-btn" @click="handleResetAll" title="重置高度">↺</button>
        <button class="close-btn" @mousedown.stop @click="$emit('close')">×</button>
      </div>
    </div>

    <div class="panel-content">
      <div class="section load-section">
        
        <div class="input-label">模型 URL (JSON)</div>
        <div class="input-row">
          <input 
            v-model="modelUrl" 
            type="text" 
            placeholder="输入 3D Tiles URL"
          />
        </div>

        <div class="input-label">Cesium Ion ID</div>
        <div class="input-row">
          <input 
            v-model="ionId" 
            type="number" 
            placeholder="输入 Asset ID (例如: 69380)"
          />
        </div>
        
        <div class="btn-group">
          <button class="primary-btn" @click="handleLoadUrl" :disabled="loading || !viewer">
            URL加载
          </button>
          
          <button class="primary-btn ion-btn" @click="handleLoadIon" :disabled="loading || !viewer">
            Ion加载
          </button>
          
          <button class="danger-btn" @click="handleRemove" :disabled="!hasModel">
            清除
          </button>
        </div>
      </div>

      <div v-if="hasModel" class="section adjustment-section">
        <div class="divider"><span>位置调整</span></div>
        
        <div class="control-item">
          <div class="label-row">
            <span>高度偏移 (Height)</span>
            <span class="value-display">{{ params.height }} m</span>
          </div>
          <div class="input-group">
            <input 
              type="range" 
              v-model.number="params.height" 
              :min="-200" 
              :max="200" 
              step="1"
              @input="updateTransform"
            />
            <input 
              type="number" 
              class="num-input" 
              v-model.number="params.height"
              @change="updateTransform"
            />
            <button class="icon-btn" @click="resetParam('height')" title="重置">↺</button>
          </div>
        </div>

        <button class="secondary-btn" @click="handleClampToGround">
          ⬇️ 自动贴地 (尝试修复浮空)
        </button>
      </div>
    </div>

    <div class="resize-handle" @mousedown="startResize" title="拖动缩放窗口"></div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onUnmounted, defineExpose, watch } from 'vue';
import { Tiles3DManager } from './hooks/model.js';
import * as Cesium from 'cesium'; 

// 配置 Cesium Token (确保可以访问 Ion 资源)
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4ZWE3YzM1YS1jMmY4LTQwMDMtODAyOS1mMjQ1ZjhhMmFiMjYiLCJpZCI6MzU4ODAxLCJpYXQiOjE3NjI3NTM5Mjl9.KAOSJw8lC-9nbrC1wz1dbOcdnFH0fmQ_9n0On2o5BYI";

const emit = defineEmits(['close', 'tilesetLoaded']);

// --- 核心状态 ---
const viewer = ref(null);
const manager = ref(null);
const loading = ref(false);
const hasModel = ref(false);

// 输入状态
const modelUrl = ref('http://192.168.3.111:8088/gaeaExplorerServer/model/webqxsy/武汉未来科技城/tileset.json');

// 43978 点云模型
const ionId = ref(69380);

const params = reactive({
  height: 0
});

// --- 窗口交互状态 ---
const panelRef = ref(null);
const position = reactive({ top: 80, left: window.innerWidth - 350 });
const size = reactive({ width: 320, height: null }); 
const dragging = ref(false);
const resizing = ref(false);
const dragOffset = reactive({ x: 0, y: 0 });
const resizeStart = reactive({ x: 0, y: 0, w: 0, h: 0 });

// 样式计算
const panelStyle = computed(() => ({
  top: `${position.top}px`,
  left: `${position.left}px`,
  width: `${size.width}px`,
  height: size.height ? `${size.height}px` : 'auto',
  cursor: dragging.value ? 'move' : 'default',
  userSelect: dragging.value ? 'none' : 'auto'
}));

// --- 拖拽与缩放逻辑 ---
const startDrag = (e) => {
  if (['INPUT', 'BUTTON', 'LABEL'].includes(e.target.tagName)) return;
  dragging.value = true;
  dragOffset.x = e.clientX - position.left;
  dragOffset.y = e.clientY - position.top;
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
};
const onDrag = (e) => {
  if (!dragging.value) return;
  const maxX = window.innerWidth - 50;
  const maxY = window.innerHeight - 50;
  position.left = Math.max(-size.width + 50, Math.min(e.clientX - dragOffset.x, maxX));
  position.top = Math.max(0, Math.min(e.clientY - dragOffset.y, maxY));
};
const stopDrag = () => {
  dragging.value = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
};
const startResize = (e) => {
  resizing.value = true;
  resizeStart.x = e.clientX;
  resizeStart.y = e.clientY;
  resizeStart.w = size.width;
  resizeStart.h = size.height || panelRef.value.offsetHeight;
  window.addEventListener('mousemove', onResize);
  window.addEventListener('mouseup', stopResize);
  e.preventDefault();
};
const onResize = (e) => {
  if (!resizing.value) return;
  size.width = Math.max(280, resizeStart.w + (e.clientX - resizeStart.x));
  size.height = Math.max(200, resizeStart.h + (e.clientY - resizeStart.y));
};
const stopResize = () => {
  resizing.value = false;
  window.removeEventListener('mousemove', onResize);
  window.removeEventListener('mouseup', stopResize);
};

// --- ★★★ 核心业务逻辑 ★★★ ---

const setViewer = (v) => {
  if (!v) return;
  viewer.value = v;
  manager.value = new Tiles3DManager(v);
};

// 封装通用的加载执行过程
const executeLoad = async (loadFn) => {
  if (!manager.value) return;
  loading.value = true;
  try {
    const tileset = await loadFn();
    hasModel.value = true;
    handleResetAll(); // 加载新模型时重置参数
    console.log("模型加载成功", tileset);
    emit('tilesetLoaded', tileset);
  } catch (error) {
    console.error("加载失败", error);
    alert("加载失败，请检查控制台报错 (可能是 ID 无效或无权访问)");
  } finally {
    loading.value = false;
  }
};

// 1. URL 加载入口
const handleLoadUrl = () => {
  if (!modelUrl.value) return;
  executeLoad(() => manager.value.loadFromUrl(modelUrl.value));
};

// 2. Ion 加载入口 (支持动态 ID)
const handleLoadIon = () => {
  if (!ionId.value) {
    alert("请输入有效的 Ion ID");
    return;
  }
  // 将输入框的值传给 loadFromIon
  executeLoad(() => manager.value.loadFromIon(Number(ionId.value)));
};

const updateTransform = () => {
  if (manager.value) {
    manager.value.updateModel({ height: params.height });
  }
};

const resetParam = (key) => {
  if (key === 'height') {
    params.height = 0;
    updateTransform();
  }
};

const handleResetAll = () => {
  params.height = 0;
  updateTransform();
};

const handleRemove = () => {
  if (manager.value) {
    manager.value.removeTileset();
    hasModel.value = false;
    emit('tilesetLoaded', null);
  }
};

// 自动贴地功能
const handleClampToGround = async () => {
  if (!manager.value || !manager.value.tileset || !viewer.value) return;

  const btn = document.querySelector('.secondary-btn');
  const originalText = btn ? btn.innerText : '自动贴地';
  if (btn) btn.innerText = "⏳ 计算地形中...";

  try {
    const tileset = manager.value.tileset;
    tileset.update(viewer.value.scene.frameState);
    const centerCartesian = tileset.boundingSphere.center;
    const cartographic = Cesium.Cartographic.fromCartesian(centerCartesian);
    const currentModelHeight = cartographic.height;

    let terrainHeight = 0;
    const terrainProvider = viewer.value.scene.terrainProvider;
    
    if (!(terrainProvider instanceof Cesium.EllipsoidTerrainProvider)) {
      const updatedPositions = await Cesium.sampleTerrainMostDetailed(
        terrainProvider, 
        [cartographic]
      );
      terrainHeight = updatedPositions[0].height || 0;
    }

    // 差值 = 地形高度 - 当前底部高度 + 缓冲
    const diff = (terrainHeight - currentModelHeight) / 2 + 5; 
    params.height = Math.floor(params.height + diff);
    updateTransform();

  } catch (error) {
    console.error("贴地计算失败:", error);
  } finally {
    if (btn) btn.innerText = originalText;
  }
};

// watch 监听 (已修复循环引用问题)
watch([manager, modelUrl], ([newManager, newUrl]) => {
  if (newManager && newUrl && !hasModel.value) {
    // 自动加载 URL (如果需要)
    // handleLoadUrl(); 
    handleLoadIon();
  }
});

defineExpose({ setViewer });

onUnmounted(() => {
  handleRemove();
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
  window.removeEventListener('mousemove', onResize);
  window.removeEventListener('mouseup', stopResize);
});
</script>

<style scoped>
/* 保持原有样式的同时，增加一点间距 */
.input-label {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
  margin-top: 8px; /* 增加一点上边距，区分两个输入框 */
}
.input-label:first-child { margin-top: 0; }

.model-panel {
  position: fixed;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  min-width: 280px;
}

.panel-header {
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: grab;
  user-select: none;
}
.panel-header:active { cursor: grabbing; }

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.5px;
}

.header-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.icon-btn, .close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
}
.icon-btn:hover { color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
.close-btn { font-size: 20px; line-height: 1; }
.close-btn:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

.panel-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px; /* 调整间距 */
}

.input-row input {
  width: 100%;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #334155;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}
.input-row input:focus { border-color: #3b82f6; }

.btn-group { display: flex; gap: 10px; margin-top: 8px; }
.btn-group button {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.primary-btn { background: #3b82f6; color: white; }
.primary-btn:hover:not(:disabled) { background: #2563eb; }

.ion-btn { background: #10b981; color: white; }
.ion-btn:hover:not(:disabled) { background: #059669; }

.danger-btn { background: rgba(220, 38, 38, 0.15); color: #f87171; }
.danger-btn:hover:not(:disabled) { background: rgba(220, 38, 38, 0.25); }
button:disabled { opacity: 0.5; cursor: not-allowed; }

.divider {
  display: flex;
  align-items: center;
  margin: 8px 0 16px;
  color: #94a3b8;
  font-size: 12px;
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}
.divider span { padding: 0 10px; font-weight: 600; }

.control-item {
  background: rgba(255, 255, 255, 0.03);
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: #cbd5e1;
}

.input-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

input[type="range"] {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  appearance: none;
  cursor: pointer;
}
input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  background: #3b82f6;
  border-radius: 50%;
  border: 2px solid #1e293b;
  transition: transform 0.1s;
}
input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.2); }

.num-input {
  width: 50px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #3b82f6;
  font-family: monospace;
  font-size: 12px;
  text-align: center;
  padding: 4px 0;
}
.num-input:focus { border-color: #3b82f6; outline: none; }

.secondary-btn {
  width: 100%;
  margin-top: 8px;
  padding: 10px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}
.secondary-btn:hover { background: rgba(59, 130, 246, 0.2); }

.resize-handle {
  position: absolute; bottom: 0; right: 0;
  width: 20px; height: 20px;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 50%, rgba(59, 130, 246, 0.5) 50%);
}
.resize-handle:hover { background: linear-gradient(135deg, transparent 50%, rgba(59, 130, 246, 0.8) 50%); }

.panel-content::-webkit-scrollbar { width: 4px; }
.panel-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 2px; }
.panel-content::-webkit-scrollbar-track { background: transparent; }
</style>