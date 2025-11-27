<template>
  <div 
    class="terrain-panel" 
    ref="panelRef"
    :style="panelStyle"
  >
    <div class="panel-header" @mousedown="startDrag">
      <div class="header-left">
        <div class="icon">⛰️</div>
        <h2>地形控制</h2>
      </div>
      <button class="close-btn" @mousedown.stop @click="$emit('close')">×</button>
    </div>

    <div class="panel-content">
      <div class="control-group">
        <label class="switch-label">
          <span>启用 3D 地形</span>
          <input 
            type="checkbox" 
            :checked="hasTerrain" 
            @change="handleToggle"
          />
          <div class="slider-toggle"></div>
        </label>
      </div>

      <div class="control-group" :class="{ disabled: !hasTerrain }">
        <div class="label-row">
          <span>地形夸张倍数</span>
          <span class="value">{{ exaggeration }}x</span>
        </div>
        <input 
          type="range" 
          min="1" 
          max="10" 
          step="0.1"
          :value="exaggeration"
          @input="handleExaggeration"
          :disabled="!hasTerrain"
        />
        <p class="hint">拉动滑块可让山脉显得更陡峭</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import useTdtTerrain from './hooks/arcgisTerrain.js';

const props = defineProps(['viewer']);
const emit = defineEmits(['close']);

// 复用逻辑 Hook
const { hasTerrain, exaggeration, toggleTerrain, setExaggeration } = useTdtTerrain();

// 初始化同步状态
onMounted(() => {
  // 这里可以做一些初始化检查，但通常状态由 Hook 共享
});

// 处理开关
const handleToggle = (e) => {
  toggleTerrain(props.viewer, e.target.checked);
};

// 处理滑块
const handleExaggeration = (e) => {
  const val = parseFloat(e.target.value);
  setExaggeration(props.viewer, val);
};

// --- 窗口拖拽逻辑 (保持风格一致) ---
const panelRef = ref(null);
const position = reactive({ top: 140, left: 380 }); // 默认位置错开
const dragging = ref(false);
const dragOffset = reactive({ x: 0, y: 0 });

const panelStyle = computed(() => ({
  top: `${position.top}px`,
  left: `${position.left}px`,
  cursor: dragging.value ? 'move' : 'default'
}));

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
  position.left = e.clientX - dragOffset.x;
  position.top = e.clientY - dragOffset.y;
};

const stopDrag = () => {
  dragging.value = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
};
</script>

<style scoped>
.terrain-panel {
  position: fixed;
  width: 280px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  z-index: 2001;
  display: flex;
  flex-direction: column;
  font-family: sans-serif;
}

.panel-header {
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: grab;
}
.header-left { display: flex; align-items: center; gap: 10px; }
.panel-header h2 { margin: 0; font-size: 14px; font-weight: 600; color: #fff; }
.close-btn { background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; }
.close-btn:hover { color: #ef4444; }

.panel-content { padding: 20px; display: flex; flex-direction: column; gap: 20px; }

/* Switch 开关样式 */
.switch-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}
.switch-label input { display: none; }
.slider-toggle {
  width: 44px; height: 24px; background: #334155; border-radius: 24px; position: relative; transition: 0.3s;
}
.slider-toggle::before {
  content: ''; position: absolute; width: 20px; height: 20px; background: white; border-radius: 50%; top: 2px; left: 2px; transition: 0.3s;
}
input:checked + .slider-toggle { background: #3b82f6; }
input:checked + .slider-toggle::before { transform: translateX(20px); }

/* 滑块样式 */
.control-group.disabled { opacity: 0.5; pointer-events: none; }
.label-row { display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; margin-bottom: 8px; }
.value { color: #3b82f6; font-weight: bold; font-family: monospace; }

input[type="range"] {
  width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; appearance: none;
}
input[type="range"]::-webkit-slider-thumb {
  appearance: none; width: 14px; height: 14px; background: #3b82f6; border-radius: 50%; border: 2px solid #1e293b; cursor: pointer; margin-top: -5px;
}
input[type="range"]::-webkit-slider-runnable-track { height: 4px; }

.hint { font-size: 11px; color: #64748b; margin-top: 8px; text-align: center; }
</style>