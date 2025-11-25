<template>
  <div 
    class="camera-panel" 
    ref="panelRef"
    :style="panelStyle"
  >
    <div class="panel-header" @mousedown="startDrag">
      <div class="header-left">
        <div class="icon"><i>👁️</i></div>
        <h2>观察控制台</h2>
      </div>
      <button class="close-btn" @mousedown.stop @click="$emit('close')">×</button>
    </div>

    <div class="panel-content">
      <div class="status-bar" :class="{ active: isLocked }">
        状态: {{ isLocked ? '已锁定目标' : '自由视角' }}
      </div>

      <div class="control-item">
        <div class="label-row">
          <span>🔄 水平旋转 (Heading)</span>
          <span class="value">{{ parseInt(status.heading) }}°</span>
        </div>
        <input 
          type="range" min="0" max="360" step="1" 
          v-model.number="status.heading"
          @input="handleHeadingChange"
          :disabled="!isLocked"
        />
      </div>

      <div class="control-item">
        <div class="label-row">
          <span>↕️ 俯仰角度 (Pitch)</span>
          <span class="value">{{ parseInt(status.pitch) }}°</span>
        </div>
        <input 
          type="range" min="-90" max="0" step="1" 
          v-model.number="status.pitch" 
          @input="handlePitchChange"
          :disabled="!isLocked"
        />
      </div>

      <div class="control-item">
        <div class="label-row">
          <span>🔭 距离 (Zoom)</span>
          <span class="value">{{ parseInt(status.range) }}m</span>
        </div>
        <input 
          type="range" min="100" max="5000" step="50" 
          v-model.number="status.range"
          @input="handleRangeChange"
          :disabled="!isLocked"
        />
      </div>

      <div class="btn-group">
        <button class="primary-btn" @click="handleLockToggle">
          {{ isLocked ? '🔓 解锁视角' : '🎯 锁定屏幕中心' }}
        </button>
        <button 
          class="action-btn" 
          :class="{ active: status.isAutoRotating }"
          @click="toggleAutoRotate"
          :disabled="!isLocked"
        >
          {{ status.isAutoRotating ? '⏹️ 停止旋转' : '▶️ 自动环绕' }}
        </button>
      </div>

      <p class="hint">提示: 先移动地图将模型置于屏幕中心，然后点击“锁定”。</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import useCameraControl from './hooks/cameraControl.js'; // 引入刚才的 JS

const props = defineProps(['viewer']);
const emit = defineEmits(['close']);

// 引入逻辑 Hook
const { 
  status, 
  initCameraControl, 
  lockTarget, 
  unlockTarget, 
  setHeading, 
  setPitch, 
  setRange,
  toggleAutoRotate 
} = useCameraControl();

const isLocked = ref(false);

// --- 初始化 ---
onMounted(() => {
  if (props.viewer) {
    initCameraControl(props.viewer);
  }
});

// 监听 viewer 变化 (防止组件加载时 viewer 还没好)
watch(() => props.viewer, (newVal) => {
  if (newVal) initCameraControl(newVal);
});

// --- 事件处理 ---
const handleLockToggle = () => {
  if (isLocked.value) {
    unlockTarget();
    isLocked.value = false;
  } else {
    lockTarget();
    isLocked.value = true; // 只有锁定成功才变 true，这里简单处理，实际 lockTarget 应该返回成功与否
  }
};

const handleHeadingChange = () => setHeading(status.heading);
const handlePitchChange = () => setPitch(status.pitch);
const handleRangeChange = () => setRange(status.range);

// --- 拖拽逻辑 (复用之前的) ---
const panelRef = ref(null);
const position = reactive({ top: 200, left: window.innerWidth - 350 });
const dragging = ref(false);
const dragOffset = reactive({ x: 0, y: 0 });

const panelStyle = computed(() => ({
  top: `${position.top}px`,
  left: `${position.left}px`,
  cursor: dragging.value ? 'move' : 'default'
}));

const startDrag = (e) => {
  if (['BUTTON', 'INPUT'].includes(e.target.tagName)) return;
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
/* --- 样式与 Model.vue 保持一致 (深色玻璃风格) --- */
.camera-panel {
  position: fixed;
  width: 300px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  z-index: 2001; /* 比其他窗口略高 */
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
  user-select: none;
}

.header-left { display: flex; align-items: center; gap: 10px; }
.panel-header h2 { margin: 0; font-size: 14px; font-weight: 600; }
.icon { font-size: 16px; }

.close-btn {
  background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;
}
.close-btn:hover { color: #ef4444; }

.panel-content { padding: 16px; display: flex; flex-direction: column; gap: 16px; }

.status-bar {
  font-size: 12px; padding: 6px 10px; background: rgba(255,255,255,0.05);
  border-radius: 4px; text-align: center; color: #94a3b8;
  border: 1px solid transparent;
}
.status-bar.active {
  color: #4ade80; border-color: rgba(74, 222, 128, 0.3); background: rgba(74, 222, 128, 0.1);
}

.control-item {
  background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;
}

.label-row {
  display: flex; justify-content: space-between; font-size: 12px; color: #cbd5e1; margin-bottom: 8px;
}
.value { color: #3b82f6; font-family: monospace; font-weight: bold; }

input[type="range"] {
  width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; appearance: none;
}
input[type="range"]::-webkit-slider-thumb {
  appearance: none; width: 14px; height: 14px; background: #3b82f6;
  border-radius: 50%; border: 2px solid #1e293b; cursor: pointer; transition: transform 0.1s;
}
input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.2); }
input[type="range"]:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-group { display: flex; gap: 10px; margin-top: 4px; }
.btn-group button {
  flex: 1; padding: 10px; border: none; border-radius: 6px; font-size: 12px;
  font-weight: 500; cursor: pointer; transition: all 0.2s; color: white;
}

.primary-btn { background: #3b82f6; }
.primary-btn:hover { background: #2563eb; }

.action-btn { background: rgba(255,255,255,0.1); }
.action-btn:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
.action-btn.active { background: #f59e0b; color: #fff; } /* 激活时变橙色 */
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.hint { font-size: 11px; color: #64748b; margin: 0; text-align: center; line-height: 1.4; }
</style>