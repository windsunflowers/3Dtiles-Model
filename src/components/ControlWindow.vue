<template>
  <div 
    class="control-window" 
    ref="panelRef"
    :style="panelStyle"
  >
    <div 
      class="control-header" 
      @mousedown="startDrag"
      style="cursor: move;" 
    >
      <div class="header-left">
        <div class="icon"><i>🗺️</i></div>
        <h2>地图视角</h2>
      </div>
      <button class="close-btn" @mousedown.stop @click="$emit('close')">×</button>
    </div>
    
    <div class="status-display" :class="{'city-view': isCityView, 'global-view': !isCityView}">
      <div class="status-label">当前视角</div>
      <div class="status-value">{{ flyMsg }}</div>
    </div>
    
    <button class="toggle-btn" @click="handleFlyTo">
      <i>🔄</i> {{ isCityView ? '切换到全局视角' : '切换到俯视视角' }}
    </button>
    
    <div class="view-info">
      <h3>视角说明</h3>
      <p><strong>全局视角：</strong>显示整个地图概览。</p>
      <p><strong>俯视视角：</strong>聚焦城市细节。</p>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, ref, reactive, computed, onUnmounted } from 'vue'

const props = defineProps({
  flyMsg: String,
  isCityView: Boolean,
  flyTo: Function
})

const emit = defineEmits(['close'])

// --- 拖拽逻辑 (与 Model.vue 保持一致) ---
const panelRef = ref(null);
// 初始位置：放在左侧工具栏旁边，避免重叠
const position = reactive({ top: 455, left: 1028 }); 
const dragging = ref(false);
const dragOffset = reactive({ x: 0, y: 0 });

const panelStyle = computed(() => ({
  top: `${position.top}px`,
  left: `${position.left}px`,
  margin: 0, // 移除可能存在的 margin
  cursor: dragging.value ? 'move' : 'default',
  userSelect: dragging.value ? 'none' : 'auto'
}));

const startDrag = (e) => {
  if (['BUTTON'].includes(e.target.tagName)) return;
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
  position.left = Math.max(0, Math.min(newLeft, maxX));
  position.top = Math.max(0, Math.min(newTop, maxY));
};

const stopDrag = () => {
  dragging.value = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
};

// 清理事件
onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
});

const handleFlyTo = () => {
  if (props.flyTo) props.flyTo();
}

</script>
<style scoped>
/* --- 容器风格 (与 Model.vue 一致) --- */
.control-window {
  position: fixed; /* 位置由 JS 的 top/left 控制 */
  width: 300px;
  /* 暗黑玻璃背景 */
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  /* 阴影和 1px 亮边框 */
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
  color: #e2e8f0; /* 浅色文字 */
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* --- 顶部拖拽栏 --- */
.control-header {
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: grab; /* 拖拽手势 */
  user-select: none;
}
.control-header:active {
  cursor: grabbing;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.control-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.5px;
}

.icon {
  font-size: 16px; /* 调整图标大小 */
  display: flex;
  align-items: center;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  border-radius: 4px;
}
.close-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

/* --- 内容区域 --- */
/* 给所有内容加一点内边距 */
.status-display, .toggle-btn, .view-info {
  margin: 16px 16px 0 16px;
}
.view-info {
  margin-bottom: 16px;
}

/* --- 状态显示框 --- */
.status-display {
  background: rgba(0, 0, 0, 0.3); /* 深色半透明 */
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.status-label {
  color: #94a3b8;
  font-size: 12px;
  margin-bottom: 4px;
}

.status-value {
  font-size: 16px;
  font-weight: 600;
}

/* 调整状态颜色以适应深色背景 */
.city-view .status-value {
  color: #f87171; /* 浅红色 */
}

.global-view .status-value {
  color: #60a5fa; /* 浅蓝色 */
}

/* --- 切换按钮 (Model.vue 风格) --- */
.toggle-btn {
  padding: 10px;
  border: none;
  border-radius: 6px;
  background: #3b82f6; /* 统一用蓝色 */
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.toggle-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
}
.toggle-btn:active {
  transform: translateY(0);
}

/* --- 信息说明框 --- */
.view-info {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 12px;
  border-left: 3px solid #3b82f6;
}

.view-info h3 {
  color: #e2e8f0;
  font-size: 13px;
  margin: 0 0 8px 0;
  font-weight: 600;
}

.view-info p {
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1.5;
  margin: 0 0 4px 0;
}
.view-info p:last-child {
  margin-bottom: 0;
}
</style>
```