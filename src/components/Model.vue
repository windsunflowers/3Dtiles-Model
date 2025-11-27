<template>
  <div 
    class="model-panel" 
    ref="panelRef"
    :style="panelStyle"
  >
    <!-- 标题栏：拖拽区域 -->
    <div 
      class="panel-header" 
      @mousedown="startDrag"
      title="按住拖动窗口"
    >
      <h3>🏗️ 模型管理</h3>
      <div class="header-controls">
        <button class="icon-btn" @click="handleResetAll" title="重置高度">↺</button>
        <button class="close-btn" @mousedown.stop @click="$emit('close')">×</button>
      </div>
    </div>

    <div class="panel-content">
      <!-- 1. 加载区域 -->
      <div class="section load-section">
        <div class="input-row">
          <input 
            v-model="modelUrl" 
            type="text" 
            placeholder="输入 3D Tiles URL (json)"
          />
        </div>
        

     
        <div class="btn-group">
          <button class="primary-btn" @click="handleLoad" :disabled="loading || !viewer">
            {{ loading ? '加载中...' : '加载模型' }}
          </button>
          <button class="danger-btn" @click="handleRemove" :disabled="!hasModel">
            清除
          </button>
        </div>
      </div>

      <!-- 2. 调整区域 (加载后显示) -->
      <div v-if="hasModel" class="section adjustment-section">
        <div class="divider"><span>模型已成功加载</span></div>
        
        
      </div>
    </div>

    <!-- 右下角缩放手柄 -->
    <div class="resize-handle" @mousedown="startResize" title="拖动缩放窗口"></div>
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
</template>

<script setup>
import { ref, reactive, computed, onUnmounted, defineExpose, watch } from 'vue';
import { Tiles3DManager } from './hooks/model.js';
// ★★★ 必须引入 Cesium，否则无法进行坐标计算 ★★★
import * as Cesium from 'cesium'; 

const emit = defineEmits(['close', 'tilesetLoaded']);

// --- 核心状态 ---
const viewer = ref(null);
const manager = ref(null);
const loading = ref(false);
const hasModel = ref(false);

const modelUrl = ref('http://192.168.3.111:8088/gaeaExplorerServer/model/webqxsy/武汉未来科技城/tileset.json');

const params = reactive({
  height: 0
});

// --- 窗口交互状态 (保持不变) ---
const panelRef = ref(null);
const position = reactive({ top: 80, left: window.innerWidth - 350 });
const size = reactive({ width: 320, height: null }); 
const dragging = ref(false);
const resizing = ref(false);
const dragOffset = reactive({ x: 0, y: 0 });
const resizeStart = reactive({ x: 0, y: 0, w: 0, h: 0 });

// 样式计算 (保持不变)
const panelStyle = computed(() => ({
  top: `${position.top}px`,
  left: `${position.left}px`,
  right: 'auto', 
  bottom: 'auto',
  width: `${size.width}px`,
  height: size.height ? `${size.height}px` : 'auto',
  cursor: dragging.value ? 'move' : 'default',
  transition: 'none', 
  userSelect: dragging.value ? 'none' : 'auto'
}));

// --- 拖拽与缩放逻辑 (保持不变) ---
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
  let newLeft = e.clientX - dragOffset.x;
  let newTop = e.clientY - dragOffset.y;
  position.left = Math.max(-size.width + 50, Math.min(newLeft, maxX));
  position.top = Math.max(0, Math.min(newTop, maxY));
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

// --- ★★★ 核心业务逻辑修正 ★★★ ---

const setViewer = (v) => {
  if (!v) return;
  viewer.value = v;
  manager.value = new Tiles3DManager(v);
};

const handleLoad = async () => {
  if (!manager.value || !modelUrl.value) return;
  loading.value = true;
  try {
    const tileset = await manager.value.loadTileset(modelUrl.value);
    hasModel.value = true;
    handleResetAll();
    console.log("模型加载成功", tileset);
    emit('tilesetLoaded', tileset);
  } catch (error) {
    console.error("模型加载失败", error);
    alert("加载失败，请检查 URL 或网络");
  } finally {
    loading.value = false;
  }
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

// ★★★ 重点：修复后的自动贴地功能 ★★★
const handleClampToGround = async () => {
  // 1. 检查状态
  if (!manager.value || !manager.value.tileset || !viewer.value) {
    console.warn("模型或 Viewer 未就绪");
    return;
  }

  const btn = document.querySelector('.secondary-btn');
  const originalText = btn ? btn.innerText : '自动贴地';
  if (btn) btn.innerText = "⏳ 计算地形中...";

  try {
    const tileset = manager.value.tileset;
    // 强制更新 tileset 的位置矩阵，确保 boundingSphere 是最新的
    tileset.update(viewer.value.scene.frameState);

    // 2. 获取模型当前的包围球信息
  
    const centerCartesian = tileset.boundingSphere.center;
    const cartographic = Cesium.Cartographic.fromCartesian(centerCartesian);

    // 3. 计算模型底部的视觉高度
    // 核心修正：用球心高度 - 半径 = 模型大概的底部高度
    const currentModelHeight =cartographic.height;

    // 4. 获取当前经纬度的地面真实高度 (地形采样)
    let terrainHeight = 0;
    const terrainProvider = viewer.value.scene.terrainProvider;
    
    // 判断是否有地形服务
    if (terrainProvider instanceof Cesium.EllipsoidTerrainProvider) {
      terrainHeight = 0; // 无地形时默认为 0
    } else {
      // 有地形时，异步采样
      const updatedPositions = await Cesium.sampleTerrainMostDetailed(
        terrainProvider, 
        [cartographic]
      );
      terrainHeight = updatedPositions[0].height || 0;
    }

    // 5. 计算需要移动的差值 (Diff)
    // 目标是让 bottomHeight == terrainHeight
    // 差值 = 地形高度 - 当前底部高度
    const diff = (terrainHeight - currentModelHeight)/2+5; // +5 米缓冲，避免贴地过紧

    console.log(`
      球心高度: ${cartographic.height.toFixed(2)}
      目标地面: ${terrainHeight.toFixed(2)}
      需修正: ${diff.toFixed(2)}
    `);

    // 6. 应用修正
    // 注意：我们要在现有的 params.height 基础上累加这个差值
    // 使用 Math.floor 取整，避免小数点过多导致的浮点数抖动
    params.height = Math.floor(params.height + diff);
    
    // 触发更新
    updateTransform();

  } catch (error) {
    console.error("贴地计算失败:", error);
    alert("自动贴地失败，请确保地形服务正常");
  } finally {
    if (btn) btn.innerText = originalText;
  }
};

watch([manager, modelUrl], ([newManager, newUrl]) => {
  if (newManager && newUrl && !hasModel.value) {
    // 自动加载逻辑，可选
    handleLoad(); 
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
  user-select: none; /* 防止拖拽时选中文字 */
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

.icon-btn, .close-btn, .reset-icon {
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
.icon-btn:hover, .reset-icon:hover { color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
.close-btn { font-size: 20px; line-height: 1; }
.close-btn:hover { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

.panel-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.quick-links {
  font-size: 11px;
  text-align: right;
  color: #64748b;
  margin-top: -4px;
}
.quick-links span { color: #3b82f6; cursor: pointer; text-decoration: underline; }

.btn-group { display: flex; gap: 10px; }
.btn-group button {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.primary-btn { background: #3b82f6; color: white; }
.primary-btn:hover:not(:disabled) { background: #2563eb; }
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